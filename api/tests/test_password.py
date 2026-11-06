"""비밀번호 로그인 (ADR-0008): 가입 → 비밀번호 설정 → 비밀번호 로그인 → 재설정 → 변경."""

from __future__ import annotations

from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import auth
from app.db import AuthSession, Database, LoginFailure, User, utcnow
from app.passwords import hash_password, needs_rehash, password_problem, verify_password
from tests.conftest import make_client

COOKIE = "johnnystudio_session"
PW = "correct horse battery"
PW2 = "another long passphrase"


def link_login(client, mailer, email="me@example.com", purpose="signup"):  # noqa: ANN001, ANN201
    assert client.post("/api/auth/request", json={"email": email, "purpose": purpose}).status_code == 202
    return client.post("/api/auth/verify", json={"token": mailer.last_token()})


def signup(client, mailer, email="me@example.com", password=PW):  # noqa: ANN001, ANN201
    r = link_login(client, mailer, email)
    assert r.json()["created"] is True and r.json()["user"]["has_password"] is False
    assert client.post("/api/account/password", json={"password": password}).status_code == 204
    return r


def rows(client, model):  # noqa: ANN001, ANN201
    with client.app.state.db._sessions() as s:
        return list(s.scalars(select(model)))


# ── 가입 → 비밀번호 로그인 ──


def test_signup_then_password_login(client, mailer) -> None:
    signup(client, mailer)
    assert client.get("/api/auth/me").json()["user"]["has_password"] is True
    client.post("/api/auth/logout")

    r = client.post("/api/auth/login", json={"email": "ME@example.com", "password": PW})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "me@example.com"
    assert COOKIE in r.cookies
    assert client.get("/api/auth/me").json()["user"]["email"] == "me@example.com"
    assert rows(client, AuthSession)[-1].method == "password"


def test_signup_mail_mentions_password_step(client, mailer) -> None:
    client.post("/api/auth/request", json={"email": "new@example.com", "purpose": "signup"})
    assert mailer.sent[-1].subject == "[JohnnyStudio] 가입 확인"
    assert "비밀번호" in mailer.sent[-1].body and "계속하기" in mailer.sent[-1].body


def test_password_is_stored_as_scrypt_hash(client, mailer) -> None:
    signup(client, mailer)
    stored = rows(client, User)[0].password_hash
    assert stored.startswith("scrypt$10$8$1$") and PW not in stored


def test_wrong_password_and_unknown_email_look_the_same(client, mailer) -> None:
    signup(client, mailer)
    client.post("/api/auth/logout")
    wrong = client.post("/api/auth/login", json={"email": "me@example.com", "password": "not the password"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PW})
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json()
    assert wrong.json()["detail"]["code"] == "invalid_credentials"
    assert len(rows(client, LoginFailure)) == 2


def test_member_without_password_cannot_password_login(client, mailer) -> None:
    link_login(client, mailer)  # 가입만 하고 비밀번호를 정하지 않음
    client.post("/api/auth/logout")
    r = client.post("/api/auth/login", json={"email": "me@example.com", "password": PW})
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_too_many_failures_lock_password_login_but_not_link_login(settings, mailer) -> None:
    gen = make_client(replace(settings, login_fail_email_limit=3), mailer)
    client = next(gen)
    signup(client, mailer)
    client.post("/api/auth/logout")
    for _ in range(3):
        assert client.post("/api/auth/login", json={"email": "me@example.com", "password": "wrong wrong wrong"}).status_code == 400
    locked = client.post("/api/auth/login", json={"email": "me@example.com", "password": PW})
    assert locked.status_code == 429
    assert locked.json()["detail"]["code"] == "too_many_attempts"
    assert int(locked.headers["retry-after"]) > 0
    # 메일 링크 로그인은 그대로 된다 (남이 일부러 틀려 잠가도 주인은 들어올 수 있다)
    assert link_login(client, mailer, purpose="login").status_code == 200
    next(gen, None)


def test_rehash_when_cost_changes(settings, mailer) -> None:
    gen = make_client(settings, mailer)
    client = next(gen)
    signup(client, mailer)
    client.post("/api/auth/logout")
    client.app.state.settings = replace(settings, password_cost=11)
    assert client.post("/api/auth/login", json={"email": "me@example.com", "password": PW}).status_code == 200
    assert rows(client, User)[0].password_hash.startswith("scrypt$11$")
    next(gen, None)


# ── 재설정·변경 ──


def test_reset_password_via_mail_link(client, mailer) -> None:
    signup(client, mailer)
    client.post("/api/auth/logout")

    r = link_login(client, mailer, purpose="reset")
    assert mailer.sent[-1].subject == "[JohnnyStudio] 비밀번호 재설정"
    assert r.json()["purpose"] == "reset" and r.json()["created"] is False
    # 메일 링크로 방금 로그인했으니 현재 비밀번호 없이 바꿀 수 있다
    assert client.post("/api/account/password", json={"password": PW2}).status_code == 204
    client.post("/api/auth/logout")

    assert client.post("/api/auth/login", json={"email": "me@example.com", "password": PW}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "me@example.com", "password": PW2}).status_code == 200


def test_change_requires_current_password_after_password_login(client, mailer) -> None:
    signup(client, mailer)
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "me@example.com", "password": PW})

    no_current = client.post("/api/account/password", json={"password": PW2})
    assert no_current.json()["detail"]["code"] == "wrong_current_password"
    wrong = client.post("/api/account/password", json={"password": PW2, "current_password": "nope nope nope"})
    assert wrong.json()["detail"]["code"] == "wrong_current_password"
    ok = client.post("/api/account/password", json={"password": PW2, "current_password": PW})
    assert ok.status_code == 204


def test_link_window_is_single_use_and_expires(client, mailer, monkeypatch) -> None:
    signup(client, mailer)  # 링크 세션으로 설정 → 그 기회는 써 버렸다
    r = client.post("/api/account/password", json={"password": PW2})
    assert r.json()["detail"]["code"] == "wrong_current_password"

    client.post("/api/auth/logout")
    link_login(client, mailer, purpose="reset")
    later = utcnow() + timedelta(minutes=16)  # 링크 유효 시간이 지나면 현재 비밀번호가 필요하다
    monkeypatch.setattr(auth, "utcnow", lambda: later)
    r = client.post("/api/account/password", json={"password": PW2})
    assert r.json()["detail"]["code"] == "wrong_current_password"


def test_password_change_signs_out_other_devices(client, mailer) -> None:
    signup(client, mailer)
    other_device = client.cookies[COOKIE]
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "me@example.com", "password": PW})
    this_device = client.cookies[COOKIE]

    assert client.post("/api/account/password", json={"password": PW2, "current_password": PW}).status_code == 204
    assert client.get("/api/auth/me").json()["user"] is not None  # 이 기기는 그대로
    client.cookies.set(COOKIE, other_device)
    assert client.get("/api/auth/me").json() == {"user": None}  # 다른 기기는 로그아웃
    client.cookies.set(COOKIE, this_device)


def test_weak_password_is_rejected(client, mailer) -> None:
    link_login(client, mailer)
    for bad, word in [("short", "10자"), ("1234567890", "흔하거나"), ("me@example.com", "이메일"), ("aaaaaaaaaaaa", "단순")]:
        r = client.post("/api/account/password", json={"password": bad})
        assert r.status_code == 400 and r.json()["detail"]["code"] == "weak_password"
        assert word in r.json()["detail"]["message"], (bad, r.json())


def test_password_endpoint_requires_session(client) -> None:
    assert client.post("/api/account/password", json={"password": PW}).status_code == 401


def test_delete_account_removes_login_failures(client, mailer) -> None:
    signup(client, mailer)
    client.post("/api/auth/login", json={"email": "me@example.com", "password": "wrong wrong wrong"})
    assert client.delete("/api/account").status_code == 204
    assert rows(client, LoginFailure) == []


# ── 순수 함수 ──


def test_hash_and_verify() -> None:
    stored = hash_password("비밀번호 한글도 됩니다", cost=10)
    assert verify_password("비밀번호 한글도 됩니다", stored)
    assert not verify_password("비밀번호 한글도 됩니다!", stored)
    assert verify_password("ｆｕｌｌｗｉｄｔｈ ｐａｓｓ", hash_password("fullwidth pass", cost=10))  # NFKC
    assert not verify_password("x", "garbage")
    assert hash_password("same", cost=10) != hash_password("same", cost=10)  # 소금이 다르다
    assert needs_rehash(stored, cost=11) and not needs_rehash(stored, cost=10)


def test_password_rules() -> None:
    assert password_problem("correct horse battery", "me@example.com") is None
    assert password_problem("x" * 129, "me@example.com") is not None
    assert password_problem("myname2026!", "myname@example.com") is not None  # 이메일 아이디 + 몇 글자
    assert password_problem("한글 비밀번호도 괜찮다", "me@example.com") is None


# ── 개발 DB 스키마 ──


def test_outdated_dev_database_is_recreated_but_production_is_not(tmp_path) -> None:
    import sqlite3

    path = tmp_path / "old.sqlite3"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE users (id VARCHAR(32) PRIMARY KEY, email VARCHAR(320), created_at DATETIME, last_login_at DATETIME)")
    con.commit()
    con.close()

    db = Database(f"sqlite:///{path}")
    assert db.outdated_tables() == ["users: password_changed_at, password_hash"]
    with pytest.raises(RuntimeError, match="마이그레이션"):
        db.ensure_schema(reset_if_outdated=False)
    db.ensure_schema(reset_if_outdated=True)
    assert db.outdated_tables() == []
    db.engine.dispose()

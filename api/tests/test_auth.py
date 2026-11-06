from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app import auth
from app.config import ConfigError, Settings, load_settings
from app.db import AuthSession, LoginToken, User, utcnow
from app.security import normalize_email, safe_next

COOKIE = "johnnystudio_session"


def sign_in(client, mailer, email="me@example.com", next_path=None):  # noqa: ANN001, ANN201
    body = {"email": email} | ({"next": next_path} if next_path else {})
    assert client.post("/api/auth/request", json=body).status_code == 202
    return client.post("/api/auth/verify", json={"token": mailer.last_token()})


def rows(client, model):  # noqa: ANN001, ANN201
    with client.app.state.db._sessions() as s:
        return list(s.scalars(select(model)))


# ── 가입·로그인 ──


def test_first_link_creates_account(client, mailer) -> None:
    r = client.post("/api/auth/request", json={"email": "  Me@Example.COM "})
    assert r.status_code == 202
    assert r.json() == {"ok": True, "expires_in_minutes": 15}
    assert mailer.sent[-1].to == "me@example.com"
    assert mailer.sent[-1].subject == "[JohnnyStudio] 가입 확인"
    assert rows(client, User) == []  # 링크를 누르기 전에는 계정이 없다

    r = client.post("/api/auth/verify", json={"token": mailer.last_token()})
    assert r.status_code == 200
    data = r.json()
    assert data["created"] is True
    assert data["user"]["email"] == "me@example.com"
    assert COOKIE in r.cookies

    me = client.get("/api/auth/me").json()
    assert me["user"]["email"] == "me@example.com"


def test_existing_member_gets_login_mail(client, mailer) -> None:
    sign_in(client, mailer)
    client.cookies.clear()
    r = sign_in(client, mailer)
    assert mailer.sent[-1].subject == "[JohnnyStudio] 로그인 링크"
    assert r.json()["created"] is False
    assert len(rows(client, User)) == 1


def test_response_does_not_reveal_membership(client, mailer) -> None:
    sign_in(client, mailer, "old@example.com")
    a = client.post("/api/auth/request", json={"email": "old@example.com"})
    b = client.post("/api/auth/request", json={"email": "new@example.com"})
    assert (a.status_code, a.json()) == (b.status_code, b.json())


def test_link_works_only_once(client, mailer) -> None:
    client.post("/api/auth/request", json={"email": "me@example.com"})
    token = mailer.last_token()
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    r = client.post("/api/auth/verify", json={"token": token})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_link"


def test_login_invalidates_other_pending_links(client, mailer) -> None:
    client.post("/api/auth/request", json={"email": "me@example.com"})
    first = mailer.last_token()
    client.post("/api/auth/request", json={"email": "me@example.com"})
    second = mailer.last_token()
    assert client.post("/api/auth/verify", json={"token": second}).status_code == 200
    assert client.post("/api/auth/verify", json={"token": first}).status_code == 400


def test_expired_link_is_rejected(client, mailer, monkeypatch) -> None:
    client.post("/api/auth/request", json={"email": "me@example.com"})
    later = utcnow() + timedelta(minutes=16)
    monkeypatch.setattr(auth, "utcnow", lambda: later)
    r = client.post("/api/auth/verify", json={"token": mailer.last_token()})
    assert r.status_code == 400
    assert rows(client, User) == []


def test_unknown_token_is_rejected(client) -> None:
    r = client.post("/api/auth/verify", json={"token": "x" * 43})
    assert r.status_code == 400


def test_only_hashes_are_stored(client, mailer) -> None:
    r = sign_in(client, mailer)
    link_token = mailer.last_token()
    session_token = r.cookies[COOKIE]
    stored = {t.token_hash for t in rows(client, LoginToken)} | {s.token_hash for s in rows(client, AuthSession)}
    assert link_token not in stored and session_token not in stored
    assert all(len(h) == 64 for h in stored)
    assert all("127.0.0.1" not in t.ip_hash for t in rows(client, LoginToken))


def test_next_path_is_returned_only_when_safe(client, mailer) -> None:
    assert sign_in(client, mailer, next_path="/studio/").json()["next"] == "/studio/"
    client.cookies.clear()
    assert sign_in(client, mailer, next_path="//evil.example/").json()["next"] is None


@pytest.mark.parametrize("email", ["", "no-at-sign", "a@b", "a b@example.com", "x@example.com\r\nBcc: y@example.com", "a..b@example.com"])
def test_invalid_email_is_rejected(client, mailer, email) -> None:
    r = client.post("/api/auth/request", json={"email": email})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_email"
    assert mailer.sent == []


# ── 세션 ──


def test_me_without_session(client) -> None:
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json() == {"user": None}
    assert r.headers["cache-control"] == "no-store"


def test_logout_ends_session(client, mailer) -> None:
    sign_in(client, mailer)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").json() == {"user": None}
    assert rows(client, AuthSession) == []


def test_logout_all_ends_every_session(client, mailer) -> None:
    sign_in(client, mailer)
    other_device = client.cookies[COOKIE]
    client.cookies.clear()
    sign_in(client, mailer)
    assert len(rows(client, AuthSession)) == 2

    assert client.post("/api/auth/logout-all").status_code == 204
    client.cookies.set(COOKIE, other_device)
    assert client.get("/api/auth/me").json() == {"user": None}


def test_expired_session_is_signed_out(client, mailer, monkeypatch) -> None:
    sign_in(client, mailer)
    later = utcnow() + timedelta(days=31)
    monkeypatch.setattr(auth, "utcnow", lambda: later)
    assert client.get("/api/auth/me").json() == {"user": None}


def test_delete_account_removes_everything(client, mailer) -> None:
    sign_in(client, mailer)
    client.post("/api/auth/request", json={"email": "me@example.com"})  # 남아 있는 링크
    assert client.delete("/api/account").status_code == 204
    assert rows(client, User) == []
    assert rows(client, AuthSession) == []
    assert rows(client, LoginToken) == []
    assert client.get("/api/auth/me").json() == {"user": None}


def test_delete_account_requires_session(client) -> None:
    r = client.delete("/api/account")
    assert r.status_code == 401


# ── 남용 방지 ──


def test_rate_limit_per_email(strict_client, mailer) -> None:
    for _ in range(2):
        assert strict_client.post("/api/auth/request", json={"email": "me@example.com"}).status_code == 202
    r = strict_client.post("/api/auth/request", json={"email": "me@example.com"})
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    assert len(mailer.sent) == 2


def test_rate_limit_per_ip(strict_client) -> None:
    for i in range(3):
        assert strict_client.post("/api/auth/request", json={"email": f"u{i}@example.com"}).status_code == 202
    assert strict_client.post("/api/auth/request", json={"email": "u9@example.com"}).status_code == 429


@pytest.mark.parametrize("origin", [None, "https://evil.example", "null"])
def test_cross_origin_post_is_rejected(client, origin) -> None:
    headers = {"Origin": origin} if origin else {}
    if origin is None:
        client.headers.pop("Origin")
    r = client.post("/api/auth/request", json={"email": "me@example.com"}, headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "bad_origin"


def test_form_post_is_not_accepted(client) -> None:
    # HTML 폼(다른 사이트가 만들 수 있는 요청)은 JSON 이 아니라서 받지 않는다
    r = client.post("/api/auth/request", data={"email": "me@example.com"})
    assert r.status_code == 422


def test_secure_cookie_attributes(settings, mailer) -> None:
    from dataclasses import replace

    from tests.conftest import make_client

    gen = make_client(replace(settings, cookie_secure=True), mailer)
    client = next(gen)
    client.post("/api/auth/request", json={"email": "me@example.com"})
    r = client.post("/api/auth/verify", json={"token": mailer.last_token()})
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("__Host-johnnystudio_session=")
    for attr in ("HttpOnly", "Secure", "SameSite=lax", "Path=/"):
        assert attr.lower() in cookie.lower()
    assert "domain" not in cookie.lower()
    next(gen, None)


# ── 순수 함수·설정 ──


def test_normalize_email() -> None:
    assert normalize_email(" A.B+tag@Example.com ") == "a.b+tag@example.com"
    assert normalize_email("a@example") is None
    assert normalize_email(f"{'a' * 65}@example.com") is None


def test_safe_next() -> None:
    assert safe_next("/account/") == "/account/"
    for bad in [None, "", "https://evil.example", "//evil.example", "/\\evil", "/login/", "/api/auth/me", "/a b"]:
        assert safe_next(bad) is None


def test_production_settings_are_checked() -> None:
    with pytest.raises(ConfigError) as e:
        load_settings({"JOHNNYSTUDIO_ENV": "production"})
    msg = str(e.value)
    for needle in ("SITE_URL", "SECRET", "SMTP_HOST", "PostgreSQL"):
        assert needle in msg

    ok = load_settings(
        {
            "JOHNNYSTUDIO_ENV": "production",
            "JOHNNYSTUDIO_SITE_URL": "https://studio.example",
            "JOHNNYSTUDIO_SECRET": "s" * 40,
            "JOHNNYSTUDIO_SMTP_HOST": "smtp.example",
            "JOHNNYSTUDIO_DATABASE_URL": "postgresql+psycopg://u:p@127.0.0.1/db",
        }
    )
    assert ok.cookie_secure and ok.mail_backend == "smtp"
    assert ok.cookie_name == "__Host-johnnystudio_session"
    assert ok.allowed_origins == {"https://studio.example"}


def test_development_defaults() -> None:
    s = load_settings({})
    assert isinstance(s, Settings)
    assert s.mail_backend == "console" and not s.cookie_secure


def test_env_file_parsing_matches_example() -> None:
    from pathlib import Path

    from app.check_config import parse_env_file

    env = parse_env_file(Path(__file__).resolve().parents[2].joinpath("deploy/api.env.example").read_text())
    assert env["JOHNNYSTUDIO_ENV"] == "production"
    assert env["JOHNNYSTUDIO_MAIL_FROM"] == "JohnnyStudio <noreply@__DOMAIN__>"
    assert parse_env_file('A="x y"\n# c\nB=\'z\'\n\nC=1=2') == {"A": "x y", "B": "z", "C": "1=2"}
    # 예시 파일 그대로는 운영 설정 검사를 통과하지 않는다 (비밀값이 비어 있다)
    with pytest.raises(ConfigError):
        load_settings(env)


def test_env_file_is_read_and_environment_wins(tmp_path) -> None:  # noqa: ANN001
    f = tmp_path / ".env.local"
    f.write_text(
        "JOHNNYSTUDIO_MAIL_BACKEND=smtp\nJOHNNYSTUDIO_SMTP_HOST=smtp.gmail.com\n"
        "JOHNNYSTUDIO_MAIL_FROM=JohnnyStudio <me@gmail.com>\nJOHNNYSTUDIO_SITE_URL=http://from-file:1\n"
    )
    s = load_settings({"JOHNNYSTUDIO_ENV_FILE": str(f), "JOHNNYSTUDIO_SITE_URL": "http://127.0.0.1:3000"})
    assert s.mail_backend == "smtp" and s.smtp_host == "smtp.gmail.com"
    assert s.mail_from == "JohnnyStudio <me@gmail.com>"
    assert s.site_url == "http://127.0.0.1:3000"  # dev.sh 가 넘긴 값이 파일보다 우선

    with pytest.raises(ConfigError, match="읽을 수 없다"):
        load_settings({"JOHNNYSTUDIO_ENV_FILE": str(tmp_path / "없음")})


def test_smtp_without_host_is_rejected_even_in_development() -> None:
    with pytest.raises(ConfigError, match="SMTP_HOST"):
        load_settings({"JOHNNYSTUDIO_MAIL_BACKEND": "smtp"})


def test_mail_warnings_for_personal_accounts() -> None:
    from dataclasses import replace

    from app.check_config import mail_warnings

    base = Settings(mail_backend="smtp", smtp_host="smtp.gmail.com", smtp_user="me@gmail.com", smtp_password="abcdabcdabcdabcd")
    assert mail_warnings(replace(base, mail_from="JohnnyStudio <me@gmail.com>")) == []
    assert any("띄어쓰기" in w for w in mail_warnings(replace(base, mail_from="me@gmail.com", smtp_password="abcd efgh ijkl mnop")))
    assert any("다르다" in w for w in mail_warnings(replace(base, mail_from="JohnnyStudio <noreply@localhost>")))
    naver = replace(base, smtp_host="smtp.naver.com", smtp_user="myid", mail_from="JohnnyStudio <myid@naver.com>")
    assert mail_warnings(naver) == []


def test_spoofed_real_ip_is_ignored_when_proxy_is_not_trusted(settings, mailer) -> None:
    from dataclasses import replace

    from tests.conftest import make_client

    def burst(trust: bool) -> list[int]:
        gen = make_client(replace(settings, ip_limit=2, trust_proxy_ip=trust), mailer, peer="127.0.0.1")
        client = next(gen)
        codes = [
            client.post("/api/auth/request", json={"email": f"u{i}@example.com"}, headers={"X-Real-IP": f"10.0.0.{i}"}).status_code
            for i in range(3)
        ]
        next(gen, None)
        return codes

    # nginx 뒤(믿음): 헤더의 IP 마다 따로 센다
    assert burst(trust=True) == [202, 202, 202]
    # Next 개발 서버 뒤(안 믿음): 헤더를 바꿔도 한 IP 로 세어져 세 번째에 막힌다
    assert burst(trust=False) == [202, 202, 429]
    assert load_settings({"JOHNNYSTUDIO_TRUST_PROXY_IP": "0"}).trust_proxy_ip is False

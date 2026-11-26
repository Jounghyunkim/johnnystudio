"""Store API (ADR-0012): 올리기 → 검사 → 검토 → 공개 → 내려받기, 한도·권한·신고·숨김·차단·탈퇴."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.store import service
from app.store.models import StoreApp, StoreRelease, StoreReport, StoreUpload
from app.store.scan import ScanResult
from tests.conftest import FakeMailer, make_client, make_pe

COOKIE = "johnnystudio_session"
ADMIN = "admin@example.com"


@pytest.fixture
def store_settings(settings: Settings, tmp_path) -> Settings:  # noqa: ANN001
    # ClamAV 는 기본으로 끈다 (테스트마다 scan_file 을 바꿔 끼운다)
    return replace(settings, store_dir=tmp_path / "store", store_admins=frozenset({ADMIN}), store_clamscan="")


@pytest.fixture
def store(store_settings: Settings, mailer: FakeMailer) -> Iterator[TestClient]:
    yield from make_client(store_settings, mailer)


class Accounts:
    """한 TestClient 로 여러 회원을 오가며 요청한다 (세션 쿠키만 바꿔 끼운다)"""

    def __init__(self, client: TestClient, mailer: FakeMailer) -> None:
        self.client = client
        self.mailer = mailer
        self.tokens: dict[str, str] = {}

    def use(self, email: str | None) -> TestClient:
        self.client.cookies.clear()
        if email is None:
            return self.client
        if email not in self.tokens:
            assert self.client.post("/api/auth/request", json={"email": email}).status_code == 202
            r = self.client.post("/api/auth/verify", json={"token": self.mailer.last_token()})
            assert r.status_code == 200
            self.tokens[email] = r.cookies[COOKIE]
            self.client.cookies.clear()
        self.client.cookies.set(COOKIE, self.tokens[email])
        return self.client


@pytest.fixture
def people(store: TestClient, mailer: FakeMailer) -> Accounts:
    return Accounts(store, mailer)


def become_publisher(c: TestClient, name: str = "개발자 김") -> None:
    r = c.post("/api/store/me/publisher", json={"display_name": name, "agree_terms": True, "age_14": True})
    assert r.status_code == 200, r.text


def upload(c: TestClient, data: bytes, name: str = "My-Tool_1.2.0_x64-setup.exe", chunk: int | None = None) -> dict:
    r = c.post("/api/store/uploads", json={"file_name": name, "size": len(data)})
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    step = chunk or len(data)
    for offset in range(0, len(data), step):
        r = c.put(f"/api/store/uploads/{uid}?offset={offset}", content=data[offset : offset + step])
        assert r.status_code == 200, r.text
    r = c.post(f"/api/store/uploads/{uid}/complete")
    assert r.status_code == 200, r.text
    return r.json()


def submit(c: TestClient, data: bytes | None = None, **fields) -> dict:  # noqa: ANN003
    a = upload(c, data or make_pe(0x8664, b"app" * 100))
    body = {
        "upload_id": a["upload_id"],
        "name": a["suggested"]["name"] or "도구",
        "summary": "한 줄 소개",
        "description": "설명 첫 줄\n\n둘째 문단",
        "category": "utility",
        "version": a["suggested"]["version"] or "1.0.0",
    } | fields
    r = c.post("/api/store/apps", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def approve_latest(people: Accounts, app: dict) -> dict:
    admin = people.use(ADMIN)
    rid = app["releases"][0]["id"]
    r = admin.post(f"/api/store/admin/releases/{rid}/approve")
    assert r.status_code == 200, r.text
    return r.json()


def rows(c: TestClient, model):  # noqa: ANN001, ANN201
    with c.app.state.db.new_session() as s:
        return list(s.scalars(select(model)))


# ── 올리기 → 공개 ──


def test_upload_review_publish_download(people: Accounts, store_settings: Settings) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    data = make_pe(0x8664, b"x" * 5000)
    a = upload(dev, data, chunk=1024)
    assert a["arch"] == "x64" and a["file_type"] == "exe" and not a["signed"]
    assert a["suggested"] == {"name": "My Tool", "version": "1.2.0", "summary": ""}
    assert len(a["sha256"]) == 64 and a["size"] == len(data)

    r = dev.post(
        "/api/store/apps",
        json={"upload_id": a["upload_id"], "name": "My Tool", "summary": "작은 도구", "category": "utility", "version": "v1.2.0"},
    )
    assert r.status_code == 201, r.text
    app = r.json()
    code = app["code"]
    assert app["status"] == "pending" and not app["public"]
    assert app["releases"][0]["version"] == "1.2.0"
    assert app["releases"][0]["scan"]["status"] == "queued"  # 검사는 응답 뒤에 돈다

    # 검토 전: 목록·상세·내려받기 모두 남에게 보이지 않는다
    guest = people.use(None)
    assert guest.get("/api/store/apps").json()["apps"] == []
    assert guest.get(f"/api/store/apps/{code}").status_code == 404
    rid = app["releases"][0]["id"]
    assert guest.get(f"/api/store/apps/{code}/releases/{rid}/download").status_code == 404
    # 다른 회원도 마찬가지
    assert people.use("other@example.com").get(f"/api/store/apps/{code}").status_code == 404
    # 올린 사람은 본다
    mine = people.use("dev@example.com").get(f"/api/store/apps/{code}").json()
    assert mine["status"] == "pending" and mine["viewer"]["owner"]
    assert mine["releases"][0]["scan"]["status"] == "skipped"  # ClamAV 없음 → 검사 안 함

    approve_latest(people, app)

    guest = people.use(None)
    listed = guest.get("/api/store/apps").json()["apps"]
    assert [x["code"] for x in listed] == [code]
    assert listed[0]["publisher"] == "개발자 김" and listed[0]["version"] == "1.2.0"
    detail = guest.get(f"/api/store/apps/{code}").json()
    assert "status" not in detail and "owner" not in detail  # 공개 응답에는 검토 정보가 없다
    assert "status" not in detail["releases"][0] and "detail" not in detail["releases"][0]["scan"]

    d = guest.get(f"/api/store/apps/{code}/releases/{rid}/download")
    assert d.status_code == 200 and d.content == data
    assert d.headers["content-type"] == "application/octet-stream"
    assert d.headers["content-disposition"].startswith("attachment;")
    assert d.headers["x-content-type-options"] == "nosniff"
    assert d.headers["content-security-policy"] == "sandbox; default-src 'none'"
    assert rows(guest, StoreRelease)[0].download_count == 1


def test_accel_redirect_in_production_mode(store_settings: Settings, mailer: FakeMailer) -> None:
    for c in make_client(replace(store_settings, store_accel_prefix="/_store_files/"), mailer):
        people = Accounts(c, mailer)
        dev = people.use("dev@example.com")
        become_publisher(dev)
        app = approve_latest(people, submit(dev))
        rid = app["releases"][0]["id"]
        key = rows(c, StoreRelease)[0].storage_key
        d = people.use(None).get(f"/api/store/apps/{app['code']}/releases/{rid}/download")
        assert d.status_code == 200 and d.content == b""
        assert d.headers["x-accel-redirect"] == f"/_store_files/{key}"
        assert d.headers["content-disposition"].startswith("attachment;")


def test_korean_file_name_in_content_disposition(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    a = upload(dev, make_pe(), name="조니 도구 1.0.exe")
    assert a["file_name"] == "조니 도구 1.0.exe"
    app = dev.post("/api/store/apps", json={"upload_id": a["upload_id"], "name": "조니 도구", "category": "utility", "version": "1.0"}).json()
    app = approve_latest(people, app)
    d = people.use(None).get(f"/api/store/apps/{app['code']}/releases/{app['releases'][0]['id']}/download")
    cd = d.headers["content-disposition"]
    assert 'filename="1.0.exe"' in cd
    assert "filename*=UTF-8''%EC%A1%B0%EB%8B%88" in cd


# ── 입력 검사 ──


def test_publisher_setup_is_required_and_checked(people: Accounts) -> None:
    c = people.use("dev@example.com")
    r = c.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "needs_publisher"
    bad = c.post("/api/store/me/publisher", json={"display_name": "개발자", "agree_terms": True, "age_14": False})
    assert bad.json()["detail"]["code"] == "needs_agreement"
    reserved = c.post("/api/store/me/publisher", json={"display_name": "Johnny Studio 공식", "agree_terms": True, "age_14": True})
    assert reserved.json()["detail"]["code"] == "reserved_name"
    become_publisher(c, "  개발자‮김  ")
    me = c.get("/api/store/me").json()
    assert me["publisher"]["display_name"] == "개발자김"  # 방향 바꾸기 문자는 지운다
    assert me["publisher"]["terms_current"] and not me["admin"]
    # 운영자는 운영자 이름을 쓸 수 있다
    become_publisher(people.use(ADMIN), "JohnnyStudio")


def test_rename_publisher_keeps_agreement_and_rules(people: Accounts) -> None:
    c = people.use("dev@example.com")
    # 처음 정하기 전에는 이름만 바꿀 수 없다 (약관 동의가 먼저)
    r = c.patch("/api/store/me/publisher", json={"display_name": "개발자 김"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "needs_publisher"
    become_publisher(c, "개발자 김")
    code = submit(people.use("dev@example.com"))["code"]
    dev = people.use("dev@example.com")
    before = dev.get("/api/store/me").json()["publisher"]

    # 이름만 바뀌고 약관 동의 기록은 그대로다. 같은 검사를 거친다
    r = dev.patch("/api/store/me/publisher", json={"display_name": "  새 이름‮  "})
    assert r.status_code == 200, r.text
    after = r.json()["publisher"]
    assert after["display_name"] == "새 이름" and after["agreed_at"] == before["agreed_at"] and after["terms_version"] == before["terms_version"]
    assert dev.patch("/api/store/me/publisher", json={"display_name": "김"}).json()["detail"]["code"] == "invalid_field"
    assert dev.patch("/api/store/me/publisher", json={"display_name": "관리자 김"}).json()["detail"]["code"] == "reserved_name"
    assert dev.patch("/api/store/me/publisher", json={"display_name": " "}).status_code == 400
    # 앱 화면의 '올린 사람'도 바로 바뀐다
    assert dev.get(f"/api/store/apps/{code}").json()["publisher"] == "새 이름"
    assert people.use(None).patch("/api/store/me/publisher", json={"display_name": "남의 이름"}).status_code == 401

    # 이용 제한된 회원은 이름을 바꾸지 못한다 (PATCH·POST 모두). 같은 이름으로 약관에 다시 동의하는 것은 된다
    uid = admin_overview_owner_id(people, code)
    assert people.use(ADMIN).post(f"/api/store/admin/publishers/{uid}/block", json={"reason": "테스트"}).status_code == 200
    dev = people.use("dev@example.com")
    assert dev.patch("/api/store/me/publisher", json={"display_name": "다른 이름"}).json()["detail"]["code"] == "blocked"
    assert dev.post("/api/store/me/publisher", json={"display_name": "다른 이름", "agree_terms": True, "age_14": True}).json()["detail"]["code"] == "blocked"
    assert dev.post("/api/store/me/publisher", json={"display_name": "새 이름", "agree_terms": True, "age_14": True}).status_code == 200


def test_rejects_wrong_type_and_mismatched_content(people: Accounts, store_settings: Settings) -> None:
    c = people.use("dev@example.com")
    become_publisher(c)
    for name in ("script.bat", "tool.exe.txt", "page.html", "../../etc/passwd", ".exe"):
        r = c.post("/api/store/uploads", json={"file_name": name, "size": 10})
        assert r.status_code == 415, name

    html = b"<html><script>alert(1)</script></html>" * 10
    r = c.post("/api/store/uploads", json={"file_name": "game.exe", "size": len(html)})
    uid = r.json()["id"]
    assert c.put(f"/api/store/uploads/{uid}?offset=0", content=html).status_code == 200
    r = c.post(f"/api/store/uploads/{uid}/complete")
    assert r.status_code == 415 and "일치하지 않습니다" in r.json()["detail"]["message"]
    assert list((store_settings.store_dir / "uploads").iterdir()) == []  # 받은 파일을 지웠다


def test_chunk_offsets_and_sizes_are_enforced(people: Accounts) -> None:
    c = people.use("dev@example.com")
    become_publisher(c)
    data = make_pe()
    uid = c.post("/api/store/uploads", json={"file_name": "a.exe", "size": len(data)}).json()["id"]
    assert c.put(f"/api/store/uploads/{uid}?offset=5", content=data[:10]).json()["detail"]["code"] == "bad_offset"
    assert c.post(f"/api/store/uploads/{uid}/complete").json()["detail"]["code"] == "incomplete"
    assert c.put(f"/api/store/uploads/{uid}?offset=0", content=data + b"extra").json()["detail"]["code"] == "too_much"
    # 남의 업로드에는 쓸 수 없다
    other = people.use("other@example.com")
    assert other.put(f"/api/store/uploads/{uid}?offset=0", content=data).status_code == 404
    # Origin 없는 쓰기 요청은 막힌다 (CSRF 방어선)
    c = people.use("dev@example.com")
    r = c.put(f"/api/store/uploads/{uid}?offset=0", content=data, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_size_daily_and_quota_limits(store_settings: Settings, mailer: FakeMailer) -> None:
    tight = replace(store_settings, store_file_max_mb=1, store_daily_uploads=3, store_user_quota_mb=2)
    for c in make_client(tight, mailer):
        people = Accounts(c, mailer)
        dev = people.use("dev@example.com")
        become_publisher(dev)
        assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 2 * 1024 * 1024}).status_code == 413
        for _ in range(2):
            assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 1024 * 1024}).status_code == 201
        # 받는 중인 파일 2MB 가 이미 한도를 채웠다
        assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10}).json()["detail"]["code"] == "quota"
        assert c.get("/api/store/me").json()["usage"]["uploads_24h"] == 2
        # 취소하면 용량은 돌아오지만 하루 횟수는 그대로다
        with c.app.state.db.new_session() as s:
            ids = [u.id for u in s.scalars(select(StoreUpload))]
        for uid in ids:
            assert dev.delete(f"/api/store/uploads/{uid}").status_code == 204
        assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10}).status_code == 201
        assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10}).json()["detail"]["code"] == "daily_limit"


def test_uploads_can_be_closed(store_settings: Settings, mailer: FakeMailer) -> None:
    for c in make_client(replace(store_settings, store_uploads_open=False), mailer):
        people = Accounts(c, mailer)
        dev = people.use("dev@example.com")
        become_publisher(dev)
        assert dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10}).json()["detail"]["code"] == "uploads_closed"
        assert c.get("/api/store/meta").json()["uploads_open"] is False


# ── 검사 ──


def test_infected_file_is_rejected_and_deleted(people: Accounts, store_settings: Settings, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(service, "scan_file", lambda *a: ScanResult("infected", "ClamAV 1.4.3", "Win.Test.EICAR_HDB-1"))
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = submit(dev)
    mine = dev.get(f"/api/store/apps/{app['code']}").json()
    r = mine["releases"][0]
    assert mine["status"] == "rejected" and r["status"] == "rejected" and not r["stored"]
    assert "EICAR" in r["status_reason"] and r["scan"]["status"] == "infected"
    assert list((store_settings.store_dir / "files").iterdir()) == []
    assert people.use(ADMIN).post(f"/api/store/admin/releases/{r['id']}/approve").status_code == 409


def test_scan_required_blocks_unscanned_approval(store_settings: Settings, mailer: FakeMailer, monkeypatch) -> None:  # noqa: ANN001
    for c in make_client(replace(store_settings, store_require_scan=True), mailer):
        people = Accounts(c, mailer)
        dev = people.use("dev@example.com")
        become_publisher(dev)
        app = submit(dev)  # ClamAV 없음 → skipped
        rid = app["releases"][0]["id"]
        admin = people.use(ADMIN)
        assert admin.post(f"/api/store/admin/releases/{rid}/approve").json()["detail"]["code"] == "scan_required"
        monkeypatch.setattr(service, "scan_file", lambda *a: ScanResult("clean", "ClamAV 1.4.3 · 시그니처 27831 (2026-11-23)"))
        assert admin.post(f"/api/store/admin/releases/{rid}/rescan").status_code == 202
        ok = admin.post(f"/api/store/admin/releases/{rid}/approve")
        assert ok.status_code == 200 and ok.json()["public"]
        pub = people.use(None).get(f"/api/store/apps/{app['code']}").json()
        assert pub["releases"][0]["scan"] == {"status": "clean", "engine": "ClamAV 1.4.3 · 시그니처 27831 (2026-11-23)", "checked_at": pub["releases"][0]["scan"]["checked_at"]}


def test_engine_label() -> None:
    from app.store.scan import engine_label

    assert engine_label("ClamAV 1.4.3/27831/Sun Nov 23 09:24:57 2026\n") == "ClamAV 1.4.3 · 시그니처 27831 (2026-11-23)"
    assert engine_label("ClamAV 1.4.3") == "ClamAV 1.4.3"
    assert engine_label("garbage") == "ClamAV"


# ── 새 버전 ──


def test_new_version_waits_for_review_while_old_one_stays_public(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev, version="1.0.0"))
    code = app["code"]
    dev = people.use("dev@example.com")
    a = upload(dev, make_pe(0x8664, b"v2" * 50), name="tool-2.0.0.exe")
    assert dev.post(f"/api/store/apps/{code}/releases", json={"upload_id": a["upload_id"], "version": "1.0.0"}).json()["detail"]["code"] == "duplicate_version"
    r = dev.post(f"/api/store/apps/{code}/releases", json={"upload_id": a["upload_id"], "version": "2.0.0", "notes": "빨라졌습니다"})
    assert r.status_code == 201
    assert [x["version"] for x in r.json()["releases"]] == ["2.0.0", "1.0.0"]
    pub = people.use(None).get(f"/api/store/apps/{code}").json()
    assert [x["version"] for x in pub["releases"]] == ["1.0.0"]  # 새 버전은 검토 뒤에
    approve_latest(people, r.json())
    pub = people.use(None).get(f"/api/store/apps/{code}").json()
    assert [x["version"] for x in pub["releases"]] == ["2.0.0", "1.0.0"]
    assert people.use(None).get("/api/store/apps").json()["apps"][0]["version"] == "2.0.0"


def test_rejected_app_can_be_resubmitted(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = submit(dev, version="1.0.0")
    admin = people.use(ADMIN)
    assert admin.post(f"/api/store/admin/releases/{app['releases'][0]['id']}/reject", json={"reason": ""}).status_code == 400
    r = admin.post(f"/api/store/admin/releases/{app['releases'][0]['id']}/reject", json={"reason": "설명이 실제 기능과 다릅니다"})
    assert r.json()["status"] == "rejected" and r.json()["status_reason"] == "설명이 실제 기능과 다릅니다"
    dev = people.use("dev@example.com")
    a = upload(dev, make_pe(0x8664, b"fixed" * 30))
    again = dev.post(f"/api/store/apps/{app['code']}/releases", json={"upload_id": a["upload_id"], "version": "1.0.0"})
    assert again.status_code == 201 and again.json()["status"] == "pending"
    assert len(again.json()["releases"]) == 1


# ── 권한 ──


def test_admin_endpoints_need_admin(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = submit(dev)
    rid = app["releases"][0]["id"]
    assert dev.get("/api/store/admin/overview").status_code == 403
    assert dev.post(f"/api/store/admin/releases/{rid}/approve").status_code == 403
    assert dev.post(f"/api/store/admin/apps/{app['code']}/hide", json={"reason": "x"}).status_code == 403
    assert people.use(None).get("/api/store/admin/overview").status_code == 401
    overview = people.use(ADMIN).get("/api/store/admin/overview").json()
    assert [a["code"] for a in overview["pending"]] == [app["code"]]
    assert overview["pending"][0]["owner"]["email"] == "dev@example.com"


def test_owner_can_edit_and_delete_but_others_cannot(people: Accounts, store_settings: Settings) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    code = app["code"]
    other = people.use("other@example.com")
    assert other.patch(f"/api/store/apps/{code}", json={"name": "가로채기"}).status_code == 404
    assert other.delete(f"/api/store/apps/{code}").status_code == 404
    dev = people.use("dev@example.com")
    r = dev.patch(f"/api/store/apps/{code}", json={"name": " 새 이름 ", "category": "game"})
    assert r.json()["name"] == "새 이름" and r.json()["category_label"] == "게임"
    assert dev.patch(f"/api/store/apps/{code}", json={"category": "weapons"}).status_code == 400
    assert dev.delete(f"/api/store/apps/{code}").status_code == 204
    assert rows(dev, StoreApp) == [] and list((store_settings.store_dir / "files").iterdir()) == []


def test_admin_can_edit_member_apps(people: Accounts, caplog) -> None:  # noqa: ANN001
    import io
    import logging

    from PIL import Image

    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]

    # 검토 대기 중에도 운영자가 고친다. 상태는 그대로이고, 응답에 올린 사람이 함께 온다 (검토 화면)
    admin = people.use(ADMIN)
    with caplog.at_level(logging.INFO, logger="johnnystudio.store"):
        r = admin.patch(f"/api/store/apps/{code}", json={"name": "고친 이름", "summary": "오타 고침", "category": "game"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "고친 이름" and r.json()["category_label"] == "게임"
    assert r.json()["status"] == "pending" and r.json()["owner"]["email"] == "dev@example.com"
    assert any("운영자가 앱 정보를 고침" in m for m in caplog.messages)
    assert admin.patch(f"/api/store/apps/{code}", json={"name": " "}).status_code == 400  # 같은 검사를 거친다

    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 120, 200)).save(buf, format="PNG")
    r = admin.put(f"/api/store/uploads/icons/{code}", content=buf.getvalue())
    assert r.status_code == 200 and r.json()["has_icon"] and r.json()["owner"]["email"] == "dev@example.com"

    mine = people.use("dev@example.com").get("/api/store/me/apps").json()["apps"][0]
    assert mine["name"] == "고친 이름" and mine["summary"] == "오타 고침" and mine["has_icon"] and "owner" not in mine

    # 차단된 회원은 자기 앱을 못 고치지만, 운영자는 고친다
    uid = admin_overview_owner_id(people, code)
    assert people.use(ADMIN).post(f"/api/store/admin/publishers/{uid}/block", json={"reason": "테스트"}).status_code == 200
    assert people.use("dev@example.com").patch(f"/api/store/apps/{code}", json={"name": "내가 고침"}).status_code == 403
    assert people.use(ADMIN).patch(f"/api/store/apps/{code}", json={"name": "운영자가 고침"}).status_code == 200


def test_owner_and_admin_can_delete_apps_and_versions(people: Accounts, store_settings: Settings, caplog) -> None:  # noqa: ANN001
    import logging

    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    code = app["code"]
    dev = people.use("dev@example.com")
    r = dev.post(f"/api/store/apps/{code}/releases", json={"upload_id": upload(dev, make_pe(0x8664, b"v2" * 300))["upload_id"], "version": "2.0.0"})
    assert r.status_code == 201, r.text
    first, second = sorted(rel["id"] for rel in r.json()["releases"])
    files = store_settings.store_dir / "files"
    assert len(list(files.iterdir())) == 2

    # 남은 못 지운다 (있는지도 알리지 않는다)
    other = people.use("other@example.com")
    assert other.delete(f"/api/store/apps/{code}/releases/{second}").status_code == 404
    assert other.delete(f"/api/store/apps/{code}").status_code == 404

    # 운영자가 남의 버전을 지운다 → 파일도 지워지고 로그에 남는다
    admin = people.use(ADMIN)
    with caplog.at_level(logging.INFO, logger="johnnystudio.store"):
        assert admin.delete(f"/api/store/apps/{code}/releases/{second}").status_code == 204
    assert any("버전 삭제 (운영자)" in m and "2.0.0" in m for m in caplog.messages)
    assert [rel["id"] for rel in people.use("dev@example.com").get("/api/store/me/apps").json()["apps"][0]["releases"]] == [first]
    assert len(list(files.iterdir())) == 1

    # 차단된 회원도 자기 앱은 지운다
    uid = next(a["owner"]["id"] for a in people.use(ADMIN).get("/api/store/admin/overview").json()["recent"] if a["code"] == code)
    assert people.use(ADMIN).post(f"/api/store/admin/publishers/{uid}/block", json={"reason": "테스트"}).status_code == 200
    second_app = submit_as_third_member(people)
    assert people.use("dev@example.com").delete(f"/api/store/apps/{code}").status_code == 204
    assert list(files.iterdir()) != [] and [a.code for a in rows(dev, StoreApp)] == [second_app]

    # 운영자가 남의 앱을 통째로 지운다
    with caplog.at_level(logging.INFO, logger="johnnystudio.store"):
        assert people.use(ADMIN).delete(f"/api/store/apps/{second_app}").status_code == 204
    assert any("앱 삭제 (운영자)" in m for m in caplog.messages)
    assert rows(dev, StoreApp) == [] and list(files.iterdir()) == []


def submit_as_third_member(people: Accounts) -> str:
    """또 다른 회원의 앱 (운영자가 지울 대상)"""
    c = people.use("third@example.com")
    become_publisher(c, "세 번째 개발자")
    return submit(c)["code"]


def admin_overview_owner_id(people: Accounts, code: str) -> str:
    overview = people.use(ADMIN).get("/api/store/admin/overview").json()
    return next(a["owner"]["id"] for a in overview["pending"] if a["code"] == code)


# ── 신고·숨김·차단 ──


def test_reports_are_rate_limited_and_resolved(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    code = app["code"]
    guest = people.use(None)
    assert guest.post(f"/api/store/apps/{code}/reports", json={"reason": "malware", "detail": "짧음"}).status_code == 400
    for _ in range(5):
        r = guest.post(f"/api/store/apps/{code}/reports", json={"reason": "malware", "detail": "설치하면 백신이 경고합니다", "contact": "me@example.org"})
        assert r.status_code == 202
    assert guest.post(f"/api/store/apps/{code}/reports", json={"reason": "malware", "detail": "설치하면 백신이 경고합니다"}).status_code == 429
    admin = people.use(ADMIN)
    reports = admin.get("/api/store/admin/overview").json()["reports"]
    assert len(reports) == 5 and reports[0]["reason_label"] == "악성코드·유해 프로그램" and reports[0]["contact"] == "me@example.org"
    assert admin.post(f"/api/store/admin/reports/{reports[0]['id']}/resolve", json={"status": "dismissed", "note": "확인함"}).status_code == 200
    assert len(admin.get("/api/store/admin/overview").json()["reports"]) == 4


def test_hide_and_block(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    code = app["code"]
    admin = people.use(ADMIN)
    assert admin.post(f"/api/store/admin/apps/{code}/hide", json={"reason": "권리 침해 신고 검토 중"}).json()["status"] == "hidden"
    assert people.use(None).get(f"/api/store/apps/{code}").status_code == 404
    mine = people.use("dev@example.com").get(f"/api/store/apps/{code}").json()
    assert mine["status"] == "hidden" and mine["status_reason"] == "권리 침해 신고 검토 중"
    admin = people.use(ADMIN)
    assert admin.post(f"/api/store/admin/apps/{code}/unhide").json()["status"] == "published"

    owner_id = admin.get("/api/store/admin/overview").json()["recent"][0]["owner"]["id"]
    assert admin.post(f"/api/store/admin/publishers/{owner_id}/block", json={"reason": "악성 파일 반복 업로드"}).status_code == 200
    assert people.use(None).get("/api/store/apps").json()["apps"] == []
    dev = people.use("dev@example.com")
    r = dev.post("/api/store/uploads", json={"file_name": "a.exe", "size": 10})
    assert r.json()["detail"]["code"] == "blocked" and "악성 파일 반복 업로드" in r.json()["detail"]["message"]
    admin = people.use(ADMIN)
    assert admin.get("/api/store/admin/overview").json()["blocked"][0]["email"] == "dev@example.com"
    assert admin.post(f"/api/store/admin/publishers/{owner_id}/unblock").status_code == 200
    assert len(people.use(None).get("/api/store/apps").json()["apps"]) == 1


def test_search_and_category_filter(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    approve_latest(people, submit(people.use("dev@example.com"), name="Alpha Notes", category="productivity"))
    approve_latest(people, submit(people.use("dev@example.com"), data=make_pe(0x8664, b"b" * 99), name="Beta Game", category="game"))
    guest = people.use(None)
    assert [a["name"] for a in guest.get("/api/store/apps?sort=name").json()["apps"]] == ["Alpha Notes", "Beta Game"]
    assert [a["name"] for a in guest.get("/api/store/apps?q=beta").json()["apps"]] == ["Beta Game"]
    assert [a["name"] for a in guest.get("/api/store/apps?category=productivity").json()["apps"]] == ["Alpha Notes"]
    assert guest.get("/api/store/apps?q=%25").json()["apps"] != []  # % 는 와일드카드로 쓰지 않는다 (빈 검색과 같다)


# ── 탈퇴 ──


def test_account_deletion_removes_store_content(people: Accounts, store_settings: Settings) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    people.use(None).post(f"/api/store/apps/{app['code']}/reports", json={"reason": "spam", "detail": "같은 앱을 여러 번 올렸습니다"})
    dev = people.use("dev@example.com")
    upload(dev, make_pe(0x8664, b"waiting" * 20))  # 등록하지 않은 업로드도 지운다
    assert dev.delete("/api/account").status_code == 204
    assert rows(dev, StoreApp) == [] and rows(dev, StoreRelease) == [] and rows(dev, StoreUpload) == []
    for sub in ("files", "icons", "uploads"):
        assert list((store_settings.store_dir / sub).iterdir()) == []
    report = rows(dev, StoreReport)[0]
    assert report.app_id is None and report.app_code == app["code"]  # 신고 기록은 남는다


# ── 아이콘 ──


def test_custom_icon_is_redrawn_as_png(people: Accounts, store_settings: Settings) -> None:
    import io

    from PIL import Image

    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = approve_latest(people, submit(dev))
    code = app["code"]
    assert not app["has_icon"]
    buf = io.BytesIO()
    Image.new("RGB", (64, 32), (200, 30, 30)).save(buf, format="JPEG")
    dev = people.use("dev@example.com")
    r = dev.put(f"/api/store/uploads/icons/{code}", content=buf.getvalue())
    assert r.status_code == 200, r.text
    assert r.json()["has_icon"]
    icon = people.use(None).get(f"/api/store/apps/{code}/icon")
    assert icon.headers["content-type"] == "image/png" and icon.headers["x-content-type-options"] == "nosniff"
    with Image.open(io.BytesIO(icon.content)) as out:
        assert out.format == "PNG" and out.size == (256, 256)
        center = out.getpixel((128, 128))
        assert all(abs(a - b) <= 8 for a, b in zip(center[:3], (200, 30, 30), strict=True))  # JPEG 라서 색이 조금 다르다
        assert out.getpixel((128, 10))[3] == 0  # 비율을 지켜서 키웠다 (위아래는 투명)
    assert list((store_settings.store_dir / "uploads").iterdir()) == []

    dev = people.use("dev@example.com")
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert dev.put(f"/api/store/uploads/icons/{code}", content=svg).status_code == 415
    assert dev.put(f"/api/store/uploads/icons/{code}", content=b"\x00" * (1024 * 1024 + 1)).status_code == 413
    assert people.use("other@example.com").put(f"/api/store/uploads/icons/{code}", content=buf.getvalue()).status_code == 404


def test_public_downloads_can_point_to_a_separate_files_origin(store_settings: Settings, mailer: FakeMailer) -> None:
    for c in make_client(replace(store_settings, store_files_origin="https://dl.example.net"), mailer):
        people = Accounts(c, mailer)
        dev = people.use("dev@example.com")
        become_publisher(dev)
        app = approve_latest(people, submit(dev))
        code, rid = app["code"], app["releases"][0]["id"]
        path = f"/api/store/apps/{code}/releases/{rid}/download"
        assert people.use(None).get(f"/api/store/apps/{code}").json()["releases"][0]["download_url"] == f"https://dl.example.net{path}"
        # 올린 사람·운영자 화면(검토용)은 로그인 쿠키가 있는 이 사이트에서 받는다
        assert people.use("dev@example.com").get(f"/api/store/apps/{code}").json()["releases"][0]["download_url"] == path


def test_files_origin_must_be_a_bare_origin() -> None:
    from app.config import ConfigError, load_settings

    assert load_settings({"JOHNNYSTUDIO_STORE_FILES_ORIGIN": "https://dl.example.net/"}).store_files_origin == "https://dl.example.net"
    with pytest.raises(ConfigError):
        load_settings({"JOHNNYSTUDIO_STORE_FILES_ORIGIN": "https://dl.example.net/files"})

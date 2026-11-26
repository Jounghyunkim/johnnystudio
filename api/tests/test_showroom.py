"""Showroom API (ADR-0012): 회원이 만든 웹 서비스를 운영자가 승인한 뒤 공개한다."""

from __future__ import annotations

import io
from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app.config import Settings
from app.showroom import service
from app.showroom.models import ShowroomReport, ShowroomService
from tests.conftest import FakeMailer, make_client
from tests.test_store import ADMIN, Accounts, become_publisher

SITE_URL = "https://notes.example.com/app?lang=ko"


@pytest.fixture
def store_settings(settings: Settings, tmp_path) -> Settings:  # noqa: ANN001
    return replace(settings, store_dir=tmp_path / "store", store_admins=frozenset({ADMIN}), store_clamscan="")


@pytest.fixture
def people(store_settings: Settings, mailer: FakeMailer) -> Iterator[Accounts]:
    for c in make_client(store_settings, mailer):
        yield Accounts(c, mailer)


def submit(c: TestClient, **fields) -> dict:  # noqa: ANN003
    body = {"name": "메모 노트", "url": SITE_URL, "summary": "브라우저 메모장", "description": "첫 줄\n\n둘째 문단", "category": "productivity"} | fields
    r = c.post("/api/showroom/services", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def approve(people: Accounts, code: str) -> dict:
    r = people.use(ADMIN).post(f"/api/showroom/admin/services/{code}/approve")
    assert r.status_code == 200, r.text
    return r.json()


def png(w: int = 64, h: int = 64) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (w, h), (10, 120, 200, 255)).save(buf, format="PNG")
    return buf.getvalue()


def test_submit_review_publish(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    assert dev.post("/api/showroom/services", json={"name": "x", "url": SITE_URL}).json()["detail"]["code"] == "needs_publisher"
    become_publisher(dev)
    svc = submit(dev)
    code = svc["code"]
    assert svc["status"] == "pending" and svc["host"] == "notes.example.com" and svc["url"] == SITE_URL

    guest = people.use(None)
    assert guest.get("/api/showroom/services").json()["services"] == []
    assert guest.get(f"/api/showroom/services/{code}").status_code == 404
    assert people.use("other@example.com").get(f"/api/showroom/services/{code}").status_code == 404
    assert people.use("dev@example.com").get(f"/api/showroom/services/{code}").json()["viewer"]["owner"]

    approve(people, code)
    guest = people.use(None)
    cards = guest.get("/api/showroom/services").json()["services"]
    assert [c["code"] for c in cards] == [code] and cards[0]["publisher"] == "개발자 김"
    detail = guest.get(f"/api/showroom/services/{code}").json()
    assert detail["description"] == "첫 줄\n\n둘째 문단" and "status" not in detail and "owner" not in detail


@pytest.mark.parametrize(
    ("url", "ok"),
    [
        ("https://notes.example.com", True),
        ("  https://Notes.Example.com:8443/a?b=1#frag  ", True),
        ("http://notes.example.com", False),
        ("javascript:alert(1)", False),
        ("https://user:pw@notes.example.com", False),
        ("https://127.0.0.1/", False),
        ("https://[::1]/", False),
        ("https://localhost/", False),
        ("https://intranet/", False),
        ("https://exa mple.com", False),
        ("ftp://example.com", False),
    ],
)
def test_url_rules(url: str, ok: bool) -> None:
    assert (service.clean_url(url) is not None) is ok
    if url.strip().startswith("https://Notes"):
        assert service.clean_url(url) == "https://notes.example.com:8443/a?b=1"  # 소문자 호스트, # 뒤는 버린다


def test_changing_url_after_approval_needs_review_again(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    approve(people, code)
    dev = people.use("dev@example.com")
    # 글만 고치면 공개 그대로
    assert dev.patch(f"/api/showroom/services/{code}", json={"summary": "새 소개", "category": "ai"}).json()["status"] == "published"
    assert dev.patch(f"/api/showroom/services/{code}", json={"url": "http://evil.example"}).status_code == 400
    r = dev.patch(f"/api/showroom/services/{code}", json={"url": "https://other.example.org/"}).json()
    assert r["status"] == "pending" and "다시 검토" in r["status_reason"]
    assert people.use(None).get(f"/api/showroom/services/{code}").status_code == 404
    approve(people, code)
    assert people.use(None).get(f"/api/showroom/services/{code}").json()["url"] == "https://other.example.org/"


def test_rejected_service_goes_back_to_review_when_edited(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    admin = people.use(ADMIN)
    assert admin.post(f"/api/showroom/admin/services/{code}/reject", json={"reason": "주소가 열리지 않습니다"}).json()["status"] == "rejected"
    r = people.use("dev@example.com").patch(f"/api/showroom/services/{code}", json={"description": "주소를 고쳤습니다"}).json()
    assert r["status"] == "pending" and r["status_reason"] == ""


def test_images_are_redrawn(people: Accounts, store_settings: Settings) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    assert dev.put(f"/api/showroom/uploads/{code}/icon", content=png()).json()["has_icon"]
    assert dev.put(f"/api/showroom/uploads/{code}/screenshot", content=png(3200, 1800)).json()["has_screenshot"]
    assert dev.put(f"/api/showroom/uploads/{code}/screenshot", content=b"<svg onload=alert(1)>").status_code == 415
    assert dev.put(f"/api/showroom/uploads/{code}/icon", content=b"\x00" * (1024 * 1024 + 1)).status_code == 413
    assert people.use("other@example.com").put(f"/api/showroom/uploads/{code}/icon", content=png()).status_code == 404
    approve(people, code)
    guest = people.use(None)
    shot = guest.get(f"/api/showroom/services/{code}/screenshot")
    assert shot.headers["content-type"] == "image/webp" and shot.headers["x-content-type-options"] == "nosniff"
    with Image.open(io.BytesIO(shot.content)) as im:
        assert im.format == "WEBP" and im.size == (1600, 900)
    icon = guest.get(f"/api/showroom/services/{code}/icon")
    with Image.open(io.BytesIO(icon.content)) as im:
        assert im.format == "PNG" and im.size == (256, 256)
    assert list((store_settings.store_dir / "showroom" / "tmp").iterdir()) == []


def test_reports_hide_block(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    approve(people, code)
    guest = people.use(None)
    for _ in range(5):
        assert guest.post(f"/api/showroom/services/{code}/reports", json={"reason": "malware", "detail": "접속하면 다른 사이트로 넘어갑니다"}).status_code == 202
    assert guest.post(f"/api/showroom/services/{code}/reports", json={"reason": "malware", "detail": "접속하면 다른 사이트로 넘어갑니다"}).status_code == 429
    admin = people.use(ADMIN)
    overview = admin.get("/api/showroom/admin/overview").json()
    assert len(overview["reports"]) == 5 and overview["recent"][0]["owner"]["email"] == "dev@example.com"
    assert admin.post(f"/api/showroom/admin/services/{code}/hide", json={"reason": "신고 확인 중"}).json()["status"] == "hidden"
    assert people.use(None).get("/api/showroom/services").json()["services"] == []
    # 다시 공개하려면 검토 대기를 거친다
    assert people.use(ADMIN).post(f"/api/showroom/admin/services/{code}/unhide").json()["status"] == "pending"
    approve(people, code)
    # Store 에서 회원을 차단하면 Showroom 에서도 빠진다 (올리는 회원 정보를 함께 쓴다)
    admin = people.use(ADMIN)
    owner_id = admin.get("/api/showroom/admin/overview").json()["recent"][0]["owner"]["id"]
    assert admin.post(f"/api/store/admin/publishers/{owner_id}/block", json={"reason": "피싱 사이트"}).status_code == 200
    assert people.use(None).get("/api/showroom/services").json()["services"] == []
    assert people.use("dev@example.com").post("/api/showroom/services", json={"name": "x", "url": SITE_URL}).json()["detail"]["code"] == "blocked"


def test_admin_endpoints_need_admin(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    assert dev.get("/api/showroom/admin/overview").status_code == 403
    assert dev.post(f"/api/showroom/admin/services/{code}/approve").status_code == 403
    assert people.use(None).get("/api/showroom/admin/overview").status_code == 401


def test_admin_can_edit_and_delete_member_services(people: Accounts, store_settings: Settings, caplog) -> None:  # noqa: ANN001
    import logging

    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    approve(people, code)

    # 운영자가 남의 서비스를 고친다. 주소를 바꿔도 공개 그대로이고(운영자가 본 주소), 응답에 소개한 사람이 함께 온다 (검토 화면)
    with caplog.at_level(logging.INFO, logger="johnnystudio.showroom"):
        r = people.use(ADMIN).patch(f"/api/showroom/services/{code}", json={"name": "고친 이름", "url": "https://fixed.example.org/", "category": "ai"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "고친 이름" and body["url"] == "https://fixed.example.org/" and body["status"] == "published"
    assert body["owner"]["email"] == "dev@example.com"
    assert any("운영자가 서비스 정보를 고침" in m for m in caplog.messages)
    assert people.use(ADMIN).patch(f"/api/showroom/services/{code}", json={"url": "http://evil.example"}).status_code == 400  # 같은 검사를 거친다
    assert people.use(None).get(f"/api/showroom/services/{code}").json()["url"] == "https://fixed.example.org/"

    # 아이콘·소개 자료도 고친다
    r = people.use(ADMIN).put(f"/api/showroom/uploads/{code}/icon", content=png())
    assert r.status_code == 200 and r.json()["has_icon"] and r.json()["owner"]["email"] == "dev@example.com"
    r = people.use(ADMIN).put(f"/api/showroom/services/{code}/page", json={"pricing": "무료 (운영자가 고침)"})
    assert r.status_code == 200, r.text
    assert r.json()["page"]["pricing"] == "무료 (운영자가 고침)" and r.json()["status"] == "published"
    mine = people.use("dev@example.com").get("/api/showroom/me/services").json()["services"][0]
    assert mine["name"] == "고친 이름" and mine["has_icon"] and "owner" not in mine

    # 반려된 서비스를 운영자가 고쳐도 대신 다시 내지 않는다 (소개한 사람이 고치면 다시 검토 대기)
    assert people.use(ADMIN).post(f"/api/showroom/admin/services/{code}/reject", json={"reason": "시험"}).status_code == 200
    assert people.use(ADMIN).patch(f"/api/showroom/services/{code}", json={"summary": "운영자가 고침"}).json()["status"] == "rejected"
    assert people.use(ADMIN).put(f"/api/showroom/services/{code}/page", json={"pricing": "무료"}).json()["status"] == "rejected"

    # 차단된 회원은 자기 서비스를 못 고치지만, 운영자는 고친다
    owner_id = body["owner"]["id"]
    assert people.use(ADMIN).post(f"/api/store/admin/publishers/{owner_id}/block", json={"reason": "시험"}).status_code == 200
    assert people.use("dev@example.com").patch(f"/api/showroom/services/{code}", json={"name": "내가 고침"}).status_code == 403
    assert people.use(ADMIN).patch(f"/api/showroom/services/{code}", json={"name": "운영자가 고침"}).status_code == 200

    # 다른 회원은 고치지도 지우지도 못한다 (있는지도 알리지 않는다)
    assert people.use("other@example.com").patch(f"/api/showroom/services/{code}", json={"name": "남이 고침"}).status_code == 404
    assert people.use("other@example.com").delete(f"/api/showroom/services/{code}").status_code == 404

    # 운영자가 지운다 → 그림도 지워지고 로그에 남는다
    with caplog.at_level(logging.INFO, logger="johnnystudio.showroom"):
        assert people.use(ADMIN).delete(f"/api/showroom/services/{code}").status_code == 204
    assert any("서비스 삭제 (운영자)" in m and code in m for m in caplog.messages)
    assert people.use("dev@example.com").get("/api/showroom/me/services").json()["services"] == []
    assert list((store_settings.store_dir / "showroom" / "icons").iterdir()) == []


def test_daily_limit(people: Accounts, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(service, "DAILY_SUBMISSIONS", 2)
    dev = people.use("dev@example.com")
    become_publisher(dev)
    submit(dev)
    submit(dev, name="둘째")
    assert dev.post("/api/showroom/services", json={"name": "셋째", "url": SITE_URL}).json()["detail"]["code"] == "daily_limit"


def test_account_deletion_removes_services(people: Accounts, store_settings: Settings) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    code = submit(dev)["code"]
    dev.put(f"/api/showroom/uploads/{code}/icon", content=png())
    approve(people, code)
    people.use(None).post(f"/api/showroom/services/{code}/reports", json={"reason": "spam", "detail": "광고만 있는 사이트입니다"})
    dev = people.use("dev@example.com")
    assert dev.delete("/api/account").status_code == 204
    with dev.app.state.db.new_session() as s:
        assert list(s.scalars(select(ShowroomService))) == []
        report = s.scalars(select(ShowroomReport)).one()
        assert report.service_id is None and report.service_code == code
    assert list((store_settings.store_dir / "showroom" / "icons").iterdir()) == []

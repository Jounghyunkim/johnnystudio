"""소개 자료 (ADR-0013): Store 앱·Showroom 서비스의 기능·사용 방법·질문·링크·그림 모음."""

from __future__ import annotations

import io
from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app import listing
from app.config import Settings
from app.showroom.models import ShowroomServicePage
from app.store.models import StoreAppPage
from tests.conftest import FakeMailer, make_client, make_pe
from tests.test_store import ADMIN, Accounts, approve_latest, become_publisher, submit, upload

SITE_URL = "https://notes.example.com/"


@pytest.fixture
def store_settings(settings: Settings, tmp_path) -> Settings:  # noqa: ANN001
    return replace(settings, store_dir=tmp_path / "store", store_admins=frozenset({ADMIN}), store_clamscan="")


@pytest.fixture
def people(store_settings: Settings, mailer: FakeMailer) -> Iterator[Accounts]:
    for c in make_client(store_settings, mailer):
        yield Accounts(c, mailer)


def picture(w: int = 1920, h: int = 1200, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (30, 90, 160)).save(buf, format=fmt)
    return buf.getvalue()


def full_page(gallery: list[dict]) -> dict:
    return {
        "keywords": ["메모", " 노트 ", "메모", ""],
        "audience": ["회의록을 자주 쓰는 분"],
        "features": [
            {"title": "빠른 메모", "text": "단축키 하나로\n바로 씁니다.", "image": gallery[0]["id"] if gallery else None},
            {"title": "", "text": ""},  # 빈 칸은 버린다
        ],
        "steps": ["설치한다", "실행한다"],
        "requirements": ["Windows 10 이상"],
        "pricing": "무료",
        "faq": [{"q": "무료인가요?", "a": "네, 무료입니다."}],
        "links": [{"label": "GitHub", "url": "https://github.com/example/notes"}],
        "gallery": [{"id": g["id"], "caption": f"화면 {i + 1}"} for i, g in enumerate(gallery)],
    }


def store_app(people: Accounts) -> tuple[TestClient, dict]:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    return dev, submit(dev)


def test_store_page_and_gallery_flow(people: Accounts, store_settings: Settings) -> None:
    dev, app = store_app(people)
    code = app["code"]
    assert app["page"] == listing.empty_page()

    r = dev.put(f"/api/store/uploads/gallery/{code}", content=picture())
    assert r.status_code == 201, r.text
    first = r.json()["image"]
    assert first["width"] == 1600 and first["height"] == 1000  # 긴 변 1600px 로 줄인다
    second = dev.put(f"/api/store/uploads/gallery/{code}", content=picture(800, 600, "JPEG")).json()["image"]
    path = store_settings.store_dir / "gallery" / "store" / code / f"{first['id']}.webp"
    assert path.read_bytes()[8:12] == b"WEBP"

    # 순서를 바꾸고 설명을 단다
    r = dev.put(f"/api/store/apps/{code}/page", json=full_page([second, first]))
    assert r.status_code == 200, r.text
    page = r.json()["page"]
    assert page["keywords"] == ["메모", "노트"]
    assert [g["id"] for g in page["gallery"]] == [second["id"], first["id"]]
    assert page["gallery"][0]["caption"] == "화면 1" and page["gallery"][0]["width"] == 800
    assert page["features"] == [{"title": "빠른 메모", "text": "단축키 하나로\n바로 씁니다.", "image": second["id"]}]
    assert page["links"] == [{"label": "GitHub", "url": "https://github.com/example/notes"}]

    # 검토 전에는 남에게 그림도 보이지 않는다
    guest = people.use(None)
    assert guest.get(f"/api/store/apps/{code}/gallery/{first['id']}").status_code == 404
    approve_latest(people, app)
    guest = people.use(None)
    r = guest.get(f"/api/store/apps/{code}/gallery/{first['id']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp"
    assert r.headers["x-content-type-options"] == "nosniff" and "max-age" in r.headers["cache-control"]
    assert guest.get(f"/api/store/apps/{code}/gallery/{'0' * 16}").status_code == 404
    assert guest.get(f"/api/store/apps/{code}/gallery/..%2F..%2Fx").status_code == 404
    assert guest.get(f"/api/store/apps/{code}").json()["page"]["pricing"] == "무료"

    # 연관 검색어로도 찾는다
    assert [a["code"] for a in guest.get("/api/store/apps?q=노트").json()["apps"]] == [code]
    assert guest.get("/api/store/apps?q=없는말").json()["apps"] == []

    # 그림 모음에서 뺀 그림은 파일도 지운다. 기능에 연결한 그림이 빠지면 연결도 끊는다
    dev = people.use("dev@example.com")
    r = dev.put(f"/api/store/apps/{code}/page", json=full_page([first]) | {"features": [{"title": "빠른 메모", "image": second["id"]}]})
    assert r.status_code == 200, r.text
    assert r.json()["page"]["features"][0]["image"] is None
    assert not (store_settings.store_dir / "gallery" / "store" / code / f"{second['id']}.webp").exists()
    assert path.exists()

    # 앱을 지우면 그림 폴더와 소개 자료도 지운다
    assert dev.delete(f"/api/store/apps/{code}").status_code == 204
    assert not path.parent.exists()
    with dev.app.state.db.new_session() as s:
        assert list(s.scalars(select(StoreAppPage))) == []


def test_store_page_validation(people: Accounts) -> None:
    dev, app = store_app(people)
    code = app["code"]

    def bad(page: dict) -> str:
        r = dev.put(f"/api/store/apps/{code}/page", json=page)
        assert r.status_code == 400, r.text
        return r.json()["detail"]["message"]

    assert "올리지 않은 그림" in bad({"gallery": [{"id": "0123456789abcdef"}]})
    assert "https://" in bad({"links": [{"label": "홈", "url": "http://example.com"}]})
    assert "https://" in bad({"links": [{"label": "내부", "url": "https://192.168.0.1/"}]})
    # 한도는 Microsoft Store 등록 항목과 같게 둔다 (검색어 7개·30자, 제품 기능 20개, 스크린샷 설명 200자)
    assert "7개" in bad({"keywords": [f"말{i}" for i in range(8)]})
    assert "30자" in bad({"keywords": ["가" * 31]})
    assert "질문과 답" in bad({"faq": [{"q": "질문만", "a": ""}]})
    assert "이름" in bad({"features": [{"title": "", "text": "설명만 있다"}]})
    assert "150자" in bad({"features": [{"title": "기능", "text": "가" * 151}]})
    assert "20개" in bad({"features": [{"title": f"기능 {i}"} for i in range(21)]})
    assert "11개" in bad({"recommended": [f"권장 {i}" for i in range(12)]})
    assert "200자" in bad({"copyright": "가" * 201})
    assert "https://" in bad({"privacy_url": "http://example.com/privacy"})
    assert "이메일" in bad({"support": "not-an-email@"})
    assert "apps.microsoft.com" in bad({"ms_store_url": "https://apps.microsoft.com/detail/short"})
    assert "분류" in bad({"ms_category": "unknown"})
    # 제어 문자(방향 바꾸기 문자 포함)는 지운다
    r = dev.put(f"/api/store/apps/{code}/page", json={"steps": ["설치‮하기"], "pricing": "무료\x00"})
    assert r.status_code == 200 and r.json()["page"]["steps"] == ["설치하기"] and r.json()["page"]["pricing"] == "무료"


def test_store_page_microsoft_store_fields(people: Accounts) -> None:
    dev, app = store_app(people)
    body = {
        "developer": "개발자 김",
        "copyright": "© 2026 개발자 김",
        "license": "MIT",
        "website": "https://notes.example.com",
        "support": "help@notes.example.com",
        "privacy_url": "https://notes.example.com/privacy",
        "ms_store_url": "https://apps.microsoft.com/detail/9NBLGGH4NNS1?hl=ko-kr",
        "ms_category": "productivity",
        "requirements": ["Windows 10 이상"],
        "recommended": ["메모리 8GB"],
    }
    r = dev.put(f"/api/store/apps/{app['code']}/page", json=body)
    assert r.status_code == 200, r.text
    page = r.json()["page"]
    assert page | body | {"website": "https://notes.example.com/"} == page  # 주소는 정리해서 저장한다 (끝 /)
    assert dev.put(f"/api/store/apps/{app['code']}/page", json={"support": "https://notes.example.com/help"}).json()["page"]["support"] == "https://notes.example.com/help"
    meta = people.use(None).get("/api/store/meta").json()
    assert meta["listing"]["ms_categories"]["utilities-tools"].startswith("Utilities")
    assert people.use(None).get("/api/showroom/meta").json()["listing"] == meta["listing"]


def test_release_notes_follow_microsoft_store_limit(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    a = upload(dev, make_pe(0x8664, b"n" * 300))
    body = {"upload_id": a["upload_id"], "name": "도구", "category": "utility", "version": "1.0.0", "notes": "가" * 1501}
    r = dev.post("/api/store/apps", json=body)
    assert r.status_code == 400 and "1500자" in r.json()["detail"]["message"]


def test_store_gallery_limits_and_permissions(people: Accounts, monkeypatch) -> None:  # noqa: ANN001
    dev, app = store_app(people)
    code = app["code"]
    # 그림이 아니면 거부
    r = dev.put(f"/api/store/uploads/gallery/{code}", content=b"<svg xmlns='http://www.w3.org/2000/svg'/>")
    assert r.status_code == 415
    r = dev.put(f"/api/store/uploads/gallery/{code}", content=b"x" * (listing.IMAGE_UPLOAD_MAX_BYTES + 1))
    assert r.status_code == 413
    # 다른 회원은 못 올리고 못 고친다 (404)
    other = people.use("other@example.com")
    assert other.put(f"/api/store/uploads/gallery/{code}", content=picture(64, 64)).status_code == 404
    assert other.put(f"/api/store/apps/{code}/page", json={}).status_code == 404
    # 운영자는 고친다 (ADR-0012 결정 9)
    admin = people.use(ADMIN)
    r = admin.put(f"/api/store/apps/{code}/page", json={"pricing": "무료 (운영자가 고침)"})
    assert r.status_code == 200 and r.json()["owner"]["email"] == "dev@example.com"
    # 그림은 10장까지
    dev = people.use("dev@example.com")
    monkeypatch.setattr(listing, "GALLERY_MAX", 2)
    monkeypatch.setattr("app.store.router.GALLERY_MAX", 2)
    for _ in range(2):
        assert dev.put(f"/api/store/uploads/gallery/{code}", content=picture(64, 64)).status_code == 201
    r = dev.put(f"/api/store/uploads/gallery/{code}", content=picture(64, 64))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "gallery_full"


def test_long_description_is_allowed(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    app = submit(dev, description="## 소개\n\n" + "가" * 9000)
    assert len(app["description"]) > 9000
    r = dev.patch(f"/api/store/apps/{app['code']}", json={"description": "가" * 10001})
    assert r.status_code == 400 and "10000자" in r.json()["detail"]["message"]


# ── Showroom ──


def showroom_service(people: Accounts) -> tuple[TestClient, dict]:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    r = dev.post("/api/showroom/services", json={"name": "메모 노트", "url": SITE_URL, "summary": "메모장", "category": "productivity"})
    assert r.status_code == 201, r.text
    return dev, r.json()


def test_showroom_page_and_gallery_flow(people: Accounts, store_settings: Settings) -> None:
    dev, svc = showroom_service(people)
    code = svc["code"]
    assert svc["page"]["gallery"] == []
    img = dev.put(f"/api/showroom/uploads/{code}/gallery", content=picture())
    assert img.status_code == 201, img.text
    image = img.json()["image"]
    r = dev.put(f"/api/showroom/services/{code}/page", json=full_page([image]))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending" and r.json()["page"]["gallery"][0]["caption"] == "화면 1"

    guest = people.use(None)
    assert guest.get(f"/api/showroom/services/{code}/gallery/{image['id']}").status_code == 404
    assert people.use(ADMIN).post(f"/api/showroom/admin/services/{code}/approve").status_code == 200
    guest = people.use(None)
    assert guest.get(f"/api/showroom/services/{code}/gallery/{image['id']}").status_code == 200
    assert [s["code"] for s in guest.get("/api/showroom/services?q=메모").json()["services"]] == [code]
    assert [s["code"] for s in guest.get("/api/showroom/services?q=노트").json()["services"]] == [code]

    # 공개 뒤 소개 자료를 고쳐도 공개 상태는 그대로다 (주소만 다시 검토한다)
    dev = people.use("dev@example.com")
    r = dev.put(f"/api/showroom/services/{code}/page", json=full_page([image]) | {"pricing": "무료 + 유료"})
    assert r.json()["status"] == "published"

    # 다른 회원은 Showroom 소개 자료를 고치지 못한다 (404). 운영자는 고친다 (Store 와 같다)
    assert people.use("other@example.com").put(f"/api/showroom/services/{code}/page", json={}).status_code == 404
    assert people.use("other@example.com").put(f"/api/showroom/uploads/{code}/gallery", content=picture(64, 64)).status_code == 404
    assert people.use(ADMIN).put(f"/api/showroom/uploads/{code}/gallery", content=picture(64, 64)).status_code == 201

    # 탈퇴하면 그림·소개 자료도 지운다
    folder = store_settings.store_dir / "gallery" / "showroom" / code
    assert folder.is_dir()
    dev = people.use("dev@example.com")
    assert dev.delete("/api/account").status_code == 204
    assert not folder.exists()
    with dev.app.state.db.new_session() as s:
        assert list(s.scalars(select(ShowroomServicePage))) == []


def test_showroom_rejected_service_goes_back_to_review_when_page_changes(people: Accounts) -> None:
    dev, svc = showroom_service(people)
    code = svc["code"]
    assert people.use(ADMIN).post(f"/api/showroom/admin/services/{code}/reject", json={"reason": "설명이 부족합니다"}).status_code == 200
    dev = people.use("dev@example.com")
    r = dev.put(f"/api/showroom/services/{code}/page", json={"steps": ["가입한다", "메모를 쓴다"]})
    assert r.status_code == 200 and r.json()["status"] == "pending"


def test_blocked_member_cannot_edit_page(people: Accounts) -> None:
    dev, svc = showroom_service(people)
    code = svc["code"]
    admin = people.use(ADMIN)
    owner_id = next(s["owner"]["id"] for s in admin.get("/api/showroom/admin/overview").json()["pending"] if s["code"] == code)
    assert admin.post(f"/api/store/admin/publishers/{owner_id}/block", json={"reason": "시험"}).status_code == 200
    dev = people.use("dev@example.com")
    assert dev.put(f"/api/showroom/services/{code}/page", json={}).status_code == 403
    assert dev.put(f"/api/showroom/uploads/{code}/gallery", content=picture(64, 64)).status_code == 403


def test_clean_page_unit() -> None:
    page = listing.clean_page(
        listing.PageIn(links=[{"label": "", "url": "https://Docs.Example.com/guide"}], audience=["  두 칸   띄움  "]),
        None,
    )
    assert page["links"] == [{"label": "docs.example.com", "url": "https://docs.example.com/guide"}]
    assert page["audience"] == ["두 칸 띄움"]
    assert listing.search_text({"keywords": ["Memo", "노트"]}) == "memo 노트"
    assert listing.page_out({"pricing": "무료", "unknown": 1}) == listing.empty_page() | {"pricing": "무료"}

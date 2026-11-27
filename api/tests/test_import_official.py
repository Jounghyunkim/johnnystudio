"""공식 앱·서비스를 Store·Showroom DB 로 옮기기 (ADR-0014, app/import_official.py)."""

from __future__ import annotations

import hashlib
import io
from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from PIL import Image
from sqlalchemy import select

from app import import_official
from app.config import Settings
from app.showroom.models import ShowroomService
from app.store import service as store
from app.store.models import StoreApp
from tests.conftest import FakeMailer, make_client, make_pe
from tests.test_store import ADMIN, Accounts, become_publisher, rows


@pytest.fixture
def store_settings(settings: Settings, tmp_path: Path) -> Settings:
    return replace(settings, store_dir=tmp_path / "store", store_admins=frozenset({ADMIN}), store_clamscan="")


def https(settings: Settings) -> Settings:
    """운영처럼 사이트 주소가 https 일 때 (소개 자료의 웹 사이트 칸에 Library 주소가 들어간다). 요청의 출처 검사와는 상관없다"""
    return replace(settings, site_url="https://johnnystudio.example")


@pytest.fixture
def people(store_settings: Settings, mailer: FakeMailer) -> Iterator[Accounts]:
    for c in make_client(store_settings, mailer):
        yield Accounts(c, mailer)


def picture(path: Path, size: tuple[int, int] = (64, 64)) -> Path:
    buf = io.BytesIO()
    Image.new("RGB", size, (20, 120, 200)).save(buf, format="PNG")
    path.write_bytes(buf.getvalue())
    return path


def store_item(tmp_path: Path, **over: Any) -> dict[str, Any]:  # noqa: ANN401
    exe = tmp_path / "files" / "cmg" / "CMG-Setup-1.0.0.exe"
    exe.parent.mkdir(parents=True, exist_ok=True)
    exe.write_bytes(make_pe(0x8664, b"cmg" * 200))
    data = exe.read_bytes()
    item = {
        "kind": "store",
        "slug": "cmg-monitor",
        "title": "CMG Monitor",
        "summary": "시스템 모니터",
        "date": "2026-11-16",
        "tags": ["시스템", "데스크톱"],
        "description": "첫 문단\n\n## 기능\n\n- CPU",
        "images": [{"path": str(picture(tmp_path / "shot.png", (320, 200))), "alt": "메인 화면"}],
        "links": [{"label": "GitHub", "url": "https://github.com/example/cmg"}, {"label": "내부", "url": "/about/"}],
        "icon": str(picture(tmp_path / "icon.png")),
        "cover": None,
        "requirements": "Windows 10/11 (x64)",
        "microsoftStore": "https://apps.microsoft.com/detail/9PCP2R7RSDQ8?hl=ko-kr&gl=KR",
        "code": None,
        "downloads": [
            {
                "label": "Windows",
                "path": str(exe),
                "fileName": exe.name,
                "version": "1.0.0",
                "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "released": "2026-11-16",
                "signed": False,
                "notes": "",
            }
        ],
    }
    return item | over


def showroom_item(tmp_path: Path) -> dict[str, Any]:
    return {
        "kind": "showroom",
        "slug": "arkurator",
        "title": "Arkurator",
        "summary": "AI 큐레이션",
        "date": "2025-12-19",
        "tags": ["AI", "웹"],
        "description": "설명",
        "images": [],
        "links": [],
        "icon": None,
        "cover": str(picture(tmp_path / "logo.png", (200, 200))),
        "url": "https://arkurator.net",
        "code": None,
    }


def test_imports_official_app_and_service_as_published_official(people: Accounts, store_settings: Settings, tmp_path: Path) -> None:
    people.use(ADMIN)  # 운영자 계정이 회원이어야 한다
    items = [store_item(tmp_path), showroom_item(tmp_path)]

    # 미리 보기: 아무것도 바꾸지 않는다
    outcomes, failed = import_official.run(store_settings, items, None, dry_run=True)
    assert failed == 0 and [o.note.startswith("옮길 예정") for o in outcomes] == [True, True]
    assert rows(people.use(None), StoreApp) == []

    outcomes, failed = import_official.run(https(store_settings), items, None, dry_run=False)
    assert failed == 0, outcomes
    app_code = next(o.code for o in outcomes if o.field == "storeApp")
    svc_code = next(o.code for o in outcomes if o.field == "showroomService")

    guest = people.use(None)
    card = guest.get("/api/store/apps").json()["apps"][0]
    assert card["code"] == app_code and card["official"] is True and card["publisher"] == "JohnnyStudio" and card["category"] == "system"
    detail = guest.get(f"/api/store/apps/{app_code}").json()
    assert detail["official"] and detail["has_icon"] and detail["releases"][0]["version"] == "1.0.0"
    assert detail["published_at"].startswith("2026-11-16")
    page = detail["page"]
    assert page["keywords"] == ["시스템", "데스크톱"] and page["requirements"] == ["Windows 10/11 (x64)"]
    assert page["ms_store_url"] == "https://apps.microsoft.com/detail/9PCP2R7RSDQ8?hl=ko-kr"  # 언어만 남긴다
    assert page["links"] == [{"label": "GitHub", "url": "https://github.com/example/cmg"}]  # 사이트 안 주소는 뺀다
    assert page["website"] == "https://johnnystudio.example/library/" and page["developer"] == "JohnnyStudio"
    assert [g["caption"] for g in page["gallery"]] == ["메인 화면"]
    # 설치 파일을 내려받으면 원본과 같다 (복사, 원본은 그대로)
    dl = guest.get(detail["releases"][0]["download_url"])
    assert dl.status_code == 200 and dl.content == Path(items[0]["downloads"][0]["path"]).read_bytes()
    assert Path(items[0]["downloads"][0]["path"]).is_file()

    svc = guest.get("/api/showroom/services").json()["services"][0]
    assert svc["code"] == svc_code and svc["official"] and svc["has_icon"] and svc["category"] == "ai"

    # 회원이 올린 앱은 공식이 아니다
    dev = people.use("dev@example.com")
    become_publisher(dev)
    assert people.use(None).get(f"/api/store/apps/{app_code}").json()["official"] is True
    assert people.use(ADMIN).get("/api/store/me/apps").json()["apps"][0]["official"] is True

    # 다시 돌리면 건너뛴다 (작품 파일에 코드를 적은 뒤, 또는 적기 전에 같은 이름)
    again, failed = import_official.run(store_settings, [store_item(tmp_path, code=app_code), showroom_item(tmp_path)], None, dry_run=False)
    assert failed == 0 and all(o.note.startswith("이미 있음") for o in again)
    assert [o.code for o in again] == [app_code, svc_code]
    assert len(rows(people.use(None), StoreApp)) == 1 and len(rows(people.use(None), ShowroomService)) == 1


def test_fresh_db_reuses_code_and_bad_files_are_skipped(people: Accounts, store_settings: Settings, tmp_path: Path) -> None:
    people.use(ADMIN)
    # 작품 파일에 코드가 있는데 DB 에 없으면 (새 DB) 같은 코드로 만든다
    outcomes, failed = import_official.run(store_settings, [store_item(tmp_path, code="Ab12Cd34")], None, dry_run=False)
    assert failed == 0 and outcomes[0].code == "Ab12Cd34"
    assert people.use(None).get("/api/store/apps/Ab12Cd34").status_code == 200

    # 크기·SHA-256 이 작품 파일과 다르면 옮기지 않는다 (다른 항목은 계속한다)
    bad = store_item(tmp_path, slug="other", title="다른 앱")
    bad["downloads"][0]["sha256"] = "0" * 64
    missing = store_item(tmp_path, slug="gone", title="없는 앱")
    missing["downloads"][0]["path"] = str(tmp_path / "nope.exe")
    outcomes, failed = import_official.run(store_settings, [bad, missing], None, dry_run=False)
    assert failed == 2 and outcomes == []
    with people.use(None).app.state.db.new_session() as s:
        assert [a.code for a in s.scalars(select(StoreApp))] == ["Ab12Cd34"]


def test_owner_must_be_admin_member(people: Accounts, store_settings: Settings, tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="DB 에 없습니다"):
        import_official.run(store_settings, [store_item(tmp_path)], None, dry_run=True)
    people.use(ADMIN)
    with pytest.raises(SystemExit, match="운영자 이메일"):
        import_official.run(store_settings, [store_item(tmp_path)], "dev@example.com", dry_run=True)


def test_fix_files_replaces_wrong_installer_of_existing_app(people: Accounts, store_settings: Settings, tmp_path: Path) -> None:
    people.use(ADMIN)
    # 운영자가 같은 이름의 앱을 이미 올렸는데, 0.1.2 버전에 엉뚱한 파일(소개 자료 zip 등)이 들어 있다
    wrong = store_item(tmp_path / "wrong")
    wrong["downloads"][0]["version"] = "1.0.0"
    outcomes, _ = import_official.run(store_settings, [wrong], None, dry_run=False)
    code = outcomes[0].code
    old_key = rows(people.use(None), StoreApp)[0].releases[0].storage_key
    right_dir = tmp_path / "right"
    right_dir.mkdir()
    right = store_item(right_dir)
    exe = Path(right["downloads"][0]["path"])
    exe.write_bytes(make_pe(0x8664, b"real" * 500))
    data = exe.read_bytes()
    right["downloads"][0] |= {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    # 옵션 없이: 알리기만 하고 바꾸지 않는다
    outcomes, failed = import_official.run(store_settings, [right], None, dry_run=False)
    assert failed == 0 and outcomes[0].code == code and "바꿈" not in outcomes[0].note
    assert people.use(None).get(f"/api/store/apps/{code}").json()["releases"][0]["sha256"] != right["downloads"][0]["sha256"]

    # --fix-files: 같은 버전의 파일만 진짜 설치 파일로 바꾼다. 코드·소개 자료는 그대로, 옛 파일은 지운다
    page_before = people.use(None).get(f"/api/store/apps/{code}").json()["page"]
    outcomes, failed = import_official.run(store_settings, [right], None, dry_run=False, fix_files=True)
    assert failed == 0 and "1.0.0 파일을 바꿈" in outcomes[0].note
    detail = people.use(None).get(f"/api/store/apps/{code}").json()
    assert detail["releases"][0]["sha256"] == right["downloads"][0]["sha256"] and detail["page"] == page_before
    assert people.use(None).get(detail["releases"][0]["download_url"]).content == data
    old_file = store.dirs(store_settings).release_file(old_key)
    assert not old_file.exists() and old_file.parent.is_dir()  # 지운 것은 옛 파일 하나뿐 (폴더는 그대로)
    # 다시 돌려도 더 바꿀 것이 없다
    outcomes, _ = import_official.run(store_settings, [right], None, dry_run=False, fix_files=True)
    assert "바꿈" not in outcomes[0].note

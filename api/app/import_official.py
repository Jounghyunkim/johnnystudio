"""공식 앱·서비스(운영자 작품)를 Store·Showroom DB 로 옮긴다 (ADR-0014).

scripts/import-official.sh 가 차례로 부른다:
  1. web 의 작품 관리 CLI 가 content/ 의 공식 앱·서비스를 JSON 으로 내보낸다 (official-export: 스키마 검사를 거친 값)
  2. 이 명령이 그 JSON 으로 DB 를 채우고, 작품 파일에 적을 코드를 JSON 으로 낸다
  3. CLI 가 그 코드를 작품 파일(storeApp·showroomService)에 적는다 (official-link)

직접 부를 때 (api/ 에서):
  uv run python -m app.import_official --input official.json --output links.json [--owner 운영자@이메일] [--dry-run]

- 주인: 운영자 계정(JOHNNYSTUDIO_STORE_ADMINS). 하나뿐이면 --owner 를 생략한다. 사이트에 한 번 이상 로그인해 회원이어야 한다.
- 여러 번 돌려도 된다: 작품 파일에 적힌 코드의 앱·서비스가 DB 에 있으면 건너뛴다. 코드가 없어도 같은 운영자에게 같은 이름이 있으면 그 코드를 잇는다.
  작품 파일에 코드가 있는데 DB 에 없으면(새로 만든 DB) 같은 코드로 다시 만든다 (Library 의 'Store에서 내려받기' 링크가 그대로 맞는다).
- 설치 파일은 복사한다 (다운로드 보관 폴더의 원본은 그대로). 작품 파일의 크기·SHA-256 과 다르면 그 앱은 옮기지 않는다.
- 회원이 올릴 때와 같은 길을 거친다: 확장자·내용 검사, 자식 프로세스 분석, 아이콘·그림 다시 그리기, 소개 자료 정리(한도).
- 바이러스 검사: ClamAV 가 있으면 바로 검사한다. 탐지되면 그 버전은 반려하고 파일을 지운다.
  검사가 필요한 설정(JOHNNYSTUDIO_STORE_REQUIRE_SCAN)인데 '탐지 없음'이 아니면 검토 대기로 둔다 (검토 화면에서 다시 검사·승인).
- 출력에 이메일을 찍지 않는다 (AGENTS.md: 로그에 이메일을 남기지 않는다).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit, urlunsplit

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import Settings, load_settings
from .db import Database, User, utcnow
from .listing import (
    CAPTION_LEN,
    GALLERY_MAX,
    IMAGE_UPLOAD_MAX_BYTES,
    KEYWORD_LEN,
    KEYWORDS_MAX,
    LINK_LABEL_LEN,
    LINKS_MAX,
    REQUIREMENT_LEN,
    Gallery,
    ListingError,
    PageIn,
    clean_page,
)
from .showroom import service as showroom
from .showroom.models import SERVICE_CATEGORIES, ShowroomService
from .store import service as store
from .store.analyze import BinaryValidationError, run_icon_isolated, run_isolated, validate_binary
from .store.files import new_storage_key, new_upload_id, remove, sha256_of
from .store.models import CATEGORIES, StoreApp, StorePublisher, StoreRelease, new_code
from .store.router import ARCHES, DESCRIPTION_MAX, ICON_MAX_BYTES, NOTES_MAX
from .store.scan import scan_file

PUBLISHER_NAME = "JohnnyStudio"


class Problem(Exception):
    """이 항목은 옮기지 않는다 (다른 항목은 계속한다)"""


@dataclass
class Outcome:
    slug: str
    field: str  # storeApp | showroomService
    code: str
    note: str


# ── 도우미 ──


def to_datetime(value: object) -> datetime | None:
    """작품 파일의 날짜(YYYY, YYYY-MM, YYYY-MM-DD) → 그날 0시 UTC"""
    if not value:
        return None
    parts = [int(x) for x in str(value).split("-")[:3]]
    while len(parts) < 3:
        parts.append(1)
    return datetime(parts[0], parts[1], parts[2], tzinfo=UTC)


def category_from_tags(tags: list[str], categories: dict[str, str]) -> str:
    """작품 태그 중 분류 이름과 같은 것 (Store 목록이 공식 앱을 나누던 규칙과 같다), 없으면 기타"""
    for key, label in categories.items():
        if label in tags:
            return key
    return "other"


def ms_store_url(url: str) -> str:
    """Microsoft Store 주소에서 언어(hl)만 남긴다 (소개 자료의 주소 규칙: ?hl= 하나만 받는다)"""
    if not url:
        return ""
    u = urlsplit(url)
    hl = parse_qs(u.query).get("hl", [""])[0]
    return urlunsplit(("https", u.netloc, u.path.rstrip("/"), f"hl={hl}" if hl else "", ""))


def is_https(url: str) -> bool:
    u = urlsplit(url)
    return u.scheme == "https" and "." in (u.hostname or "") and not u.username


def resolve_owner(db: Session, settings: Settings, email: str | None) -> User:
    admins = sorted(settings.store_admins)
    if email:
        email = email.strip().lower()
        if email not in settings.store_admins:
            raise SystemExit("✗ --owner 는 운영자 이메일(JOHNNYSTUDIO_STORE_ADMINS)이어야 합니다.")
    elif len(admins) == 1:
        email = admins[0]
    else:
        raise SystemExit("✗ 운영자가 없거나 여럿입니다. --owner 로 주인이 될 운영자 이메일을 정해 주세요.")
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        raise SystemExit("✗ 그 운영자 계정이 이 DB 에 없습니다. 사이트에서 그 이메일로 한 번 로그인(가입)한 뒤 다시 실행해 주세요.")
    return user


def ensure_publisher(db: Session, owner: User, dry_run: bool) -> None:
    if db.get(StorePublisher, owner.id) is None and not dry_run:
        now = utcnow()
        db.add(StorePublisher(user_id=owner.id, display_name=PUBLISHER_NAME, terms_version=store.TERMS_VERSION, agreed_at=now, created_at=now))
        db.commit()


def redraw_icon(src: str | None, dst: Path) -> bool:
    """작품 아이콘(또는 대표 그림)을 256px PNG 로 다시 그려 dst 에 둔다 (회원 아이콘과 같은 자식 프로세스)"""
    if not src or not Path(src).is_file():
        return False
    out = dst.parent / f".{new_upload_id()}.png"
    try:
        result = run_icon_isolated(Path(src), out)
        if "error" in result or not out.is_file() or out.stat().st_size > ICON_MAX_BYTES or out.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            return False
        out.replace(dst)
        return True
    finally:
        remove(out)


def save_gallery(settings: Settings, kind: str, code: str, images: list[dict[str, Any]], warn: list[str]) -> list[dict[str, Any]]:
    """본문의 그림을 소개 그림 모음으로 (WebP 로 다시 그린다, 10장까지)"""
    saved: list[dict[str, Any]] = []
    for img in images[:GALLERY_MAX]:
        path = Path(img["path"])
        if not path.is_file() or path.stat().st_size > IMAGE_UPLOAD_MAX_BYTES:
            warn.append(f"그림을 넣지 못함: {path.name}")
            continue
        try:
            g = Gallery(settings, kind, code).save(path.read_bytes())
        except ListingError as err:
            warn.append(f"그림을 넣지 못함: {path.name} ({err})")
            continue
        saved.append({**g, "caption": str(img.get("alt") or "")[:CAPTION_LEN]})
    if len(images) > GALLERY_MAX:
        warn.append(f"그림이 {len(images)}장이라 앞의 {GALLERY_MAX}장만 넣었습니다")
    return saved


def build_page(item: dict[str, Any], settings: Settings, gallery: list[dict[str, Any]]) -> dict[str, Any]:
    keywords: list[str] = []
    for tag in item.get("tags", []):
        t = str(tag).strip()[:KEYWORD_LEN]
        if t and t not in keywords:
            keywords.append(t)
    links = [{"label": str(lk["label"])[:LINK_LABEL_LEN], "url": lk["url"]} for lk in item.get("links", []) if is_https(str(lk.get("url", "")))][:LINKS_MAX]
    requirements = str(item.get("requirements") or "").strip()
    body = PageIn(
        keywords=keywords[:KEYWORDS_MAX],
        requirements=[requirements[:REQUIREMENT_LEN]] if requirements else [],
        links=links,  # type: ignore[arg-type]  (pydantic 이 dict 를 LinkIn 으로 바꾼다)
        gallery=[{"id": g["id"], "caption": g["caption"]} for g in gallery],  # type: ignore[misc]
        developer=PUBLISHER_NAME,
        # Library 상세 (사이트 주소가 https 일 때만. 개발 주소 127.0.0.1 은 소개 자료의 주소 규칙에 맞지 않는다)
        website=f"{settings.site_url}/library/{item['slug']}/" if is_https(settings.site_url) else "",
        ms_store_url=ms_store_url(str(item.get("microsoftStore") or "")),
    )
    return clean_page(body, {"gallery": gallery})


def unique_code(db: Session, model: type[StoreApp] | type[ShowroomService], wanted: str | None) -> str:
    if wanted and db.scalar(select(model.id).where(model.code == wanted)) is None:
        return wanted
    code = new_code()
    while db.scalar(select(model.id).where(model.code == code)) is not None:
        code = new_code()
    return code


# ── Store 앱 ──


@dataclass
class Checked:
    d: dict[str, Any]
    path: Path
    size: int
    sha: str
    file_type: str
    version: str


def check_download(settings: Settings, d: dict[str, Any]) -> Checked:
    """설치 파일이 있는가, 작품 파일의 크기·SHA-256 과 같은가, 한도 안인가, 확장자와 내용이 맞는가"""
    path = Path(d["path"]) if d.get("path") else None
    if path is None or not path.is_file():
        raise Problem(f"설치 파일이 없습니다: {d['fileName']} (다운로드 보관 폴더 JOHNNYSTUDIO_FILES_DIR 확인)")
    size = path.stat().st_size
    if d.get("size") is not None and d["size"] != size:
        raise Problem(f"{d['fileName']}: 크기가 작품 파일({d['size']})과 다릅니다 ({size})")
    if size > settings.store_file_max_mb * store.MB:
        raise Problem(f"{d['fileName']}: Store 파일 한도({settings.store_file_max_mb}MB)를 넘습니다")
    sha = sha256_of(path)
    if d.get("sha256") and d["sha256"] != sha:
        raise Problem(f"{d['fileName']}: SHA-256 이 작품 파일과 다릅니다")
    try:
        file_type = validate_binary(path, d["fileName"])
    except BinaryValidationError as err:
        raise Problem(f"{d['fileName']}: {err}") from None
    return Checked(d, path, size, sha, file_type, str(d["version"]).strip()[:40])


def store_file(settings: Settings, c: Checked, icon_out: Path, warn: list[str]) -> dict[str, Any]:
    """설치 파일을 분석(자식 프로세스)하고 Store 보관 폴더로 복사해 검사한다. 버전 행에 넣을 값을 돌려준다"""
    dirs = store.dirs(settings)
    dirs.ensure()
    analysis = run_isolated(c.path, c.d["fileName"], icon_out)
    key = new_storage_key()
    dst = dirs.release_file(key)
    shutil.copyfile(c.path, dst)
    if sha256_of(dst) != c.sha:
        remove(dst)
        raise Problem(f"{c.d['fileName']}: 복사한 파일이 원본과 다릅니다")
    scan = scan_file(dst, settings.store_clamscan, settings.store_file_max_mb)
    status = "published"
    if scan.status == "infected":
        status = "rejected"
        remove(dst)
        warn.append(f"{c.d['fileName']}: 바이러스 검사에서 탐지되어 공개하지 않았습니다")
    elif settings.store_require_scan and scan.status != "clean":
        status = "pending"
        warn.append(f"{c.d['fileName']}: 바이러스 검사 결과가 '탐지 없음'이 아니라 검토 대기로 둡니다 ({scan.status})")
    arch = str(analysis.get("architecture") or "unknown")
    return {
        "file_name": c.d["fileName"],
        "storage_key": key,
        "stored": status != "rejected",
        "size": c.size,
        "sha256": c.sha,
        "file_type": c.file_type,
        "arch": arch if arch in ARCHES else "unknown",
        "signed": bool(analysis.get("is_signed")) or bool(c.d.get("signed")),
        "meta": {k: analysis.get(k) for k in ("is_installer", "inner_path", "product_name", "company_name", "product_version", "legal_copyright")},
        "status": status,
        "scan_status": scan.status,
        "scan_engine": scan.engine[:80],
        "scan_detail": scan.detail[:300],
        "scanned_at": utcnow(),
    }


def check_existing_files(db: Session, settings: Settings, app: StoreApp, item: dict[str, Any], fix: bool, dry_run: bool, warn: list[str]) -> str:
    """이미 있는 앱: 작품 파일의 버전과 같은 버전의 설치 파일이 다르면 알린다. fix(--fix-files)면 진짜 설치 파일로 바꾼다.
    앱의 소개 자료·아이콘·코드·버전 기록(내려받은 횟수 등)은 그대로 둔다. 없는 버전은 더하지 않는다 (새 버전은 Store 에서 올린다)"""
    done: list[str] = []
    for d in item["downloads"]:
        version = str(d["version"]).strip()[:40]
        r = next((x for x in app.releases if x.version == version), None)
        if r is None:
            warn.append(f"DB 에 {version} 버전이 없습니다 (새 버전은 Store 의 '새 버전 올리기'로 올립니다)")
            continue
        c = check_download(settings, d)
        if r.sha256 == c.sha:
            continue
        if not fix:
            warn.append(f"{version} 의 설치 파일({r.file_name})이 작품 파일의 파일({c.d['fileName']})과 다릅니다. --fix-files 로 바꿀 수 있습니다")
            continue
        if dry_run:
            done.append(f"{version} 파일을 바꿀 예정: {r.file_name} → {c.d['fileName']}")
            continue
        old_key, old_stored = r.storage_key, r.stored
        icon_out = store.dirs(settings).upload_icon(new_upload_id())  # 앱 아이콘은 그대로 둔다 (꺼낸 아이콘은 버린다)
        try:
            fields = store_file(settings, c, icon_out, warn)
        finally:
            remove(icon_out)
        for k, v in fields.items():
            if k != "status":
                setattr(r, k, v)
        if fields["status"] != "published":
            r.status = fields["status"]
            r.status_reason = "바꾼 설치 파일을 다시 검사해야 합니다" if fields["status"] == "pending" else "ClamAV 가 악성코드를 탐지했습니다"
        app.updated_at = utcnow()
        db.commit()
        if old_stored:
            remove(store.dirs(settings).release_file(old_key))
        done.append(f"{version} 파일을 바꿈: {c.d['fileName']}")
    return f" · {' · '.join(done)}" if done else ""


def import_store_app(
    db: Session, settings: Settings, owner: User, item: dict[str, Any], dry_run: bool, warn: list[str], fix_files: bool = False
) -> Outcome:
    slug, name = item["slug"], store.clean_line(item["title"])[:80]
    code = item.get("code")
    if code:
        app = db.scalar(select(StoreApp).where(StoreApp.code == code))
        if app is not None:
            if app.owner_id != owner.id:
                raise Problem(f"작품 파일의 storeApp({code})이 다른 회원의 앱입니다. 작품 파일을 확인해 주세요.")
            return Outcome(slug, "storeApp", code, "이미 있음" + check_existing_files(db, settings, app, item, fix_files, dry_run, warn))
    same = db.scalar(select(StoreApp).where(StoreApp.owner_id == owner.id, StoreApp.name == name))
    if same is not None:
        return Outcome(slug, "storeApp", same.code, "이미 있음 (같은 이름, 코드를 잇는다)" + check_existing_files(db, settings, same, item, fix_files, dry_run, warn))

    # 설치 파일 확인: 있는가, 작품 파일의 크기·SHA-256 과 같은가, 확장자와 내용이 맞는가
    checked = [check_download(settings, d) for d in item["downloads"]]
    versions = {c.version for c in checked}
    if len(versions) != len(checked):
        raise Problem("같은 버전의 Windows 파일이 둘입니다")

    if dry_run:
        return Outcome(slug, "storeApp", code or "(새 코드)", f"옮길 예정: 버전 {', '.join(sorted(versions))}")

    now = utcnow()
    published_at = to_datetime(item.get("date")) or now
    description = store.clean_text(str(item.get("description") or ""))
    if len(description) > DESCRIPTION_MAX:
        warn.append(f"설명이 {DESCRIPTION_MAX}자를 넘어 잘랐습니다")
        description = description[:DESCRIPTION_MAX]
    app = StoreApp(
        code=unique_code(db, StoreApp, code),
        owner_id=owner.id,
        name=name,
        summary=store.clean_line(str(item.get("summary") or ""))[:160],
        description=description,
        category=category_from_tags(item.get("tags", []), CATEGORIES),
        status="published",
        created_at=published_at,
        updated_at=now,
        published_at=published_at,
    )
    db.add(app)
    db.flush()
    dirs = store.dirs(settings)
    dirs.ensure()
    written: list[Path] = []
    try:
        exe_icon: Path | None = None
        for c in checked:
            icon_out = dirs.upload_icon(new_upload_id())
            fields = store_file(settings, c, icon_out, warn)
            written.append(dirs.release_file(fields["storage_key"]))
            if icon_out.is_file() and exe_icon is None:
                exe_icon = icon_out
            else:
                remove(icon_out)
            app.releases.append(
                StoreRelease(
                    version=c.version,
                    notes=store.clean_text(str(c.d.get("notes") or ""))[:NOTES_MAX],
                    **fields,
                    status_reason="ClamAV 가 악성코드를 탐지했습니다" if fields["status"] == "rejected" else "",
                    created_at=to_datetime(c.d.get("released")) or published_at,
                    reviewed_at=now if fields["status"] == "published" else None,
                )
            )
        if not any(r.status == "published" for r in app.releases):
            app.status, app.published_at = "pending", None
        # 아이콘: 작품 아이콘 → 대표 그림 → 설치 파일에서 꺼낸 아이콘
        icon_path = dirs.app_icon(app.code)
        app.has_icon = redraw_icon(item.get("icon"), icon_path) or redraw_icon(item.get("cover"), icon_path)
        if not app.has_icon and exe_icon is not None and exe_icon.stat().st_size <= ICON_MAX_BYTES:
            exe_icon.replace(icon_path)
            app.has_icon = True
        if exe_icon is not None:
            remove(exe_icon)
        if app.has_icon:
            written.append(icon_path)
        gallery = save_gallery(settings, "store", app.code, item.get("images", []), warn)
        store.set_page(app, build_page(item, settings, gallery), now)
        db.commit()
    except BaseException:
        db.rollback()
        for f in written:
            remove(f)
        shutil.rmtree(settings.store_dir / "gallery" / "store" / app.code, ignore_errors=True)
        raise
    return Outcome(slug, "storeApp", app.code, f"옮김: 버전 {', '.join(r.version for r in app.releases)} ({app.status})")


# ── Showroom 서비스 ──


def import_showroom_service(db: Session, settings: Settings, owner: User, item: dict[str, Any], dry_run: bool, warn: list[str]) -> Outcome:
    slug, name = item["slug"], store.clean_line(item["title"])[:80]
    url = showroom.clean_url(str(item.get("url") or ""))
    if url is None:
        raise Problem("서비스 주소가 Showroom 규칙(https 도메인)에 맞지 않습니다")
    code = item.get("code")
    if code:
        svc = db.scalar(select(ShowroomService).where(ShowroomService.code == code))
        if svc is not None:
            if svc.owner_id != owner.id:
                raise Problem(f"작품 파일의 showroomService({code})가 다른 회원의 서비스입니다")
            return Outcome(slug, "showroomService", code, "이미 있음")
    same = db.scalar(select(ShowroomService).where(ShowroomService.owner_id == owner.id, (ShowroomService.url == url) | (ShowroomService.name == name)))
    if same is not None:
        return Outcome(slug, "showroomService", same.code, "이미 있음 (같은 주소·이름, 코드를 잇는다)")
    if dry_run:
        return Outcome(slug, "showroomService", code or "(새 코드)", f"옮길 예정: {url}")

    now = utcnow()
    published_at = to_datetime(item.get("date")) or now
    svc = ShowroomService(
        code=unique_code(db, ShowroomService, code),
        owner_id=owner.id,
        name=name,
        url=url,
        summary=store.clean_line(str(item.get("summary") or ""))[:160],
        description=store.clean_text(str(item.get("description") or ""))[:DESCRIPTION_MAX],
        category=category_from_tags(item.get("tags", []), SERVICE_CATEGORIES),
        status="published",
        created_at=published_at,
        updated_at=now,
        reviewed_at=now,
        published_at=published_at,
    )
    db.add(svc)
    db.flush()
    dirs = showroom.Dirs(settings)
    dirs.ensure()
    icon_path = dirs.icon(svc.code)
    try:
        svc.has_icon = redraw_icon(item.get("icon"), icon_path) or redraw_icon(item.get("cover"), icon_path)
        gallery = save_gallery(settings, "showroom", svc.code, item.get("images", []), warn)
        showroom.set_page(svc, build_page(item, settings, gallery), now)
        db.commit()
    except BaseException:
        db.rollback()
        remove(icon_path)
        shutil.rmtree(settings.store_dir / "gallery" / "showroom" / svc.code, ignore_errors=True)
        raise
    return Outcome(slug, "showroomService", svc.code, f"옮김: {url}")


# ── 실행 ──


def run(settings: Settings, items: list[dict[str, Any]], owner_email: str | None, dry_run: bool, fix_files: bool = False) -> tuple[list[Outcome], int]:
    db = Database(settings.database_url)
    db.ensure_schema(reset_if_outdated=False)  # 이 명령은 DB 를 다시 만들지 않는다
    outcomes: list[Outcome] = []
    failed = 0
    try:
        with db.new_session() as s:
            owner = resolve_owner(s, settings, owner_email)
            ensure_publisher(s, owner, dry_run)
            for item in items:
                warn: list[str] = []
                try:
                    if item["kind"] == "store":
                        o = import_store_app(s, settings, owner, item, dry_run, warn, fix_files)
                    elif item["kind"] == "showroom":
                        o = import_showroom_service(s, settings, owner, item, dry_run, warn)
                    else:
                        raise Problem(f"알 수 없는 종류: {item['kind']}")
                except Problem as err:
                    failed += 1
                    print(f"✗ {item.get('slug')}: {err}", file=sys.stderr)
                    continue
                outcomes.append(o)
                mark = "·" if o.note.startswith("이미") else "✓"
                print(f"{mark} {o.slug} → {'Store' if o.field == 'storeApp' else 'Showroom'} {o.code}: {o.note}", file=sys.stderr)
                for w in warn:
                    print(f"    △ {w}", file=sys.stderr)
    finally:
        db.engine.dispose()
    return outcomes, failed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="공식 앱·서비스를 Store·Showroom DB 로 옮긴다 (ADR-0014)")
    parser.add_argument("--input", required=True, help="admin official-export 의 JSON")
    parser.add_argument("--output", help="작품 파일에 적을 코드 (admin official-link 가 읽는다)")
    parser.add_argument("--owner", help="주인이 될 운영자 이메일 (운영자가 하나면 생략)")
    parser.add_argument("--dry-run", action="store_true", help="DB·파일을 바꾸지 않고 무엇을 할지만 보인다")
    parser.add_argument("--fix-files", action="store_true", help="이미 있는 앱의 같은 버전 설치 파일이 작품 파일과 다르면 작품 파일의 것으로 바꾼다")
    args = parser.parse_args(argv)

    settings = load_settings()
    items = json.loads(Path(args.input).read_text(encoding="utf-8"))
    where = "PostgreSQL" if settings.database_url.startswith("postgresql") else "SQLite"
    print(f"▶ {where} DB 로 {len(items)}개를 옮깁니다{' (미리 보기: 아무것도 바꾸지 않음)' if args.dry_run else ''}", file=sys.stderr)
    outcomes, failed = run(settings, items, args.owner, args.dry_run, args.fix_files)
    if args.output and not args.dry_run:
        links = [{"slug": o.slug, "field": o.field, "code": o.code} for o in outcomes]
        Path(args.output).write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding="utf-8")
    moved = sum(1 for o in outcomes if not o.note.startswith("이미"))
    print(f"끝: 옮김 {moved} · 이미 있음 {len(outcomes) - moved} · 문제 {failed}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

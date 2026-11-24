"""Store 공통 로직: 공개 여부, 응답 모양, 검사 작업, 정리. router.py 와 auth.py(회원 탈퇴)가 함께 쓴다.

auth.py 가 이 모듈을 가져오므로 여기서는 auth.py 를 가져오지 않는다 (순환 참조 방지).
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import Database, User, utcnow
from .files import StoreDirs, remove
from .models import CATEGORIES, StoreApp, StorePublisher, StoreRelease, StoreReport, StoreUpload
from .scan import scan_file

log = logging.getLogger("johnnystudio.store")

# Store·Showroom 이용약관 판. 약관(content/pages/store-terms.md)을 고칠 때마다 바꾼다. 바꾸면 올리는 회원이 다시 동의한다.
# 날짜(약관의 updated)를 쓰고, 같은 날 다시 고치면 .2 처럼 붙인다 (2026-11-24.2: Showroom 조항을 더했다)
TERMS_VERSION = "2026-11-24.2"
UPLOAD_TTL = timedelta(hours=24)
# 하루 업로드 횟수를 세려고, 다 쓴 업로드 기록도 이틀 동안 남긴다
USED_UPLOAD_RETENTION = timedelta(days=2)
# 처리한 신고는 1년 뒤 지운다 [확인 필요: 보관 기간]
REPORT_RETENTION = timedelta(days=365)
MB = 1024 * 1024


def dirs(settings: Settings) -> StoreDirs:
    return StoreDirs(settings.store_dir)


def is_admin(settings: Settings, user: User | None) -> bool:
    return user is not None and user.email.lower() in settings.store_admins


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


# ── 입력 정리 ──


def clean_line(raw: str) -> str:
    """한 줄 글: 유니코드 정규화, 제어·서식 문자(방향 바꾸기 문자 포함) 제거, 공백 하나로"""
    text = unicodedata.normalize("NFC", raw)
    text = "".join(" " if c in "\t\n\r" else c for c in text if c in "\t\n\r" or unicodedata.category(c)[0] != "C")
    return re.sub(r"\s+", " ", text).strip()


def clean_text(raw: str) -> str:
    """여러 줄 글: 줄바꿈만 남기고 제어 문자를 지운다. 빈 줄은 두 줄까지"""
    text = unicodedata.normalize("NFC", raw).replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(c for c in text if c in "\n\t" or unicodedata.category(c)[0] != "C").replace("\t", "    ")
    text = re.sub(r"[ 　]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# ── 공개 여부 ──


def releases_newest_first(app: StoreApp) -> list[StoreRelease]:
    # 커밋 뒤에도 관계 목록을 다시 읽지 않으므로(expire_on_commit=False) 여기서 정렬한다
    return sorted(app.releases, key=lambda r: (r.created_at, r.id or 0), reverse=True)


def public_releases(app: StoreApp) -> list[StoreRelease]:
    return [r for r in releases_newest_first(app) if r.status == "published" and r.stored]


def is_public(app: StoreApp, publisher: StorePublisher | None) -> bool:
    """방문자에게 보이는가: 공개 상태 + 올린 회원이 차단되지 않음 + 내려받을 버전이 있음"""
    return app.status == "published" and publisher is not None and publisher.blocked_at is None and bool(public_releases(app))


# ── 응답 모양 ──


def download_path(app: StoreApp, r: StoreRelease) -> str:
    return f"/api/store/apps/{app.code}/releases/{r.id}/download"


def release_out(r: StoreRelease, private: bool, files_origin: str = "") -> dict[str, Any]:
    meta = r.meta or {}
    path = download_path(r.app, r)
    out: dict[str, Any] = {
        "id": r.id,
        # 공개 내려받기만 파일 전용 출처로 보낸다. 검토용(비공개)은 로그인 쿠키가 있는 이 사이트에서 받아야 한다
        "download_url": path if private or not files_origin or r.status != "published" else f"{files_origin}{path}",
        "version": r.version,
        "notes": r.notes,
        "file_name": r.file_name,
        "size": r.size,
        "sha256": r.sha256,
        "file_type": r.file_type,
        "arch": r.arch,
        "signed": r.signed,
        "is_installer": bool(meta.get("is_installer")),
        "inner_path": meta.get("inner_path") or "",
        "company_name": meta.get("company_name") or "",
        "legal_copyright": meta.get("legal_copyright") or "",
        "scan": {"status": r.scan_status, "engine": r.scan_engine, "checked_at": iso(r.scanned_at)},
        "created_at": iso(r.created_at),
    }
    if private:
        out |= {
            "status": r.status,
            "status_reason": r.status_reason,
            "stored": r.stored,
            "download_count": r.download_count,
            "reviewed_at": iso(r.reviewed_at),
        }
        out["scan"]["detail"] = r.scan_detail
    return out


def app_out(
    app: StoreApp, publisher: StorePublisher | None, *, private: bool, owner: User | None = None, files_origin: str = ""
) -> dict[str, Any]:
    releases = releases_newest_first(app) if private else public_releases(app)
    out: dict[str, Any] = {
        "code": app.code,
        "name": app.name,
        "summary": app.summary,
        "description": app.description,
        "category": app.category,
        "category_label": CATEGORIES.get(app.category, "기타"),
        "publisher": publisher.display_name if publisher else "",
        "has_icon": app.has_icon,
        "published_at": iso(app.published_at),
        "updated_at": iso(app.updated_at),
        "releases": [release_out(r, private, files_origin) for r in releases],
    }
    if private:
        out |= {
            "status": app.status,
            "status_reason": app.status_reason,
            "public": is_public(app, publisher),
            "download_count": app.download_count,
            "created_at": iso(app.created_at),
        }
    if owner is not None:  # 운영자 화면
        out["owner"] = {
            "id": owner.id,
            "email": owner.email,
            "blocked": bool(publisher and publisher.blocked_at),
            "blocked_reason": publisher.blocked_reason if publisher else "",
        }
    return out


def card_out(app: StoreApp, publisher: StorePublisher | None) -> dict[str, Any]:
    latest = public_releases(app)[0]
    return {
        "code": app.code,
        "name": app.name,
        "summary": app.summary,
        "category": app.category,
        "category_label": CATEGORIES.get(app.category, "기타"),
        "publisher": publisher.display_name if publisher else "",
        "has_icon": app.has_icon,
        "version": latest.version,
        "arch": latest.arch,
        "size": latest.size,
        "updated_at": iso(latest.reviewed_at or latest.created_at),
    }


def publisher_out(p: StorePublisher | None) -> dict[str, Any] | None:
    if p is None:
        return None
    return {
        "display_name": p.display_name,
        "terms_version": p.terms_version,
        "terms_current": p.terms_version == TERMS_VERSION,
        "agreed_at": iso(p.agreed_at),
        "blocked": p.blocked_at is not None,
        "blocked_reason": p.blocked_reason,
    }


# ── 사용량 ──


def usage(db: Session, user_id: str, now: datetime) -> dict[str, int]:
    from sqlalchemy import func

    stored = db.scalar(
        select(func.coalesce(func.sum(StoreRelease.size), 0))
        .join(StoreApp, StoreApp.id == StoreRelease.app_id)
        .where(StoreApp.owner_id == user_id, StoreRelease.stored.is_(True))
    )
    waiting = db.scalar(
        select(func.coalesce(func.sum(StoreUpload.size), 0)).where(
            StoreUpload.user_id == user_id, StoreUpload.status != "used"
        )
    )
    today = db.scalar(
        select(func.count()).select_from(StoreUpload).where(
            StoreUpload.user_id == user_id, StoreUpload.created_at > now - timedelta(hours=24)
        )
    )
    return {"bytes_used": int(stored or 0) + int(waiting or 0), "uploads_24h": int(today or 0)}


def limits_out(settings: Settings) -> dict[str, int]:
    return {
        "file_max_bytes": settings.store_file_max_mb * MB,
        "user_quota_bytes": settings.store_user_quota_mb * MB,
        "daily_uploads": settings.store_daily_uploads,
    }


# ── 상태 바꾸기 ──


def reject_release(settings: Settings, r: StoreRelease, reason: str, now: datetime) -> None:
    """버전을 반려하고 파일을 지운다 (기록은 남는다). 검토 중인 앱에 남은 버전이 없으면 앱도 반려한다."""
    r.status = "rejected"
    r.status_reason = reason[:300]
    r.reviewed_at = now
    if r.stored:
        remove(dirs(settings).release_file(r.storage_key))
        r.stored = False
    app = r.app
    if app.status == "pending" and all(x.status == "rejected" for x in app.releases):
        app.status = "rejected"
        app.status_reason = reason[:300]


def delete_app_files(settings: Settings, app: StoreApp) -> None:
    d = dirs(settings)
    for r in app.releases:
        remove(d.release_file(r.storage_key))
    remove(d.app_icon(app.code))


def purge_expired(db: Session, settings: Settings, now: datetime) -> None:
    """기한이 지난 업로드 파일을 지우고, 오래된 기록을 지운다"""
    d = dirs(settings)
    for u in db.scalars(select(StoreUpload).where(StoreUpload.status != "used", StoreUpload.expires_at < now)):
        remove(d.upload_part(u.id))
        remove(d.upload_icon(u.id))
        u.status = "used"
    db.execute(
        delete(StoreUpload).where(StoreUpload.status == "used", StoreUpload.created_at < now - USED_UPLOAD_RETENTION)
    )
    db.execute(
        delete(StoreReport).where(StoreReport.status != "open", StoreReport.resolved_at < now - REPORT_RETENTION)
    )


def purge_user(db: Session, settings: Settings, user_id: str) -> None:
    """회원 탈퇴: 그 회원의 앱·버전·업로드 파일과 기록을 지운다. 신고 기록은 남기고 연결만 끊는다.

    커밋은 부르는 쪽(auth.delete_account)이 한다.
    """
    d = dirs(settings)
    apps = list(db.scalars(select(StoreApp).where(StoreApp.owner_id == user_id)))
    for app in apps:
        delete_app_files(settings, app)
    for upload_id in db.scalars(select(StoreUpload.id).where(StoreUpload.user_id == user_id)):
        remove(d.upload_part(upload_id))
        remove(d.upload_icon(upload_id))
    app_ids = [a.id for a in apps]
    if app_ids:
        db.execute(update(StoreReport).where(StoreReport.app_id.in_(app_ids)).values(app_id=None))
        db.execute(delete(StoreRelease).where(StoreRelease.app_id.in_(app_ids)))
        db.execute(delete(StoreApp).where(StoreApp.id.in_(app_ids)))
    db.execute(delete(StoreUpload).where(StoreUpload.user_id == user_id))
    db.execute(update(StoreReport).where(StoreReport.reporter_id == user_id).values(reporter_id=None))
    db.execute(delete(StorePublisher).where(StorePublisher.user_id == user_id))
    if apps:
        log.info("회원 탈퇴: Store 앱 %d개를 지웠다", len(apps))


# ── 검사 (뒤에서 돈다) ──


def scan_release(database: Database, settings: Settings, release_id: int) -> None:
    """버전 파일을 ClamAV 로 검사하고 결과를 남긴다. 탐지되면 바로 반려하고 파일을 지운다 (공개된 버전이어도)."""
    with database.new_session() as s:
        r = s.get(StoreRelease, release_id)
        if r is None or not r.stored:
            return
        r.scan_status = "scanning"
        s.commit()
        path = dirs(settings).release_file(r.storage_key)

    result = scan_file(path, settings.store_clamscan, settings.store_file_max_mb)

    with database.new_session() as s:
        r = s.get(StoreRelease, release_id)
        if r is None:
            return  # 검사하는 동안 지워졌다
        now = utcnow()
        r.scan_status = result.status
        r.scan_engine = result.engine[:80]
        r.scan_detail = result.detail[:300]
        r.scanned_at = now
        if result.status == "infected":
            reject_release(settings, r, f"ClamAV 가 악성코드를 탐지했습니다 ({result.detail})", now)
            log.warning("Store 검사: 버전 %d 에서 탐지 → 반려", release_id)
        s.commit()

"""Store 엔드포인트 (/api/store/, ADR-0012).

누구나 (로그인 없이)
  GET  /meta                                   분류·신고 사유·한도
  GET  /apps?q=&category=&sort=new|name        공개된 앱 목록
  GET  /apps/{code}                            앱 상세 (공개된 것. 올린 사람·운영자는 검토 중인 것도)
  GET  /apps/{code}/icon                       아이콘 PNG
  GET  /apps/{code}/releases/{id}/download     내려받기 (운영은 nginx 가 보낸다: X-Accel-Redirect)
  POST /apps/{code}/reports                    신고 (로그인하지 않아도 된다. IP 당 1시간 5번)

올리는 회원 (로그인)
  GET  /me · POST /me/publisher                표시 이름·약관 동의, 한도·사용량
  GET  /me/apps                                내 앱 (상태·반려 사유 포함)
  POST /uploads → PUT /uploads/{id}?offset= (8MB 조각) → POST /uploads/{id}/complete (분석) → POST /apps 또는 /apps/{code}/releases
  PATCH·DELETE /apps/{code}, DELETE /apps/{code}/releases/{id}
  PUT  /uploads/icons/{code}                   아이콘 바꾸기 (그림 1MB 까지 → 256px PNG 로 다시 그린다.
                                               nginx 의 /api/store/uploads 본문 한도 안에 두려고 이 경로에 있다)

운영자 (JOHNNYSTUDIO_STORE_ADMINS 의 이메일)
  GET  /admin/overview                         검토 대기·신고·차단 목록
  POST /admin/releases/{id}/approve|reject|rescan, /admin/apps/{code}/hide|unhide,
       /admin/reports/{id}/resolve, /admin/publishers/{user_id}/block|unblock

새 앱과 새 버전은 운영자가 승인해야 공개된다. 승인 전에 ClamAV 검사가 뒤에서 돈다 (service.scan_release).
"""

from __future__ import annotations

import base64
import logging
import re
import threading
from datetime import timedelta
from typing import Annotated, Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..auth import DbDep, SettingsDep, api_error, client_ip, optional_session, required_session
from ..config import Settings
from ..db import AuthSession, User, utcnow
from ..security import ip_hash
from . import service
from .analyze import BinaryValidationError, run_icon_isolated, run_isolated, validate_binary
from .files import UPLOAD_ID, new_storage_key, new_upload_id, remove, safe_file_name, sha256_of, write_chunk
from .models import (
    CATEGORIES,
    REPORT_REASONS,
    StoreApp,
    StorePublisher,
    StoreRelease,
    StoreReport,
    StoreUpload,
    new_code,
)
from .scan import find_clamscan

log = logging.getLogger("johnnystudio.store")
router = APIRouter(prefix="/api/store")

# 조각 하나의 최대 크기. nginx 의 client_max_body_size(9m)·Cloudflare 요청 한도 아래, Next 개발 서버 프록시(10MB) 아래
CHUNK_BYTES = 8 * 1024 * 1024
REPORT_IP_LIMIT = 5
ARCHES = ("x64", "x86", "arm64", "arm", "anycpu", "neutral", "unknown")
VERSION = re.compile(r"^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$")
# 운영자로 오해할 수 있는 표시 이름 (운영자 계정은 쓸 수 있다)
RESERVED_NAMES = ("johnnystudio", "johnny studio", "운영자", "관리자", "admin", "administrator", "moderator")
ICON_MAX_BYTES = 512 * 1024  # 다시 그린 256px PNG
ICON_UPLOAD_MAX_BYTES = 1024 * 1024  # 회원이 올리는 아이콘 그림

_chunk_lock = threading.Lock()

SessionDep = Annotated[AuthSession, Depends(required_session)]
OptionalSessionDep = Annotated[AuthSession | None, Depends(optional_session)]


# ── 의존성·도우미 ──


def _user(db: Session, session: AuthSession | None) -> User | None:
    return db.get(User, session.user_id) if session else None


def _signed_in(db: Session, session: AuthSession) -> User:
    user = db.get(User, session.user_id)
    if user is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_signed_in", "로그인이 필요합니다.")
    return user


def _admin(db: Session, settings: Settings, session: AuthSession) -> User:
    user = _signed_in(db, session)
    if not service.is_admin(settings, user):
        raise api_error(status.HTTP_403_FORBIDDEN, "not_admin", "운영자만 할 수 있습니다.")
    return user


def _publisher(db: Session, user_id: str) -> StorePublisher | None:
    return db.get(StorePublisher, user_id)


def _app(db: Session, code: str) -> StoreApp:
    app = db.scalar(select(StoreApp).where(StoreApp.code == code)) if re.fullmatch(r"[0-9A-Za-z]{4,12}", code) else None
    if app is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "앱을 찾을 수 없습니다.")
    return app


def _can_see_private(settings: Settings, user: User | None, app: StoreApp) -> bool:
    return user is not None and (user.id == app.owner_id or service.is_admin(settings, user))


def _visible_app(db: Session, settings: Settings, code: str, user: User | None) -> tuple[StoreApp, StorePublisher | None, bool]:
    """(앱, 올린 회원, 비공개 정보까지 보이는가). 볼 수 없으면 404 (있는지도 알리지 않는다)"""
    app = _app(db, code)
    publisher = _publisher(db, app.owner_id)
    private = _can_see_private(settings, user, app)
    if not private and not service.is_public(app, publisher):
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "앱을 찾을 수 없습니다.")
    return app, publisher, private


def _owned_app(db: Session, code: str, user: User) -> StoreApp:
    app = _app(db, code)
    if app.owner_id != user.id:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "앱을 찾을 수 없습니다.")
    return app


def _editable_app(db: Session, settings: Settings, code: str, user: User) -> tuple[StoreApp, bool]:
    """정보·아이콘을 고칠 앱과 '운영자가 남의 앱을 고치는가'. 올린 사람과 운영자만 고친다 (그 밖에는 404)"""
    app = _app(db, code)
    if app.owner_id == user.id:
        publisher = _publisher(db, user.id)
        if publisher is not None and publisher.blocked_at is not None:
            raise api_error(status.HTTP_403_FORBIDDEN, "blocked", "이 계정은 Store 앱을 고칠 수 없습니다.")
        return app, False
    if service.is_admin(settings, user):
        return app, True
    raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "앱을 찾을 수 없습니다.")


def _deletable_app(db: Session, settings: Settings, code: str, user: User) -> tuple[StoreApp, bool]:
    """지울 앱과 '운영자가 남의 앱을 지우는가'. 올린 사람(차단돼도 자기 앱은 지운다)과 운영자만 (그 밖에는 404)"""
    app = _app(db, code)
    if app.owner_id == user.id:
        return app, False
    if service.is_admin(settings, user):
        return app, True
    raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "앱을 찾을 수 없습니다.")


def _edited_out(db: Session, app: StoreApp, as_admin: bool) -> dict[str, Any]:
    if as_admin:
        log.info("Store 운영자가 앱 정보를 고침: %s", app.code)
        return _owner_view(db, app)
    return service.app_out(app, _publisher(db, app.owner_id), private=True)


def _ready_publisher(db: Session, settings: Settings, user: User) -> StorePublisher:
    """앱을 올릴 수 있는 회원인가"""
    if not settings.store_uploads_open and not service.is_admin(settings, user):
        raise api_error(status.HTTP_403_FORBIDDEN, "uploads_closed", "지금은 새 앱을 받지 않습니다. 잠시 뒤 다시 확인해 주세요.")
    p = _publisher(db, user.id)
    if p is None or p.terms_version != service.TERMS_VERSION:
        raise api_error(status.HTTP_403_FORBIDDEN, "needs_publisher", "먼저 표시 이름을 정하고 Store 이용약관에 동의해 주세요.")
    if p.blocked_at is not None:
        reason = f" (사유: {p.blocked_reason})" if p.blocked_reason else ""
        raise api_error(status.HTTP_403_FORBIDDEN, "blocked", f"이 계정은 Store 에 앱을 올릴 수 없습니다{reason}.")
    return p


def _field(value: str, cleaner, label: str, max_len: int, required: bool = False) -> str:  # noqa: ANN001
    text = cleaner(value)
    if required and not text:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", f"{label}을(를) 입력해 주세요.")
    if len(text) > max_len:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", f"{label}은(는) {max_len}자까지 쓸 수 있습니다.")
    return text


def _version(raw: str) -> str:
    v = raw.strip().lstrip("vV")
    if not VERSION.match(v):
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "버전은 1.2.3 처럼 영문·숫자·. + _ - 로 40자까지 씁니다.")
    return v


def _category(raw: str) -> str:
    if raw not in CATEGORIES:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "분류를 목록에서 골라 주세요.")
    return raw


def _arch(raw: str | None, fallback: str) -> str:
    if raw is None:
        return fallback if fallback in ARCHES else "unknown"
    if raw not in ARCHES:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "아키텍처 값이 올바르지 않습니다.")
    return raw


def _content_disposition(name: str) -> str:
    stem, _, ext = name.rpartition(".")
    ascii_stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", stem.encode("ascii", "ignore").decode()).strip(" ._") or "download"
    fallback = f"{ascii_stem}.{re.sub(r'[^A-Za-z0-9]', '', ext)}"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(name, safe='')}"


# ── 입력 모양 ──


class PublisherIn(BaseModel):
    display_name: str = Field(max_length=200)
    agree_terms: bool = False
    age_14: bool = False


class UploadStart(BaseModel):
    file_name: str = Field(max_length=400)
    size: int = Field(ge=1)


class AppIn(BaseModel):
    upload_id: str = Field(max_length=64)
    name: str = Field(max_length=400)
    summary: str = Field(default="", max_length=800)
    description: str = Field(default="", max_length=12000)
    category: str = Field(default="other", max_length=40)
    version: str = Field(max_length=100)
    notes: str = Field(default="", max_length=6000)
    arch: str | None = Field(default=None, max_length=20)


class ReleaseIn(BaseModel):
    upload_id: str = Field(max_length=64)
    version: str = Field(max_length=100)
    notes: str = Field(default="", max_length=6000)
    arch: str | None = Field(default=None, max_length=20)


class AppPatch(BaseModel):
    name: str | None = Field(default=None, max_length=400)
    summary: str | None = Field(default=None, max_length=800)
    description: str | None = Field(default=None, max_length=12000)
    category: str | None = Field(default=None, max_length=40)


class ReportIn(BaseModel):
    reason: str = Field(max_length=40)
    detail: str = Field(max_length=6000)
    contact: str = Field(default="", max_length=320)


class ReasonIn(BaseModel):
    reason: str = Field(default="", max_length=600)


class ResolveIn(BaseModel):
    status: Literal["actioned", "dismissed"]
    note: str = Field(default="", max_length=600)


# ── 누구나 ──


@router.get("/meta")
def meta(settings: SettingsDep) -> dict[str, Any]:
    return {
        "categories": CATEGORIES,
        "report_reasons": REPORT_REASONS,
        "limits": service.limits_out(settings),
        "chunk_bytes": CHUNK_BYTES,
        "terms_version": service.TERMS_VERSION,
        "uploads_open": settings.store_uploads_open,
        "scan_required": settings.store_require_scan,
        "scanner": find_clamscan(settings.store_clamscan) is not None,
    }


@router.get("/apps")
def list_apps(
    db: DbDep,
    q: Annotated[str, Query(max_length=100)] = "",
    category: Annotated[str, Query(max_length=40)] = "",
    sort: Literal["new", "name"] = "new",
) -> dict[str, Any]:
    stmt = (
        select(StoreApp, StorePublisher)
        .join(StorePublisher, StorePublisher.user_id == StoreApp.owner_id)
        .where(StoreApp.status == "published", StorePublisher.blocked_at.is_(None))
    )
    if category in CATEGORIES:
        stmt = stmt.where(StoreApp.category == category)
    words = service.clean_line(q).lower()
    if words:
        like = f"%{words.replace('%', '').replace('_', '')}%"
        stmt = stmt.where(func.lower(StoreApp.name).like(like) | func.lower(StoreApp.summary).like(like))
    if sort == "name":
        stmt = stmt.order_by(func.lower(StoreApp.name), StoreApp.id)
    else:
        stmt = stmt.order_by(func.coalesce(StoreApp.published_at, StoreApp.created_at).desc(), StoreApp.id.desc())
    rows = db.execute(stmt.limit(500)).all()
    apps = [service.card_out(app, pub) for app, pub in rows if service.is_public(app, pub)]
    return {"apps": apps}


@router.get("/apps/{code}")
def get_app(code: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> dict[str, Any]:
    user = _user(db, session)
    app, publisher, private = _visible_app(db, settings, code, user)
    out = service.app_out(app, publisher, private=private, files_origin=settings.store_files_origin)
    out["viewer"] = {"owner": user is not None and user.id == app.owner_id, "admin": service.is_admin(settings, user)}
    return out


@router.get("/apps/{code}/icon")
def app_icon(code: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> Response:
    app, _, _ = _visible_app(db, settings, code, _user(db, session))
    path = service.dirs(settings).app_icon(app.code)
    if not app.has_icon or not path.is_file():
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "아이콘이 없습니다.")
    return FileResponse(path, media_type="image/png", headers={"X-Content-Type-Options": "nosniff"})


@router.get("/apps/{code}/releases/{release_id}/download")
def download(code: str, release_id: int, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> Response:
    user = _user(db, session)
    app, publisher, private = _visible_app(db, settings, code, user)
    r = next((x for x in app.releases if x.id == release_id), None)
    allowed = r is not None and r.stored and (private or (r.status == "published" and service.is_public(app, publisher)))
    if r is None or not allowed:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "파일을 찾을 수 없습니다.")
    path = service.dirs(settings).release_file(r.storage_key)
    if not path.is_file():
        log.error("Store 파일이 없다: 버전 %d", r.id)
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "파일을 찾을 수 없습니다.")
    if not private:  # 올린 사람·운영자가 받은 것은 세지 않는다
        r.download_count += 1
        app.download_count += 1
        db.commit()
    headers = {
        "Content-Disposition": _content_disposition(r.file_name),
        "X-Content-Type-Options": "nosniff",
        # 혹시 브라우저가 파일을 열어 보더라도 스크립트·플러그인이 돌지 않게
        "Content-Security-Policy": "sandbox; default-src 'none'",
    }
    if settings.store_accel_prefix:
        headers["X-Accel-Redirect"] = f"{settings.store_accel_prefix}{r.storage_key}"
        return Response(status_code=200, media_type="application/octet-stream", headers=headers)
    return FileResponse(path, media_type="application/octet-stream", headers=headers)


@router.post("/apps/{code}/reports", status_code=status.HTTP_202_ACCEPTED)
def report_app(
    code: str, body: ReportIn, request: Request, db: DbDep, settings: SettingsDep, session: OptionalSessionDep
) -> dict[str, bool]:
    app, _, _ = _visible_app(db, settings, code, _user(db, session))
    if body.reason not in REPORT_REASONS:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "신고 사유를 골라 주세요.")
    detail = _field(body.detail, service.clean_text, "신고 내용", 4000, required=True)
    if len(detail) < 10:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "무엇이 문제인지 10자 이상 적어 주세요.")
    contact = _field(body.contact, service.clean_line, "연락처", 320)
    now = utcnow()
    iph = ip_hash(settings.secret, client_ip(request))
    recent = db.scalar(
        select(func.count()).select_from(StoreReport).where(StoreReport.ip_hash == iph, StoreReport.created_at > now - timedelta(hours=1))
    )
    if (recent or 0) >= REPORT_IP_LIMIT:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "too_many_requests", "신고가 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.")
    db.add(
        StoreReport(
            app_id=app.id,
            app_code=app.code,
            app_name=app.name,
            reason=body.reason,
            detail=detail,
            contact=contact,
            reporter_id=session.user_id if session else None,
            ip_hash=iph,
            created_at=now,
        )
    )
    db.commit()
    log.info("Store 신고 접수: %s (%s)", app.code, body.reason)
    return {"ok": True}


# ── 올리는 회원 ──


@router.get("/me")
def my_store(db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    return {
        "publisher": service.publisher_out(_publisher(db, user.id)),
        "admin": service.is_admin(settings, user),
        "limits": service.limits_out(settings),
        "usage": service.usage(db, user.id, utcnow()),
        "uploads_open": settings.store_uploads_open,
        "terms_version": service.TERMS_VERSION,
    }


@router.post("/me/publisher")
def set_publisher(body: PublisherIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    name = _field(body.display_name, service.clean_line, "표시 이름", 30, required=True)
    if len(name) < 2:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "표시 이름은 2자 이상 씁니다.")
    folded = name.casefold().replace(" ", "")
    if not service.is_admin(settings, user) and any(word.replace(" ", "") in folded for word in RESERVED_NAMES):
        raise api_error(status.HTTP_400_BAD_REQUEST, "reserved_name", "운영자로 오해할 수 있는 이름은 쓸 수 없습니다.")
    if not body.agree_terms or not body.age_14:
        raise api_error(status.HTTP_400_BAD_REQUEST, "needs_agreement", "Store 이용약관 동의와 만 14세 이상 확인이 필요합니다.")
    now = utcnow()
    p = _publisher(db, user.id)
    if p is None:
        p = StorePublisher(user_id=user.id, display_name=name, terms_version=service.TERMS_VERSION, agreed_at=now, created_at=now)
        db.add(p)
    else:
        p.display_name = name
        if p.terms_version != service.TERMS_VERSION:
            p.terms_version = service.TERMS_VERSION
            p.agreed_at = now
    db.commit()
    return {"publisher": service.publisher_out(p)}


@router.get("/me/apps")
def my_apps(db: DbDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    publisher = _publisher(db, user.id)
    apps = db.scalars(select(StoreApp).where(StoreApp.owner_id == user.id).order_by(StoreApp.created_at.desc()))
    return {"apps": [service.app_out(a, publisher, private=True) for a in apps]}


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
def start_upload(body: UploadStart, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    _ready_publisher(db, settings, user)
    name = safe_file_name(body.file_name)
    if name is None:
        raise api_error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "bad_type", "올릴 수 있는 형식은 .exe .msi .msix .zip .7z 입니다 (파일 이름 200자까지)."
        )
    limits = service.limits_out(settings)
    if body.size > limits["file_max_bytes"]:
        raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "too_large", f"파일이 너무 큽니다. {settings.store_file_max_mb}MB 까지 올릴 수 있습니다.")
    now = utcnow()
    service.purge_expired(db, settings, now)
    used = service.usage(db, user.id, now)
    if used["uploads_24h"] >= limits["daily_uploads"]:
        raise api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "daily_limit",
            f"24시간 동안 올릴 수 있는 횟수({limits['daily_uploads']}번)를 모두 썼습니다. 내일 다시 시도해 주세요.",
        )
    if used["bytes_used"] + body.size > limits["user_quota_bytes"]:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "quota",
            f"올려 둔 파일이 한도({settings.store_user_quota_mb}MB)를 넘습니다. 쓰지 않는 버전을 지우고 다시 올려 주세요.",
        )
    d = service.dirs(settings)
    d.ensure()
    upload = StoreUpload(id=new_upload_id(), user_id=user.id, file_name=name, size=body.size, created_at=now, expires_at=now + service.UPLOAD_TTL)
    db.add(upload)
    db.commit()
    return {"id": upload.id, "file_name": name, "chunk_bytes": CHUNK_BYTES}


def _own_upload(db: Session, upload_id: str, user_id: str) -> StoreUpload:
    u = db.get(StoreUpload, upload_id) if UPLOAD_ID.match(upload_id) else None
    if u is None or u.user_id != user_id or u.status == "used" or u.expires_at <= utcnow():
        raise api_error(status.HTTP_404_NOT_FOUND, "upload_not_found", "올리던 파일을 찾을 수 없습니다. 처음부터 다시 올려 주세요.")
    return u


@router.put("/uploads/{upload_id}")
async def upload_chunk(
    upload_id: str,
    request: Request,
    db: DbDep,
    settings: SettingsDep,
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)],
) -> dict[str, int]:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > CHUNK_BYTES:
        raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "chunk_too_large", "조각이 너무 큽니다.")
    data = bytearray()
    async for part in request.stream():
        data += part
        if len(data) > CHUNK_BYTES:
            raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "chunk_too_large", "조각이 너무 큽니다.")
    return await run_in_threadpool(_store_chunk, db, settings, session, upload_id, offset, bytes(data))


def _store_chunk(db: Session, settings: Settings, session: AuthSession, upload_id: str, offset: int, data: bytes) -> dict[str, int]:
    u = _own_upload(db, upload_id, session.user_id)
    if u.status != "receiving":
        raise api_error(status.HTTP_409_CONFLICT, "upload_done", "이미 다 받은 파일입니다.")
    if not data:
        raise api_error(status.HTTP_400_BAD_REQUEST, "empty_chunk", "빈 조각입니다.")
    if offset != u.received:
        raise api_error(status.HTTP_409_CONFLICT, "bad_offset", f"이어 올릴 위치가 맞지 않습니다 ({u.received}).")
    if u.received + len(data) > u.size:
        raise api_error(status.HTTP_400_BAD_REQUEST, "too_much", "처음에 알린 크기보다 큰 파일입니다.")
    path = service.dirs(settings).upload_part(u.id)
    with _chunk_lock:
        try:
            u.received = write_chunk(path, data, offset)
        except ValueError:
            raise api_error(status.HTTP_409_CONFLICT, "bad_offset", "업로드가 끊겼습니다. 처음부터 다시 올려 주세요.") from None
        db.commit()
    return {"received": u.received}


@router.post("/uploads/{upload_id}/complete")
def complete_upload(upload_id: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    """다 받은 파일을 분석한다. 확장자와 내용이 다르면 지우고 415"""
    u = _own_upload(db, upload_id, session.user_id)
    if u.status == "ready" and u.analysis is not None:
        return _analysis_out(settings, u)
    d = service.dirs(settings)
    part = d.upload_part(u.id)
    if u.received != u.size or not part.is_file() or part.stat().st_size != u.size:
        raise api_error(status.HTTP_409_CONFLICT, "incomplete", "파일을 아직 다 받지 못했습니다.")

    def discard(message: str) -> Exception:
        remove(part)
        remove(d.upload_icon(u.id))
        u.status = "used"
        db.commit()
        return api_error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "bad_file", message)

    try:
        file_type = validate_binary(part, u.file_name)  # 앞부분 몇 바이트만 본다 (이 프로세스에서 해도 안전하다)
    except BinaryValidationError as exc:
        raise discard(str(exc)) from None
    result = run_isolated(part, u.file_name, d.upload_icon(u.id))
    if "error" in result:
        raise discard(str(result["error"])[:300])
    icon = d.upload_icon(u.id)
    if icon.is_file() and (icon.stat().st_size > ICON_MAX_BYTES or not icon.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"):
        remove(icon)

    analyzed = not result.get("failed")
    warnings = [str(w)[:300] for w in result.get("warnings", [])][:10]
    if not analyzed:
        warnings.append("파일에서 앱 정보를 읽지 못했습니다. 이름과 버전을 직접 입력해 주세요.")
    suggested = result.get("suggested") or {}
    sha = sha256_of(part)
    duplicate = db.execute(
        select(StoreApp.name, StoreRelease.version)
        .join(StoreRelease, StoreRelease.app_id == StoreApp.id)
        .where(StoreApp.owner_id == u.user_id, StoreRelease.sha256 == sha)
        .limit(1)
    ).first()
    if duplicate:
        warnings.append(f"이미 올린 파일과 같습니다: {duplicate.name} {duplicate.version}")
    u.sha256 = sha
    u.status = "ready"
    u.analysis = {
        "analyzed": analyzed,
        "file_type": file_type,
        "arch": str(result.get("architecture") or "unknown")[:12],
        "signed": bool(result.get("is_signed")),
        "is_installer": bool(result.get("is_installer")),
        "inner_path": str(result.get("inner_path") or "")[:200],
        "product_name": str(result.get("product_name") or "")[:200],
        "company_name": str(result.get("company_name") or "")[:200],
        "file_description": str(result.get("file_description") or "")[:300],
        "product_version": str(result.get("product_version") or "")[:60],
        "legal_copyright": str(result.get("legal_copyright") or "")[:200],
        "suggested": {
            "name": service.clean_line(str(suggested.get("name") or ""))[:80],
            "version": str(suggested.get("version") or "")[:40],
            "summary": service.clean_line(str(suggested.get("summary") or ""))[:160],
        },
        "warnings": warnings,
    }
    db.commit()
    return _analysis_out(settings, u)


def _analysis_out(settings: Settings, u: StoreUpload) -> dict[str, Any]:
    icon = service.dirs(settings).upload_icon(u.id)
    return {
        "upload_id": u.id,
        "file_name": u.file_name,
        "size": u.size,
        "sha256": u.sha256,
        **(u.analysis or {}),
        "icon": "data:image/png;base64," + base64.b64encode(icon.read_bytes()).decode() if icon.is_file() else None,
    }


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_upload(upload_id: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> None:
    u = _own_upload(db, upload_id, session.user_id)
    d = service.dirs(settings)
    remove(d.upload_part(u.id))
    remove(d.upload_icon(u.id))
    u.status = "used"  # 하루 횟수에는 남는다
    db.commit()


def _take_upload(db: Session, settings: Settings, upload_id: str, user_id: str) -> StoreUpload:
    u = _own_upload(db, upload_id, user_id)
    if u.status != "ready" or u.analysis is None or u.sha256 is None:
        raise api_error(status.HTTP_409_CONFLICT, "upload_not_ready", "파일 분석이 끝나지 않았습니다.")
    if not service.dirs(settings).upload_part(u.id).is_file():
        raise api_error(status.HTTP_404_NOT_FOUND, "upload_not_found", "올리던 파일을 찾을 수 없습니다. 처음부터 다시 올려 주세요.")
    return u


def _new_release(settings: Settings, app: StoreApp, u: StoreUpload, version: str, notes: str, arch: str | None) -> StoreRelease:
    """업로드 파일을 버전 파일로 옮긴다 (같은 디스크라서 이름만 바뀐다)"""
    d = service.dirs(settings)
    analysis = u.analysis or {}
    key = new_storage_key()
    d.upload_part(u.id).replace(d.release_file(key))
    now = utcnow()
    r = StoreRelease(
        version=version,
        notes=notes,
        file_name=u.file_name,
        storage_key=key,
        size=u.size,
        sha256=u.sha256 or "",
        file_type=str(analysis.get("file_type") or "exe"),
        arch=_arch(arch, str(analysis.get("arch") or "unknown")),
        signed=bool(analysis.get("signed")),
        meta={k: analysis.get(k) for k in ("is_installer", "inner_path", "product_name", "company_name", "product_version", "legal_copyright")},
        created_at=now,
    )
    app.releases.append(r)
    icon = d.upload_icon(u.id)
    if icon.is_file():
        if not app.has_icon:
            icon.replace(d.app_icon(app.code))
            app.has_icon = True
        else:
            remove(icon)
    u.status = "used"
    app.updated_at = now
    return r


@router.put("/uploads/icons/{code}")
async def upload_icon(code: str, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > ICON_UPLOAD_MAX_BYTES:
        raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "too_large", "아이콘 그림은 1MB 까지 올릴 수 있습니다.")
    data = bytearray()
    async for part in request.stream():
        data += part
        if len(data) > ICON_UPLOAD_MAX_BYTES:
            raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "too_large", "아이콘 그림은 1MB 까지 올릴 수 있습니다.")
    return await run_in_threadpool(_save_icon, db, settings, session, code, bytes(data))


def _save_icon(db: Session, settings: Settings, session: AuthSession, code: str, data: bytes) -> dict[str, Any]:
    user = _signed_in(db, session)
    app, as_admin = _editable_app(db, settings, code, user)
    if not data:
        raise api_error(status.HTTP_400_BAD_REQUEST, "empty", "빈 파일입니다.")
    d = service.dirs(settings)
    d.ensure()
    tmp_id = new_upload_id()
    src, out = d.uploads / f"{tmp_id}.icon-src", d.upload_icon(tmp_id)
    try:
        src.write_bytes(data)
        result = run_icon_isolated(src, out)
        if "error" in result or not out.is_file() or out.stat().st_size > ICON_MAX_BYTES or out.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise api_error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "bad_image", str(result.get("error") or "그림을 처리하지 못했습니다."))
        out.replace(d.app_icon(app.code))
    finally:
        remove(src)
        remove(out)
    app.has_icon = True
    app.updated_at = utcnow()
    db.commit()
    return _edited_out(db, app, as_admin)


@router.post("/apps", status_code=status.HTTP_201_CREATED)
def create_app(
    body: AppIn, background: BackgroundTasks, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep
) -> dict[str, Any]:
    user = _signed_in(db, session)
    publisher = _ready_publisher(db, settings, user)
    name = _field(body.name, service.clean_line, "앱 이름", 80, required=True)
    summary = _field(body.summary, service.clean_line, "한 줄 소개", 160)
    description = _field(body.description, service.clean_text, "설명", 5000)
    notes = _field(body.notes, service.clean_text, "바뀐 점", 2000)
    category = _category(body.category)
    version = _version(body.version)
    u = _take_upload(db, settings, body.upload_id, user.id)
    now = utcnow()
    code = new_code()
    while db.scalar(select(StoreApp.id).where(StoreApp.code == code)) is not None:
        code = new_code()
    app = StoreApp(
        code=code, owner_id=user.id, name=name, summary=summary, description=description, category=category, created_at=now, updated_at=now
    )
    db.add(app)
    r = _new_release(settings, app, u, version, notes, body.arch)
    db.commit()
    background.add_task(service.scan_release, request.app.state.db, settings, r.id)
    log.info("Store 새 앱 접수: %s (검토 대기)", app.code)
    return service.app_out(app, publisher, private=True)


@router.post("/apps/{code}/releases", status_code=status.HTTP_201_CREATED)
def add_release(
    code: str, body: ReleaseIn, background: BackgroundTasks, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep
) -> dict[str, Any]:
    user = _signed_in(db, session)
    publisher = _ready_publisher(db, settings, user)
    app = _owned_app(db, code, user)
    if app.status == "hidden":
        raise api_error(status.HTTP_403_FORBIDDEN, "hidden", "운영자가 숨긴 앱에는 새 버전을 올릴 수 없습니다. 운영자에게 문의해 주세요.")
    version = _version(body.version)
    notes = _field(body.notes, service.clean_text, "바뀐 점", 2000)
    same = next((r for r in app.releases if r.version == version), None)
    if same is not None:
        if same.status != "rejected":
            raise api_error(status.HTTP_409_CONFLICT, "duplicate_version", f"{version} 버전이 이미 있습니다. 버전을 올려 주세요.")
        app.releases.remove(same)  # 반려된 같은 버전은 지우고 다시 받는다
        db.flush()
    u = _take_upload(db, settings, body.upload_id, user.id)
    r = _new_release(settings, app, u, version, notes, body.arch)
    if app.status == "rejected":
        app.status = "pending"  # 다시 검토를 받는다
        app.status_reason = ""
    db.commit()
    background.add_task(service.scan_release, request.app.state.db, settings, r.id)
    log.info("Store 새 버전 접수: %s %s (검토 대기)", app.code, version)
    return service.app_out(app, publisher, private=True)


@router.patch("/apps/{code}")
def edit_app(code: str, body: AppPatch, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    app, as_admin = _editable_app(db, settings, code, user)
    if body.name is not None:
        app.name = _field(body.name, service.clean_line, "앱 이름", 80, required=True)
    if body.summary is not None:
        app.summary = _field(body.summary, service.clean_line, "한 줄 소개", 160)
    if body.description is not None:
        app.description = _field(body.description, service.clean_text, "설명", 5000)
    if body.category is not None:
        app.category = _category(body.category)
    app.updated_at = utcnow()
    db.commit()
    return _edited_out(db, app, as_admin)


@router.delete("/apps/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_app(code: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> None:
    user = _signed_in(db, session)
    app, as_admin = _deletable_app(db, settings, code, user)
    service.delete_app_files(settings, app)
    for report in db.scalars(select(StoreReport).where(StoreReport.app_id == app.id)):
        report.app_id = None
    db.delete(app)
    db.commit()
    log.info("Store 앱 삭제%s: %s", " (운영자)" if as_admin else "", code)


@router.delete("/apps/{code}/releases/{release_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_release(code: str, release_id: int, db: DbDep, settings: SettingsDep, session: SessionDep) -> None:
    user = _signed_in(db, session)
    app, as_admin = _deletable_app(db, settings, code, user)
    r = next((x for x in app.releases if x.id == release_id), None)
    if r is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "버전을 찾을 수 없습니다.")
    remove(service.dirs(settings).release_file(r.storage_key))
    app.releases.remove(r)
    app.updated_at = utcnow()
    db.commit()
    log.info("Store 버전 삭제%s: %s %s", " (운영자)" if as_admin else "", app.code, r.version)


# ── 운영자 ──


def _owner_view(db: Session, app: StoreApp) -> dict[str, Any]:
    return service.app_out(app, _publisher(db, app.owner_id), private=True, owner=db.get(User, app.owner_id))


@router.get("/admin/overview")
def admin_overview(db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    now = utcnow()
    service.purge_expired(db, settings, now)
    db.commit()
    pending_ids = db.scalars(select(StoreRelease.app_id).where(StoreRelease.status == "pending").distinct())
    pending = [db.get(StoreApp, i) for i in pending_ids]
    reports = db.scalars(select(StoreReport).where(StoreReport.status == "open").order_by(StoreReport.created_at))
    hidden = db.scalars(select(StoreApp).where(StoreApp.status == "hidden").order_by(StoreApp.updated_at.desc()).limit(50))
    recent = db.scalars(
        select(StoreApp).where(StoreApp.status == "published").order_by(StoreApp.updated_at.desc()).limit(30)
    )
    blocked = db.execute(
        select(StorePublisher, User).join(User, User.id == StorePublisher.user_id).where(StorePublisher.blocked_at.is_not(None))
    ).all()
    return {
        "scan_required": settings.store_require_scan,
        "scanner": find_clamscan(settings.store_clamscan) is not None,
        "pending": [_owner_view(db, a) for a in pending if a is not None],
        "reports": [
            {
                "id": r.id,
                "app_code": r.app_code,
                "app_name": r.app_name,
                "app_exists": r.app_id is not None,
                "reason": r.reason,
                "reason_label": REPORT_REASONS.get(r.reason, r.reason),
                "detail": r.detail,
                "contact": r.contact,
                "signed_in": r.reporter_id is not None,
                "created_at": service.iso(r.created_at),
            }
            for r in reports
        ],
        "hidden": [_owner_view(db, a) for a in hidden],
        "recent": [_owner_view(db, a) for a in recent],
        "blocked": [
            {"user_id": p.user_id, "email": u.email, "display_name": p.display_name, "reason": p.blocked_reason, "blocked_at": service.iso(p.blocked_at)}
            for p, u in blocked
        ],
    }


def _release(db: Session, release_id: int) -> StoreRelease:
    r = db.get(StoreRelease, release_id)
    if r is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "버전을 찾을 수 없습니다.")
    return r


@router.post("/admin/releases/{release_id}/approve")
def approve_release(release_id: int, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    r = _release(db, release_id)
    if r.status != "pending" or not r.stored:
        raise api_error(status.HTTP_409_CONFLICT, "not_pending", "검토 대기 중인 버전이 아닙니다.")
    if r.scan_status in ("queued", "scanning"):
        raise api_error(status.HTTP_409_CONFLICT, "scan_running", "검사가 아직 끝나지 않았습니다. 잠시 뒤 다시 시도해 주세요.")
    if r.scan_status == "infected":
        raise api_error(status.HTTP_409_CONFLICT, "infected", "악성코드가 탐지된 파일은 공개할 수 없습니다.")
    if settings.store_require_scan and r.scan_status != "clean":
        raise api_error(status.HTTP_409_CONFLICT, "scan_required", "ClamAV 검사에서 '탐지 없음'이 나와야 공개할 수 있습니다. 다시 검사해 주세요.")
    now = utcnow()
    r.status = "published"
    r.status_reason = ""
    r.reviewed_at = now
    app = r.app
    if app.status in ("pending", "rejected"):
        app.status = "published"
        app.status_reason = ""
    if app.published_at is None:
        app.published_at = now
    app.updated_at = now
    db.commit()
    log.info("Store 승인: %s %s", app.code, r.version)
    return _owner_view(db, app)


@router.post("/admin/releases/{release_id}/reject")
def reject_release(release_id: int, body: ReasonIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    r = _release(db, release_id)
    if r.status == "rejected":
        raise api_error(status.HTTP_409_CONFLICT, "already_rejected", "이미 반려한 버전입니다.")
    reason = _field(body.reason, service.clean_line, "반려 사유", 300, required=True)
    service.reject_release(settings, r, reason, utcnow())
    db.commit()
    log.info("Store 반려: %s %s", r.app.code, r.version)
    return _owner_view(db, r.app)


@router.post("/admin/releases/{release_id}/rescan", status_code=status.HTTP_202_ACCEPTED)
def rescan_release(
    release_id: int, background: BackgroundTasks, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep
) -> dict[str, bool]:
    _admin(db, settings, session)
    r = _release(db, release_id)
    if not r.stored:
        raise api_error(status.HTTP_409_CONFLICT, "no_file", "파일이 지워진 버전입니다.")
    r.scan_status = "queued"
    db.commit()
    background.add_task(service.scan_release, request.app.state.db, settings, r.id)
    return {"ok": True}


@router.post("/admin/apps/{code}/hide")
def hide_app(code: str, body: ReasonIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    app = _app(db, code)
    app.status = "hidden"
    app.status_reason = _field(body.reason, service.clean_line, "숨기는 사유", 300, required=True)
    app.updated_at = utcnow()
    db.commit()
    log.info("Store 숨김: %s", code)
    return _owner_view(db, app)


@router.post("/admin/apps/{code}/unhide")
def unhide_app(code: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    app = _app(db, code)
    if app.status != "hidden":
        raise api_error(status.HTTP_409_CONFLICT, "not_hidden", "숨긴 앱이 아닙니다.")
    app.status = "published" if any(r.status == "published" for r in app.releases) else "pending"
    app.status_reason = ""
    app.updated_at = utcnow()
    db.commit()
    return _owner_view(db, app)


@router.post("/admin/reports/{report_id}/resolve")
def resolve_report(report_id: int, body: ResolveIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, bool]:
    _admin(db, settings, session)
    r = db.get(StoreReport, report_id)
    if r is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "신고를 찾을 수 없습니다.")
    r.status = body.status
    r.note = service.clean_line(body.note)[:300]
    r.resolved_at = utcnow()
    db.commit()
    return {"ok": True}


@router.post("/admin/publishers/{user_id}/block")
def block_publisher(user_id: str, body: ReasonIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, bool]:
    admin = _admin(db, settings, session)
    if user_id == admin.id:
        raise api_error(status.HTTP_400_BAD_REQUEST, "self", "자기 계정은 차단할 수 없습니다.")
    p = _publisher(db, user_id)
    if p is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Store 에 앱을 올린 적이 없는 회원입니다.")
    p.blocked_at = utcnow()
    p.blocked_reason = _field(body.reason, service.clean_line, "차단 사유", 300, required=True)
    db.commit()
    log.info("Store 회원 차단")
    return {"ok": True}


@router.post("/admin/publishers/{user_id}/unblock")
def unblock_publisher(user_id: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, bool]:
    _admin(db, settings, session)
    p = _publisher(db, user_id)
    if p is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Store 에 앱을 올린 적이 없는 회원입니다.")
    p.blocked_at = None
    p.blocked_reason = ""
    db.commit()
    return {"ok": True}

"""Showroom 엔드포인트 (/api/showroom/). 원칙은 Store 와 같다 (ADR-0012): 운영자가 승인한 서비스만 공개한다.

누구나
  GET  /meta · GET /services?q=&category=&sort= · GET /services/{code}
  GET  /services/{code}/icon · /services/{code}/screenshot
  POST /services/{code}/reports                  신고 (IP 당 1시간 5번)
올리는 회원 (Store 와 같은 표시 이름·약관 동의·차단을 쓴다: /api/store/me)
  GET  /me/services · POST /services · PATCH·DELETE /services/{code}   (고치기·지우기는 운영자도 한다)
  PUT  /uploads/{code}/icon · /uploads/{code}/screenshot   (그림 원본. nginx 의 /api/showroom/uploads 본문 한도 안.
                                                            screenshot 은 예전 화면 그림 한 장. 새 화면은 gallery 를 쓴다)
  PUT  /services/{code}/page · PUT /uploads/{code}/gallery  소개 자료와 그림 모음 (ADR-0013)
  GET  /services/{code}/gallery/{image_id}                 소개 그림 (누구나, 서비스를 볼 수 있으면)
운영자
  GET  /admin/overview · POST /admin/services/{code}/approve|reject|hide|unhide · POST /admin/reports/{id}/resolve

승인한 뒤 주소(url)를 바꾸면 다시 검토 대기로 돌아간다 (검토를 거친 주소만 공개한다).
이름·소개·설명·분류·그림 수정은 바로 반영하고, 신고·숨김으로 사후 대응한다 (Store 와 같다).
운영자는 남의 서비스도 모두 고치고 지운다 (약관 제5조 5·제10조 1). 운영자가 고치면 검토 상태를 바꾸지 않는다
(운영자가 검토하는 사람이므로 주소를 바꿔도 다시 검토 대기로 돌리지 않고, 반려된 서비스를 대신 다시 내지도 않는다).
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..auth import DbDep, SettingsDep, api_error, client_ip
from ..config import Settings
from ..db import AuthSession, User, utcnow
from ..listing import GALLERY_MAX, IMAGE_ID, IMAGE_UPLOAD_MAX_BYTES, Gallery, ListingError, PageIn, clean_page, meta_out
from ..security import ip_hash
from ..store import service as store
from ..store.analyze import run_icon_isolated, run_screenshot_isolated
from ..store.files import new_upload_id, remove
from ..store.models import REPORT_REASONS, StorePublisher, new_code
from ..store.router import (
    DESCRIPTION_MAX,
    ICON_UPLOAD_MAX_BYTES,
    IMAGE_CACHE,
    REPORT_IP_LIMIT,
    OptionalSessionDep,
    ReasonIn,
    ReportIn,
    ResolveIn,
    SessionDep,
    _admin,
    _field,
    _publisher,
    _ready_publisher,
    _signed_in,
    _user,
    read_limited,
)
from . import service
from .models import SERVICE_CATEGORIES, ShowroomReport, ShowroomService, ShowroomServicePage

log = logging.getLogger("johnnystudio.showroom")
router = APIRouter(prefix="/api/showroom")

SCREENSHOT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
ICON_MAX_BYTES = 512 * 1024
SHOT_MAX_BYTES = 3 * 1024 * 1024


# ── 도우미 ──


def _service(db: Session, code: str) -> ShowroomService:
    svc = db.scalar(select(ShowroomService).where(ShowroomService.code == code)) if re.fullmatch(r"[0-9A-Za-z]{4,12}", code) else None
    if svc is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "서비스를 찾을 수 없습니다.")
    return svc


def _visible(db: Session, settings: Settings, code: str, user: User | None) -> tuple[ShowroomService, StorePublisher | None, bool]:
    svc = _service(db, code)
    publisher = _publisher(db, svc.owner_id)
    private = user is not None and (user.id == svc.owner_id or store.is_admin(settings, user))
    if not private and not service.is_public(svc, publisher):
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "서비스를 찾을 수 없습니다.")
    return svc, publisher, private


def _editable(db: Session, settings: Settings, code: str, user: User) -> tuple[ShowroomService, bool]:
    """고칠 서비스와 '운영자가 남의 서비스를 고치는가'. 소개한 사람(차단되면 못 고친다)과 운영자만 (그 밖에는 404). Store 와 같다"""
    svc = _service(db, code)
    if svc.owner_id == user.id:
        publisher = _publisher(db, user.id)
        if publisher is not None and publisher.blocked_at is not None:
            raise api_error(status.HTTP_403_FORBIDDEN, "blocked", "이 계정은 Showroom 서비스를 고칠 수 없습니다.")
        return svc, False
    if store.is_admin(settings, user):
        return svc, True
    raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "서비스를 찾을 수 없습니다.")


def _edited_out(db: Session, settings: Settings, svc: ShowroomService, as_admin: bool, what: str = "서비스 정보") -> dict[str, Any]:
    if as_admin:
        log.info("Showroom 운영자가 %s를 고침: %s", what, svc.code)
        return _owner_view(db, svc, settings)
    return service.service_out(svc, _publisher(db, svc.owner_id), private=True, official=store.is_official(db, settings, svc.owner_id))


def _url(raw: str) -> str:
    url = service.clean_url(raw)
    if url is None:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "invalid_url",
            "서비스 주소는 https:// 로 시작하는 도메인 주소여야 합니다 (IP 주소·localhost·아이디 포함 주소는 받지 않습니다).",
        )
    return url


def _category(raw: str) -> str:
    if raw not in SERVICE_CATEGORIES:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "분류를 목록에서 골라 주세요.")
    return raw


def _owner_view(db: Session, svc: ShowroomService, settings: Settings) -> dict[str, Any]:
    owner = db.get(User, svc.owner_id)
    return service.service_out(svc, _publisher(db, svc.owner_id), private=True, owner=owner, official=store.is_admin(settings, owner))


# ── 입력 ──


class ServiceIn(BaseModel):
    name: str = Field(max_length=400)
    url: str = Field(max_length=1000)
    summary: str = Field(default="", max_length=800)
    description: str = Field(default="", max_length=40000)
    category: str = Field(default="other", max_length=40)


class ServicePatch(BaseModel):
    name: str | None = Field(default=None, max_length=400)
    url: str | None = Field(default=None, max_length=1000)
    summary: str | None = Field(default=None, max_length=800)
    description: str | None = Field(default=None, max_length=40000)
    category: str | None = Field(default=None, max_length=40)


# ── 누구나 ──


@router.get("/meta")
def meta(settings: SettingsDep) -> dict[str, Any]:
    return {
        "categories": SERVICE_CATEGORIES,
        "report_reasons": REPORT_REASONS,
        "limits": {"daily_submissions": service.DAILY_SUBMISSIONS, "max_per_user": service.MAX_PER_USER, "icon_max_bytes": ICON_UPLOAD_MAX_BYTES, "screenshot_max_bytes": SCREENSHOT_UPLOAD_MAX_BYTES},
        "terms_version": store.TERMS_VERSION,
        "submissions_open": settings.store_uploads_open,
        "listing": meta_out(),
    }


@router.get("/services")
def list_services(
    db: DbDep,
    settings: SettingsDep,
    q: Annotated[str, Query(max_length=100)] = "",
    category: Annotated[str, Query(max_length=40)] = "",
    sort: Literal["new", "name"] = "new",
) -> dict[str, Any]:
    stmt = (
        select(ShowroomService, StorePublisher)
        .join(StorePublisher, StorePublisher.user_id == ShowroomService.owner_id)
        .outerjoin(ShowroomServicePage, ShowroomServicePage.service_id == ShowroomService.id)
        .where(ShowroomService.status == "published", StorePublisher.blocked_at.is_(None))
    )
    if category in SERVICE_CATEGORIES:
        stmt = stmt.where(ShowroomService.category == category)
    words = store.clean_line(q).lower()
    if words:
        like = f"%{words.replace('%', '').replace('_', '')}%"
        stmt = stmt.where(
            func.lower(ShowroomService.name).like(like)
            | func.lower(ShowroomService.summary).like(like)
            | func.coalesce(ShowroomServicePage.search_text, "").like(like)
        )
    if sort == "name":
        stmt = stmt.order_by(func.lower(ShowroomService.name), ShowroomService.id)
    else:
        stmt = stmt.order_by(func.coalesce(ShowroomService.published_at, ShowroomService.created_at).desc(), ShowroomService.id.desc())
    official = store.official_ids(db, settings)
    return {"services": [service.card_out(svc, pub, official=svc.owner_id in official) for svc, pub in db.execute(stmt.limit(500)).all()]}


@router.get("/services/{code}")
def get_service(code: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> dict[str, Any]:
    user = _user(db, session)
    svc, publisher, private = _visible(db, settings, code, user)
    out = service.service_out(svc, publisher, private=private, official=store.is_official(db, settings, svc.owner_id))
    out["viewer"] = {"owner": user is not None and user.id == svc.owner_id, "admin": store.is_admin(settings, user)}
    return out


@router.get("/services/{code}/icon")
def service_icon(code: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> Response:
    svc, _, _ = _visible(db, settings, code, _user(db, session))
    path = service.Dirs(settings).icon(svc.code)
    if not svc.has_icon or not path.is_file():
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "아이콘이 없습니다.")
    return FileResponse(path, media_type="image/png", headers={"X-Content-Type-Options": "nosniff"})


@router.get("/services/{code}/screenshot")
def service_screenshot(code: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> Response:
    svc, _, _ = _visible(db, settings, code, _user(db, session))
    path = service.Dirs(settings).shot(svc.code)
    if not svc.has_screenshot or not path.is_file():
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "화면 그림이 없습니다.")
    return FileResponse(path, media_type="image/webp", headers={"X-Content-Type-Options": "nosniff"})


@router.get("/services/{code}/gallery/{image_id}")
def service_gallery_image(code: str, image_id: str, db: DbDep, settings: SettingsDep, session: OptionalSessionDep) -> Response:
    svc, _, _ = _visible(db, settings, code, _user(db, session))
    ids = {g.get("id") for g in (svc.page.data.get("gallery", []) if svc.page else [])}
    path = Gallery(settings, "showroom", svc.code).path(image_id) if IMAGE_ID.match(image_id) and image_id in ids else None
    if path is None or not path.is_file():
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "그림이 없습니다.")
    return FileResponse(path, media_type="image/webp", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": IMAGE_CACHE})


@router.post("/services/{code}/reports", status_code=status.HTTP_202_ACCEPTED)
def report_service(
    code: str, body: ReportIn, request: Request, db: DbDep, settings: SettingsDep, session: OptionalSessionDep
) -> dict[str, bool]:
    svc, _, _ = _visible(db, settings, code, _user(db, session))
    if body.reason not in REPORT_REASONS:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "신고 사유를 골라 주세요.")
    detail = _field(body.detail, store.clean_text, "신고 내용", 4000, required=True)
    if len(detail) < 10:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", "무엇이 문제인지 10자 이상 적어 주세요.")
    contact = _field(body.contact, store.clean_line, "연락처", 320)
    now = utcnow()
    iph = ip_hash(settings.secret, client_ip(request))
    recent = db.scalar(
        select(func.count()).select_from(ShowroomReport).where(ShowroomReport.ip_hash == iph, ShowroomReport.created_at > now - timedelta(hours=1))
    )
    if (recent or 0) >= REPORT_IP_LIMIT:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "too_many_requests", "신고가 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.")
    db.add(
        ShowroomReport(
            service_id=svc.id,
            service_code=svc.code,
            service_name=svc.name,
            reason=body.reason,
            detail=detail,
            contact=contact,
            reporter_id=session.user_id if session else None,
            ip_hash=iph,
            created_at=now,
        )
    )
    db.commit()
    log.info("Showroom 신고 접수: %s (%s)", svc.code, body.reason)
    return {"ok": True}


# ── 올리는 회원 ──


@router.get("/me/services")
def my_services(db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    publisher = _publisher(db, user.id)
    rows = db.scalars(select(ShowroomService).where(ShowroomService.owner_id == user.id).order_by(ShowroomService.created_at.desc()))
    official = store.is_admin(settings, user)
    return {"services": [service.service_out(s, publisher, private=True, official=official) for s in rows]}


@router.post("/services", status_code=status.HTTP_201_CREATED)
def create_service(body: ServiceIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    publisher = _ready_publisher(db, settings, user)
    now = utcnow()
    if service.submissions_24h(db, user.id, now) >= service.DAILY_SUBMISSIONS:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "daily_limit", f"24시간 동안 등록할 수 있는 서비스({service.DAILY_SUBMISSIONS}개)를 모두 썼습니다.")
    total = db.scalar(select(func.count()).select_from(ShowroomService).where(ShowroomService.owner_id == user.id)) or 0
    if total >= service.MAX_PER_USER:
        raise api_error(status.HTTP_409_CONFLICT, "quota", f"서비스는 {service.MAX_PER_USER}개까지 둘 수 있습니다. 쓰지 않는 서비스를 지워 주세요.")
    svc = ShowroomService(
        code=new_code(),
        owner_id=user.id,
        name=_field(body.name, store.clean_line, "서비스 이름", 80, required=True),
        url=_url(body.url),
        summary=_field(body.summary, store.clean_line, "한 줄 소개", 160),
        description=_field(body.description, store.clean_text, "설명", DESCRIPTION_MAX),
        category=_category(body.category),
        created_at=now,
        updated_at=now,
    )
    while db.scalar(select(ShowroomService.id).where(ShowroomService.code == svc.code)) is not None:
        svc.code = new_code()
    db.add(svc)
    db.commit()
    log.info("Showroom 새 서비스 접수: %s (검토 대기)", svc.code)
    return service.service_out(svc, publisher, private=True, official=store.is_admin(settings, user))


@router.patch("/services/{code}")
def edit_service(code: str, body: ServicePatch, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    user = _signed_in(db, session)
    svc, as_admin = _editable(db, settings, code, user)
    if body.name is not None:
        svc.name = _field(body.name, store.clean_line, "서비스 이름", 80, required=True)
    if body.summary is not None:
        svc.summary = _field(body.summary, store.clean_line, "한 줄 소개", 160)
    if body.description is not None:
        svc.description = _field(body.description, store.clean_text, "설명", DESCRIPTION_MAX)
    if body.category is not None:
        svc.category = _category(body.category)
    if body.url is not None:
        url = _url(body.url)
        if url != svc.url:
            svc.url = url
            # 검토를 거친 주소만 공개한다. 숨긴 서비스는 숨긴 채로 둔다. 운영자가 바꾼 주소는 운영자가 본 것이다
            if svc.status == "published" and not as_admin:
                svc.status = "pending"
                svc.status_reason = "주소가 바뀌어 다시 검토합니다."
    if svc.status == "rejected" and not as_admin:  # 반려된 서비스를 고치면 다시 검토를 받는다
        svc.status = "pending"
        svc.status_reason = ""
    svc.updated_at = utcnow()
    db.commit()
    return _edited_out(db, settings, svc, as_admin)


@router.delete("/services/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(code: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> None:
    user = _signed_in(db, session)
    svc = _service(db, code)
    as_admin = svc.owner_id != user.id
    if as_admin and not store.is_admin(settings, user):  # 소개한 사람(차단돼도 자기 것은 지운다)과 운영자만
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "서비스를 찾을 수 없습니다.")
    service.delete_files(settings, svc.code)
    for r in db.scalars(select(ShowroomReport).where(ShowroomReport.service_id == svc.id)):
        r.service_id = None
    db.delete(svc)
    db.commit()
    log.info("Showroom 서비스 삭제%s: %s", " (운영자)" if as_admin else "", code)


@router.put("/uploads/{code}/icon")
async def upload_icon(code: str, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    data = await read_limited(request, ICON_UPLOAD_MAX_BYTES, "아이콘 그림")
    return await run_in_threadpool(_save_image, db, settings, session, code, data, "icon")


@router.put("/uploads/{code}/screenshot")
async def upload_screenshot(code: str, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    data = await read_limited(request, SCREENSHOT_UPLOAD_MAX_BYTES, "화면 그림")
    return await run_in_threadpool(_save_image, db, settings, session, code, data, "screenshot")


def _save_image(db: Session, settings: Settings, session: AuthSession, code: str, data: bytes, kind: str) -> dict[str, Any]:
    user = _signed_in(db, session)
    svc, as_admin = _editable(db, settings, code, user)
    if not data:
        raise api_error(status.HTTP_400_BAD_REQUEST, "empty", "빈 파일입니다.")
    d = service.Dirs(settings)
    d.ensure()
    tmp = new_upload_id()
    src = d.tmp / f"{tmp}.src"
    out = d.tmp / f"{tmp}.{'png' if kind == 'icon' else 'webp'}"
    try:
        src.write_bytes(data)
        result = run_icon_isolated(src, out) if kind == "icon" else run_screenshot_isolated(src, out)
        head = out.read_bytes()[:12] if out.is_file() else b""
        ok = head[:8] == b"\x89PNG\r\n\x1a\n" if kind == "icon" else (head[:4] == b"RIFF" and head[8:12] == b"WEBP")
        limit = ICON_MAX_BYTES if kind == "icon" else SHOT_MAX_BYTES
        if "error" in result or not ok or out.stat().st_size > limit:
            raise api_error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "bad_image", str(result.get("error") or "그림을 처리하지 못했습니다."))
        if kind == "icon":
            out.replace(d.icon(svc.code))
            svc.has_icon = True
        else:
            out.replace(d.shot(svc.code))
            svc.has_screenshot = True
    finally:
        remove(src)
        remove(out)
    svc.updated_at = utcnow()
    db.commit()
    return _edited_out(db, settings, svc, as_admin, "아이콘" if kind == "icon" else "화면 그림")


@router.put("/uploads/{code}/gallery", status_code=status.HTTP_201_CREATED)
async def upload_gallery_image(code: str, request: Request, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    data = await read_limited(request, IMAGE_UPLOAD_MAX_BYTES, "그림")
    return await run_in_threadpool(_save_gallery_image, db, settings, session, code, data)


def _save_gallery_image(db: Session, settings: Settings, session: AuthSession, code: str, data: bytes) -> dict[str, Any]:
    """그림 하나를 다시 그려 그림 모음 끝에 넣는다 (Store 와 같다)"""
    user = _signed_in(db, session)
    svc, as_admin = _editable(db, settings, code, user)
    page = dict(svc.page.data) if svc.page else {}
    gallery = list(page.get("gallery", []))
    if len(gallery) >= GALLERY_MAX:
        raise api_error(status.HTTP_409_CONFLICT, "gallery_full", f"그림은 {GALLERY_MAX}장까지 넣을 수 있습니다. 쓰지 않는 그림을 빼고 저장한 뒤 올려 주세요.")
    try:
        image = Gallery(settings, "showroom", svc.code).save(data)
    except ListingError as err:
        raise api_error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "bad_image", str(err)) from None
    now = utcnow()
    service.set_page(svc, {**page, "gallery": [*gallery, image]}, now)
    svc.updated_at = now
    db.commit()
    if as_admin:
        log.info("Showroom 운영자가 소개 그림을 더함: %s", svc.code)
    return {"image": image}


@router.put("/services/{code}/page")
def save_page(code: str, body: PageIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    """소개 자료 저장. 바로 반영한다 (서비스 주소만 다시 검토한다)"""
    user = _signed_in(db, session)
    svc, as_admin = _editable(db, settings, code, user)
    try:
        data = clean_page(body, svc.page.data if svc.page else None)
    except ListingError as err:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_field", str(err)) from None
    now = utcnow()
    service.set_page(svc, data, now)
    if svc.status == "rejected" and not as_admin:  # 반려된 서비스를 고치면 다시 검토를 받는다 (edit_service 와 같다)
        svc.status = "pending"
        svc.status_reason = ""
    svc.updated_at = now
    db.commit()
    Gallery(settings, "showroom", svc.code).keep_only({g["id"] for g in data["gallery"]})
    return _edited_out(db, settings, svc, as_admin, "소개 자료")


# ── 운영자 ──


@router.get("/admin/overview")
def admin_overview(db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    now = utcnow()
    service.purge_expired(db, now)
    db.commit()
    pending = db.scalars(select(ShowroomService).where(ShowroomService.status == "pending").order_by(ShowroomService.updated_at))
    reports = db.scalars(select(ShowroomReport).where(ShowroomReport.status == "open").order_by(ShowroomReport.created_at))
    hidden = db.scalars(select(ShowroomService).where(ShowroomService.status == "hidden").order_by(ShowroomService.updated_at.desc()).limit(50))
    recent = db.scalars(select(ShowroomService).where(ShowroomService.status == "published").order_by(ShowroomService.updated_at.desc()).limit(30))
    return {
        "pending": [_owner_view(db, s, settings) for s in pending],
        "reports": [
            {
                "id": r.id,
                "service_code": r.service_code,
                "service_name": r.service_name,
                "service_exists": r.service_id is not None,
                "reason": r.reason,
                "reason_label": REPORT_REASONS.get(r.reason, r.reason),
                "detail": r.detail,
                "contact": r.contact,
                "signed_in": r.reporter_id is not None,
                "created_at": store.iso(r.created_at),
            }
            for r in reports
        ],
        "hidden": [_owner_view(db, s, settings) for s in hidden],
        "recent": [_owner_view(db, s, settings) for s in recent],
    }


@router.post("/admin/services/{code}/approve")
def approve_service(code: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    svc = _service(db, code)
    if svc.status != "pending":
        raise api_error(status.HTTP_409_CONFLICT, "not_pending", "검토 대기 중인 서비스가 아닙니다.")
    now = utcnow()
    svc.status = "published"
    svc.status_reason = ""
    svc.reviewed_at = now
    svc.published_at = svc.published_at or now
    db.commit()
    log.info("Showroom 승인: %s", code)
    return _owner_view(db, svc, settings)


@router.post("/admin/services/{code}/reject")
def reject_service(code: str, body: ReasonIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    svc = _service(db, code)
    svc.status = "rejected"
    svc.status_reason = _field(body.reason, store.clean_line, "반려 사유", 300, required=True)
    svc.reviewed_at = utcnow()
    db.commit()
    return _owner_view(db, svc, settings)


@router.post("/admin/services/{code}/hide")
def hide_service(code: str, body: ReasonIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    svc = _service(db, code)
    svc.status = "hidden"
    svc.status_reason = _field(body.reason, store.clean_line, "숨기는 사유", 300, required=True)
    svc.updated_at = utcnow()
    db.commit()
    return _owner_view(db, svc, settings)


@router.post("/admin/services/{code}/unhide")
def unhide_service(code: str, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    svc = _service(db, code)
    if svc.status != "hidden":
        raise api_error(status.HTTP_409_CONFLICT, "not_hidden", "숨긴 서비스가 아닙니다.")
    # 숨긴 동안 주소가 바뀌었을 수 있으므로 다시 공개하지 않고 검토 대기로 돌린다
    svc.status = "pending"
    svc.status_reason = ""
    svc.updated_at = utcnow()
    db.commit()
    return _owner_view(db, svc, settings)


@router.post("/admin/reports/{report_id}/resolve")
def resolve_report(report_id: int, body: ResolveIn, db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, bool]:
    _admin(db, settings, session)
    r = db.get(ShowroomReport, report_id)
    if r is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "신고를 찾을 수 없습니다.")
    r.status = body.status
    r.note = store.clean_line(body.note)[:300]
    r.resolved_at = utcnow()
    db.commit()
    return {"ok": True}

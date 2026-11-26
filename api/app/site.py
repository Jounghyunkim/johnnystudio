"""사이트 전체 엔드포인트 (/api/site/). 설정 화면(/settings/)이 쓴다.

누구나
  POST /clear-cache     이 브라우저의 HTTP 캐시(그림·스크립트)를 지우게 한다: 응답 머리글 Clear-Site-Data: "cache".
                        서버에서는 아무것도 바꾸지 않고, 쿠키·브라우저 저장소는 건드리지 않는다 (로그인 유지).
                        브라우저가 HTTPS(또는 localhost)에서만 따른다
운영자 (JOHNNYSTUDIO_STORE_ADMINS)
  GET  /admin/stats     회원·Store·Showroom 현황(개수만)과 운영 설정(비밀값 제외, 읽기 전용).
                        trends: 최근 90일 하루 가입 수(한국 시간 날짜), 마지막 로그인 분포, 내려받기가 많은 앱 (설정 화면의 차트)

현황은 개수만 낸다. 회원 이메일 목록은 내지 않는다 (개인정보처리방침: 이메일은 운영자가 검토·신고 처리에만 쓴다).
운영 설정은 환경 변수(api.env, 개발은 api/.env.local)가 원본이라 이 화면에서 바꾸지 않는다 (app/config.py).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from .auth import DbDep, SettingsDep
from .db import AuthSession, User, utcnow
from .showroom.models import SERVICE_STATUSES, ShowroomReport, ShowroomService
from .store import service as store
from .store.models import APP_STATUSES, StoreApp, StorePublisher, StoreRelease, StoreReport
from .store.router import SessionDep, _admin
from .store.scan import find_clamscan

router = APIRouter(prefix="/api/site")

TREND_DAYS = 90
KST = timezone(timedelta(hours=9))  # 날짜는 한국 시간으로 나눈다 (사이트를 쓰는 곳)
TOP_DOWNLOADS = 8


def _kst_day(value: datetime) -> date:
    return value.astimezone(KST).date()


def _trends(db: Session, now: datetime) -> dict[str, Any]:
    """차트용 값. 개수만 낸다 (회원 이메일·ID 는 없다)"""
    today = _kst_day(now)
    first = today - timedelta(days=TREND_DAYS - 1)
    since = datetime(first.year, first.month, first.day, tzinfo=KST)
    per_day: dict[date, int] = {}
    for (created,) in db.execute(select(User.created_at).where(User.created_at >= since)).all():
        d = _kst_day(created)
        per_day[d] = per_day.get(d, 0) + 1
    signups = [{"date": (first + timedelta(days=i)).isoformat(), "count": per_day.get(first + timedelta(days=i), 0)} for i in range(TREND_DAYS)]
    before = _count(db, select(func.count()).select_from(User).where(User.created_at < since))

    # 마지막 로그인: 오늘(한국 시간) · 7일 안 · 30일 안 · 그 전
    start_today = datetime(today.year, today.month, today.day, tzinfo=KST)
    edges = [("today", start_today), ("week", start_today - timedelta(days=6)), ("month", start_today - timedelta(days=29))]
    recency: list[dict[str, Any]] = []
    upper: datetime | None = None
    for key, lower in edges:
        where = [User.last_login_at >= lower] + ([User.last_login_at < upper] if upper is not None else [])
        recency.append({"key": key, "count": _count(db, select(func.count()).select_from(User).where(*where))})
        upper = lower
    recency.append({"key": "older", "count": _count(db, select(func.count()).select_from(User).where(User.last_login_at < upper))})

    top = db.execute(
        select(StoreApp.code, StoreApp.name, StoreApp.download_count, StoreApp.owner_id)
        .where(StoreApp.status == "published", StoreApp.download_count > 0)
        .order_by(StoreApp.download_count.desc(), StoreApp.name)
        .limit(TOP_DOWNLOADS)
    ).all()
    return {
        "days": TREND_DAYS,
        "timezone": "Asia/Seoul",
        "signups": signups,
        "members_before": before,
        "login_recency": recency,
        "top_downloads": [{"code": c, "name": n, "count": int(k)} for c, n, k, _ in top],
    }


def _count(db: Session, stmt: Select[Any]) -> int:
    return int(db.scalar(stmt) or 0)


def _by_status(db: Session, model: type[StoreApp] | type[ShowroomService], statuses: tuple[str, ...]) -> dict[str, int]:
    found = {s: int(n) for s, n in db.execute(select(model.status, func.count()).group_by(model.status)).all()}
    return {s: found.get(s, 0) for s in statuses}


@router.post("/clear-cache", status_code=status.HTTP_204_NO_CONTENT)
def clear_cache() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Clear-Site-Data": '"cache"'})


@router.get("/admin/stats")
def admin_stats(db: DbDep, settings: SettingsDep, session: SessionDep) -> dict[str, Any]:
    _admin(db, settings, session)
    now = utcnow()

    def users(*where: Any) -> int:  # noqa: ANN401
        return _count(db, select(func.count()).select_from(User).where(*where))

    def signed_in(*where: Any) -> int:  # noqa: ANN401
        """로그인이 살아 있는 회원 수 (한 회원이 기기 여럿이면 한 번만 센다)"""
        return _count(db, select(func.count(func.distinct(AuthSession.user_id))).where(AuthSession.expires_at > now, *where))

    return {
        "generated_at": store.iso(now),
        "users": {
            "total": users(),
            "new_7d": users(User.created_at >= now - timedelta(days=7)),
            "new_30d": users(User.created_at >= now - timedelta(days=30)),
            "login_7d": users(User.last_login_at >= now - timedelta(days=7)),
            "with_password": users(User.password_hash.is_not(None)),
            "signed_in": signed_in(),
            # 세션의 마지막 사용 시각은 1시간 단위로만 고친다 (app/auth.py LAST_SEEN_RESOLUTION)
            "active_24h": signed_in(AuthSession.last_seen_at >= now - timedelta(hours=24)),
        },
        "store": {
            "publishers": _count(db, select(func.count()).select_from(StorePublisher)),
            "blocked": _count(db, select(func.count()).select_from(StorePublisher).where(StorePublisher.blocked_at.is_not(None))),
            "apps": _by_status(db, StoreApp, APP_STATUSES),
            "releases_pending": _count(db, select(func.count()).select_from(StoreRelease).where(StoreRelease.status == "pending")),
            "reports_open": _count(db, select(func.count()).select_from(StoreReport).where(StoreReport.status == "open")),
        },
        "showroom": {
            "services": _by_status(db, ShowroomService, SERVICE_STATUSES),
            "reports_open": _count(db, select(func.count()).select_from(ShowroomReport).where(ShowroomReport.status == "open")),
        },
        "trends": _trends(db, now),
        # 운영 설정 (읽기 전용). 비밀값·메일 서버 주소·폴더 경로는 내지 않는다
        "server": {
            "env": settings.env,
            "site_url": settings.site_url,
            "database": "PostgreSQL" if settings.database_url.startswith("postgresql") else "SQLite",
            "mail_backend": settings.mail_backend,
            "session_days": settings.session_days,
            "admins": len(settings.store_admins),
            "uploads_open": settings.store_uploads_open,
            "scan_required": settings.store_require_scan,
            "scanner": find_clamscan(settings.store_clamscan) is not None,
            "file_max_mb": settings.store_file_max_mb,
            "user_quota_mb": settings.store_user_quota_mb,
            "daily_uploads": settings.store_daily_uploads,
            "terms_version": store.TERMS_VERSION,
        },
    }

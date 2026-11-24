"""Showroom 공통 로직. auth.py(회원 탈퇴)가 가져오므로 auth.py 를 가져오지 않는다."""

from __future__ import annotations

import ipaddress
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import User
from ..store.files import remove
from ..store.models import StorePublisher
from ..store.service import REPORT_RETENTION, iso
from .models import SERVICE_CATEGORIES, ShowroomReport, ShowroomService

log = logging.getLogger("johnnystudio.showroom")

DAILY_SUBMISSIONS = 10  # 회원 한 명이 24시간에 새로 등록할 수 있는 서비스 수
MAX_PER_USER = 50  # 회원 한 명이 둘 수 있는 서비스 수


class Dirs:
    """그림 폴더: <store_dir>/showroom/{icons,shots,tmp}"""

    def __init__(self, settings: Settings) -> None:
        root = settings.store_dir / "showroom"
        self.icons = root / "icons"
        self.shots = root / "shots"
        self.tmp = root / "tmp"

    def ensure(self) -> None:
        for d in (self.icons, self.shots, self.tmp):
            d.mkdir(parents=True, exist_ok=True, mode=0o750)

    @staticmethod
    def _code(code: str) -> str:
        if not re.fullmatch(r"[0-9A-Za-z]{4,12}", code):
            raise ValueError("서비스 코드 형식")
        return code

    def icon(self, code: str) -> Path:
        return self.icons / f"{self._code(code)}.png"

    def shot(self, code: str) -> Path:
        return self.shots / f"{self._code(code)}.webp"


def clean_url(raw: str) -> str | None:
    """서비스 주소: https, 사용자 정보 없음, IP·localhost 아님, 점이 있는 호스트. 맞지 않으면 None"""
    text = raw.strip()
    if not text or len(text) > 500 or any(c.isspace() or ord(c) < 0x20 for c in text):
        return None
    try:
        parts = urlsplit(text)
        host = parts.hostname or ""
        port = parts.port
    except ValueError:
        return None
    if parts.scheme.lower() != "https" or not host or parts.username or parts.password:
        return None
    if host == "localhost" or host.endswith(".localhost") or "." not in host.strip("."):
        return None
    try:
        ipaddress.ip_address(host)
        return None  # IP 주소는 받지 않는다
    except ValueError:
        pass
    netloc = host.lower() + (f":{port}" if port else "")
    return urlunsplit(("https", netloc, parts.path or "/", parts.query, ""))


def host_of(url: str) -> str:
    return urlsplit(url).hostname or url


def is_public(svc: ShowroomService, publisher: StorePublisher | None) -> bool:
    return svc.status == "published" and publisher is not None and publisher.blocked_at is None


def service_out(svc: ShowroomService, publisher: StorePublisher | None, *, private: bool, owner: User | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "code": svc.code,
        "name": svc.name,
        "url": svc.url,
        "host": host_of(svc.url),
        "summary": svc.summary,
        "description": svc.description,
        "category": svc.category,
        "category_label": SERVICE_CATEGORIES.get(svc.category, "기타"),
        "publisher": publisher.display_name if publisher else "",
        "has_icon": svc.has_icon,
        "has_screenshot": svc.has_screenshot,
        "published_at": iso(svc.published_at),
        "updated_at": iso(svc.updated_at),
    }
    if private:
        out |= {
            "status": svc.status,
            "status_reason": svc.status_reason,
            "public": is_public(svc, publisher),
            "created_at": iso(svc.created_at),
            "reviewed_at": iso(svc.reviewed_at),
        }
    if owner is not None:
        out["owner"] = {
            "id": owner.id,
            "email": owner.email,
            "blocked": bool(publisher and publisher.blocked_at),
            "blocked_reason": publisher.blocked_reason if publisher else "",
        }
    return out


def card_out(svc: ShowroomService, publisher: StorePublisher | None) -> dict[str, Any]:
    return {
        "code": svc.code,
        "name": svc.name,
        "url": svc.url,
        "host": host_of(svc.url),
        "summary": svc.summary,
        "category": svc.category,
        "category_label": SERVICE_CATEGORIES.get(svc.category, "기타"),
        "publisher": publisher.display_name if publisher else "",
        "has_icon": svc.has_icon,
        "updated_at": iso(svc.published_at or svc.updated_at),
    }


def delete_files(settings: Settings, code: str) -> None:
    d = Dirs(settings)
    remove(d.icon(code))
    remove(d.shot(code))


def purge_expired(db: Session, now: datetime) -> None:
    db.execute(delete(ShowroomReport).where(ShowroomReport.status != "open", ShowroomReport.resolved_at < now - REPORT_RETENTION))


def purge_user(db: Session, settings: Settings, user_id: str) -> None:
    """회원 탈퇴: 그 회원의 서비스와 그림을 지운다. 신고 기록은 연결만 끊는다. 커밋은 부르는 쪽이 한다."""
    services = list(db.scalars(select(ShowroomService).where(ShowroomService.owner_id == user_id)))
    for svc in services:
        delete_files(settings, svc.code)
    ids = [s.id for s in services]
    if ids:
        db.execute(update(ShowroomReport).where(ShowroomReport.service_id.in_(ids)).values(service_id=None))
        db.execute(delete(ShowroomService).where(ShowroomService.id.in_(ids)))
        log.info("회원 탈퇴: Showroom 서비스 %d개를 지웠다", len(ids))
    db.execute(update(ShowroomReport).where(ShowroomReport.reporter_id == user_id).values(reporter_id=None))


def submissions_24h(db: Session, user_id: str, now: datetime) -> int:
    from sqlalchemy import func

    return int(
        db.scalar(
            select(func.count()).select_from(ShowroomService).where(
                ShowroomService.owner_id == user_id, ShowroomService.created_at > now - timedelta(hours=24)
            )
        )
        or 0
    )

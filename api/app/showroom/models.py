"""Showroom 테이블. db.py 의 Base 로 create_all 에 함께 들어간다. 기존 테이블에는 열을 더하지 않는다."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base, UTCDateTime, utcnow

# 서비스 상태: Store 앱과 같다 (검토 대기 → 공개 | 반려, 공개 → 숨김)
SERVICE_STATUSES = ("pending", "published", "rejected", "hidden")

SERVICE_CATEGORIES: dict[str, str] = {
    "productivity": "생산성",
    "developer": "개발 도구",
    "ai": "AI",
    "education": "교육",
    "design": "디자인·미디어",
    "game": "게임",
    "community": "커뮤니티",
    "utility": "유틸리티",
    "other": "기타",
}


class ShowroomService(Base):
    __tablename__ = "showroom_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    # https 주소만. 승인 뒤에 바꾸면 다시 검토한다 (router.edit_service)
    url: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), default="other")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    status_reason: Mapped[str] = mapped_column(String(300), default="")
    has_icon: Mapped[bool] = mapped_column(Boolean, default=False)
    has_screenshot: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    # 소개 자료 (ADR-0013). 없을 수도 있다
    page: Mapped[ShowroomServicePage | None] = relationship(cascade="all, delete-orphan", passive_deletes=True, lazy="selectin")


class ShowroomServicePage(Base):
    """서비스의 소개 자료. 모양은 app/listing.py (Store 의 store_app_pages 와 같다)"""

    __tablename__ = "showroom_service_pages"

    service_id: Mapped[int] = mapped_column(ForeignKey("showroom_services.id", ondelete="CASCADE"), primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    search_text: Mapped[str] = mapped_column(String(400), default="")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class ShowroomReport(Base):
    """신고. 서비스나 신고자 계정이 지워져도 처리 기록은 남긴다."""

    __tablename__ = "showroom_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("showroom_services.id", ondelete="SET NULL"), index=True)
    service_code: Mapped[str] = mapped_column(String(12))
    service_name: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(String(16))
    detail: Mapped[str] = mapped_column(Text)
    contact: Mapped[str] = mapped_column(String(320), default="")
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

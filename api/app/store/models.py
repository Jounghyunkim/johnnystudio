"""Store 테이블. db.py 의 Base 를 함께 써서 시작할 때 create_all 로 만든다.

- 기존 users 테이블에는 열을 더하지 않는다. 회원의 Store 정보(표시 이름·약관 동의·차단)는 store_publishers 에 둔다.
- 상태 값은 문자열이다 (enum 타입 없이 두 DB 에서 똑같이 동작하게).
- 회원이 탈퇴하면 그 회원의 앱·버전·업로드가 함께 지워진다 (외래 키 CASCADE + files.purge_user 가 파일을 지운다).
  신고는 처리 기록으로 남기고 신고자·앱 연결만 끊는다 (SET NULL).
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base, UTCDateTime, utcnow

# 앱 상태: 검토 대기 → 공개 | 반려. 공개한 앱은 운영자가 숨길 수 있다
APP_STATUSES = ("pending", "published", "rejected", "hidden")
# 버전(설치 파일) 상태
RELEASE_STATUSES = ("pending", "published", "rejected")
# 검사 상태: 대기 → 검사 중 → 탐지 없음 | 탐지 | 실패 | 건너뜀(ClamAV 없음)
SCAN_STATUSES = ("queued", "scanning", "clean", "infected", "error", "skipped")
# 업로드: 받는 중 → 분석까지 끝남 → 버전으로 씀
UPLOAD_STATUSES = ("receiving", "ready", "used")
REPORT_STATUSES = ("open", "actioned", "dismissed")

# JohnnyStore 와 같은 분류
CATEGORIES: dict[str, str] = {
    "utility": "유틸리티",
    "productivity": "생산성",
    "developer": "개발 도구",
    "media": "미디어",
    "game": "게임",
    "security": "보안",
    "system": "시스템",
    "other": "기타",
}

# JohnnyStore 와 같은 신고 사유
REPORT_REASONS: dict[str, str] = {
    "malware": "악성코드·유해 프로그램",
    "copyright": "저작권·상표 등 권리 침해",
    "illegal": "불법 프로그램·콘텐츠",
    "privacy": "개인정보 노출",
    "spam": "스팸·허위 정보·사칭",
    "other": "기타",
}

# 짧은 공개 코드 (/store/app/?id=…). 헷갈리는 글자(0 O 1 l I)를 뺐다 (JohnnyStore 와 같다)
CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"


def new_code(length: int = 8) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


class StorePublisher(Base):
    """앱을 올리는 회원. 처음 올리기 전에 표시 이름을 정하고 Store 이용약관에 동의한다."""

    __tablename__ = "store_publishers"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(40))
    terms_version: Mapped[str] = mapped_column(String(20))
    agreed_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    blocked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    blocked_reason: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class StoreApp(Base):
    __tablename__ = "store_apps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), default="other")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    # 반려·숨김 사유 (올린 사람에게 보인다)
    status_reason: Mapped[str] = mapped_column(String(300), default="")
    has_icon: Mapped[bool] = mapped_column(Boolean, default=False)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    releases: Mapped[list[StoreRelease]] = relationship(
        back_populates="app",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoreRelease.created_at.desc(), StoreRelease.id.desc()",
        lazy="selectin",
    )


class StoreRelease(Base):
    """앱의 한 버전 = 설치 파일 하나. 운영자가 승인해야 내려받을 수 있다."""

    __tablename__ = "store_releases"
    __table_args__ = (UniqueConstraint("app_id", "version", name="uq_store_release_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    app_id: Mapped[int] = mapped_column(ForeignKey("store_apps.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str] = mapped_column(Text, default="")
    # 내려받을 때 쓰는 이름. 저장은 무작위 키(files/<storage_key>)로 한다
    file_name: Mapped[str] = mapped_column(String(200))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True)
    # 파일이 아직 있는가 (반려·탐지되면 파일을 지우고 기록만 남긴다)
    stored: Mapped[bool] = mapped_column(Boolean, default=True)
    size: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    file_type: Mapped[str] = mapped_column(String(8))
    arch: Mapped[str] = mapped_column(String(12), default="unknown")
    # Authenticode 서명 블록이 있는가 (서명이 유효한지는 확인하지 않는다)
    signed: Mapped[bool] = mapped_column(Boolean, default=False)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    status_reason: Mapped[str] = mapped_column(String(300), default="")
    scan_status: Mapped[str] = mapped_column(String(16), default="queued")
    scan_engine: Mapped[str] = mapped_column(String(80), default="")
    scan_detail: Mapped[str] = mapped_column(String(300), default="")
    scanned_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    app: Mapped[StoreApp] = relationship(back_populates="releases")


class StoreUpload(Base):
    """조각으로 받는 중이거나, 받아서 분석까지 끝나 앱·버전 등록을 기다리는 파일 (하루 뒤 지운다).

    하루 업로드 횟수 제한은 이 기록으로 센다. 그래서 버전으로 쓴 뒤에도(used) 이틀 동안 남긴다.
    """

    __tablename__ = "store_uploads"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(200))
    size: Mapped[int] = mapped_column(BigInteger)
    received: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(16), default="receiving")
    sha256: Mapped[str | None] = mapped_column(String(64))
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())


class StoreReport(Base):
    """신고. 앱이나 신고자 계정이 지워져도 처리 기록은 남긴다 (앱 이름·코드를 따로 적어 둔다)."""

    __tablename__ = "store_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    app_id: Mapped[int | None] = mapped_column(ForeignKey("store_apps.id", ondelete="SET NULL"), index=True)
    app_code: Mapped[str] = mapped_column(String(12))
    app_name: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(String(16))
    detail: Mapped[str] = mapped_column(Text)
    # 답을 받을 연락처 (선택). 권리자 신고처럼 회원이 아닌 사람도 신고할 수 있다
    contact: Mapped[str] = mapped_column(String(320), default="")
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # 요청 횟수 제한용 (IP 를 그대로 저장하지 않는다)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

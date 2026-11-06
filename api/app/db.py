"""DB 테이블과 연결. 운영은 PostgreSQL, 개발·테스트는 SQLite 다.

두 DB 에서 똑같이 동작하도록 SQLAlchemy 의 공통 기능만 쓴다 (방언 전용 타입·함수 없음).
스키마는 시작할 때 create_all 로 만든다. 아직 운영 DB 가 없어서 스키마를 그대로 고친다.
운영에 처음 설치한 뒤의 변경부터는 Alembic 마이그레이션으로 한다 (ADR-0008).
개발용 SQLite 는 스키마가 코드와 다르면 지우고 다시 만든다 (ensure_schema). 운영 DB 는 절대 지우지 않고 시작을 멈춘다.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import DateTime, ForeignKey, String, TypeDecorator, create_engine, event, inspect
from sqlalchemy.engine import Dialect, Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """항상 UTC aware datetime 으로 읽고 쓴다. SQLite 는 시간대를 저장하지 않아서 UTC 로 맞춰 둔다."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("시간대 없는 datetime 은 저장하지 않는다")
        value = value.astimezone(UTC)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class Base(DeclarativeBase):
    pass


log = logging.getLogger("johnnystudio.db")


class User(Base):
    """회원. 이메일과 비밀번호 해시 말고는 개인정보를 받지 않는다 (ideation R8: 최소 수집)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    # scrypt 해시 (app/passwords.py). 가입 직후 비밀번호를 정하기 전에는 비어 있다 → 메일 링크로만 로그인
    password_hash: Mapped[str | None] = mapped_column(String(255))
    password_changed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class LoginToken(Base):
    """메일로 보낸 로그인 링크. 원래 토큰은 저장하지 않고 SHA-256 해시만 남긴다."""

    __tablename__ = "login_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    next_path: Mapped[str | None] = mapped_column(String(200))
    # signup | login | reset: 메일 문구와, 링크를 연 뒤 비밀번호 설정 화면을 보여 줄지를 정한다
    purpose: Mapped[str] = mapped_column(String(16), default="login")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class AuthSession(Base):
    """로그인 세션. 쿠키에는 원래 토큰이, DB 에는 그 해시가 있다."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # link: 메일 링크로 만든 세션 (만든 지 얼마 안 됐으면 현재 비밀번호 없이 새 비밀번호를 정할 수 있다) | password
    method: Mapped[str] = mapped_column(String(16), default="link")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class LoginFailure(Base):
    """비밀번호 로그인 실패. 비밀번호 대입을 막는 횟수 제한에 쓰고 하루 뒤에 지운다. IP 는 HMAC 만 남긴다."""

    __tablename__ = "login_failures"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        path = url.removeprefix("sqlite:///")
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(conn, _record) -> None:  # noqa: ANN001
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

        return engine
    return create_engine(url, pool_pre_ping=True)


class Database:
    def __init__(self, url: str) -> None:
        self.engine = make_engine(url)
        self._sessions = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def outdated_tables(self) -> list[str]:
        """이미 있는 테이블 중 코드에 있는 열이 빠진 것 (예: 'users: password_hash')"""
        insp = inspect(self.engine)
        outdated = []
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            missing = sorted(c.name for c in table.columns if c.name not in have)
            if missing:
                outdated.append(f"{table.name}: {', '.join(missing)}")
        return outdated

    def ensure_schema(self, reset_if_outdated: bool) -> None:
        outdated = self.outdated_tables()
        if outdated:
            if not reset_if_outdated:
                raise RuntimeError(f"DB 스키마가 코드와 다르다. 마이그레이션이 필요하다: {'; '.join(outdated)}")
            log.warning("개발 DB 의 스키마가 바뀌어 다시 만든다 (시험용 계정이 지워진다): %s", "; ".join(outdated))
            Base.metadata.drop_all(self.engine)
        self.create_all()

    def session(self) -> Iterator[Session]:
        with self._sessions() as s:
            yield s

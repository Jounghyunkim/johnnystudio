"""테스트 준비. 기본은 테스트마다 새 SQLite 파일이다.

PostgreSQL 에서도 돌리려면 빈 DB 주소를 준다 (테스트가 테이블을 만들고 지운다):
    JOHNNYSTUDIO_TEST_DATABASE_URL=postgresql+psycopg://…/johnnystudio_test uv run pytest
"""

from __future__ import annotations

import os
import re
import struct
from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Base
from app.mailer import Mail
from app.main import create_app

SITE = "http://127.0.0.1:3000"


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[Mail] = []

    def send(self, mail: Mail) -> None:
        self.sent.append(mail)

    def last_token(self) -> str:
        m = re.search(r"/login/verify/#t=([A-Za-z0-9_-]+)", self.sent[-1].body)
        assert m, self.sent[-1].body
        return m.group(1)


@pytest.fixture
def settings(tmp_path) -> Settings:  # noqa: ANN001
    url = os.environ.get("JOHNNYSTUDIO_TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.sqlite3'}"
    # 비밀번호 해시 강도만 낮춘다 (운영 2^17 은 한 번에 0.5초라 테스트가 느려진다)
    return Settings(site_url=SITE, database_url=url, secret="t" * 40, password_cost=10)


@pytest.fixture
def mailer() -> FakeMailer:
    return FakeMailer()


def make_client(settings: Settings, mailer: FakeMailer, peer: str = "testclient") -> Iterator[TestClient]:
    """peer: 요청이 온 TCP 주소. nginx 뒤를 흉내 내려면 "127.0.0.1" """
    app = create_app(settings, mailer)
    with TestClient(app, headers={"Origin": SITE}, client=(peer, 50000)) as c:
        yield c
    Base.metadata.drop_all(app.state.db.engine)
    app.state.db.engine.dispose()


@pytest.fixture
def client(settings: Settings, mailer: FakeMailer) -> Iterator[TestClient]:
    yield from make_client(settings, mailer)


@pytest.fixture
def strict_client(settings: Settings, mailer: FakeMailer) -> Iterator[TestClient]:
    """요청 횟수 제한을 낮춘 클라이언트"""
    yield from make_client(replace(settings, email_limit=2, ip_limit=3), mailer)


def make_pe(machine: int = 0x8664, payload: bytes = b"") -> bytes:
    """리소스 없는 최소 PE 이미지 (아키텍처 판별·시그니처 검증용). 출처: johnnystore 6dc01fe (보관본) tests/conftest.py"""
    plus = machine in (0x8664, 0xAA64)
    dos = bytearray(64)
    dos[0:2] = b"MZ"
    struct.pack_into("<I", dos, 0x3C, 64)
    opt = bytearray(240 if plus else 224)
    struct.pack_into("<H", opt, 0, 0x20B if plus else 0x10B)
    struct.pack_into("<H", opt, 68, 2)  # Subsystem = GUI
    struct.pack_into("<I", opt, 108 if plus else 92, 16)  # NumberOfRvaAndSizes
    coff = struct.pack("<HHIIIHH", machine, 0, 0, 0, 0, len(opt), 0x0022 if plus else 0x0102)
    return bytes(dos) + b"PE\x00\x00" + coff + bytes(opt) + b"\x00" * 256 + payload

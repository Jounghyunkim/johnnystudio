"""토큰·해시·입력 검사. 외부 의존 없이 표준 라이브러리만 쓴다."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets

# 실제로 쓰이는 주소만 받는다: ASCII, 로컬 파트 64자, 전체 254자 (RFC 5321).
# 줄바꿈·공백이 들어갈 수 없어서 메일 헤더 주입도 막힌다.
_EMAIL = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}"
    r"@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def normalize_email(raw: str) -> str | None:
    """앞뒤 공백을 지우고 소문자로 바꾼다. 형식이 맞지 않으면 None."""
    email = raw.strip().lower()
    if len(email) > 254 or not _EMAIL.match(email):
        return None
    local, _, _ = email.partition("@")
    if local.startswith(".") or local.endswith(".") or ".." in local:
        return None
    return email


def new_token() -> str:
    """URL 에 그대로 넣을 수 있는 256비트 무작위 토큰"""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def ip_hash(secret: str, ip: str) -> str:
    """IP 를 그대로 저장하지 않는다. 비밀값으로 HMAC 한 값만 요청 횟수 제한에 쓴다."""
    return hmac.new(secret.encode(), ip.encode(), hashlib.sha256).hexdigest()


def safe_next(path: str | None) -> str | None:
    """로그인 뒤 돌아갈 주소. 이 사이트 안의 경로만 받는다 (다른 사이트로 보내는 열린 리다이렉트 방지)."""
    if not path or len(path) > 200:
        return None
    if not path.startswith("/") or path.startswith("//") or "\\" in path:
        return None
    if any(ord(c) < 0x20 or c.isspace() for c in path):
        return None
    if path.startswith(("/api/", "/login/", "/signup/")):
        return None
    return path

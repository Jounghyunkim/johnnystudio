"""비밀번호 해시와 규칙 (ADR-0008). 표준 라이브러리 hashlib.scrypt 만 쓴다.

저장 형식: scrypt$<log2 N>$<r>$<p>$<salt base64>$<hash base64>
  - 기본 강도: N=2^17, r=8, p=1 (OWASP Password Storage Cheat Sheet 의 scrypt 권장값, 메모리 128MiB, M8 에서 약 0.5초)
  - 강도를 올리면 다음 로그인 때 새 강도로 다시 해시한다 (needs_rehash)
  - 비교는 hmac.compare_digest (시간 차이로 맞춘 글자 수를 알 수 없게)

규칙 (NIST SP 800-63B 의 방향): 길이만 본다. 대문자·특수문자 같은 조합 규칙은 두지 않는다.
붙여 넣기·비밀번호 관리 프로그램을 막지 않는다. 너무 흔한 것과 이메일과 같은 것만 거부한다.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import unicodedata

MIN_LENGTH = 10
MAX_LENGTH = 128
DEFAULT_COST = 17  # log2 N
_R, _P, _DKLEN = 8, 1, 32

# 유출 비밀번호 목록 상위에 늘 있는 것들 (길이 10자 이상만 의미가 있다)
_COMMON = {
    "1234567890", "0123456789", "12345678910", "qwertyuiop", "1q2w3e4r5t", "1qaz2wsx3edc", "asdfghjkl;",
    "password12", "password123", "password1234", "iloveyou12", "qwerty1234", "qwerty12345", "abcdefghij",
    "a123456789", "aaaaaaaaaa", "q1w2e3r4t5", "zxcvbnm123", "11111111111", "1111111111", "admin12345",
    "johnnystudio", "johnnystudio1",
}


def _normalize(password: str) -> bytes:
    # 같은 글자를 다른 코드로 입력해도 같게 본다 (NFKC, NIST 권장)
    return unicodedata.normalize("NFKC", password).encode("utf-8")


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text + "=" * (-len(text) % 4))


def _scrypt(password: str, salt: bytes, cost: int, r: int, p: int) -> bytes:
    n = 2**cost
    return hashlib.scrypt(_normalize(password), salt=salt, n=n, r=r, p=p, maxmem=256 * r * n + 2**20, dklen=_DKLEN)


def hash_password(password: str, cost: int = DEFAULT_COST) -> str:
    salt = secrets.token_bytes(16)
    return f"scrypt${cost}${_R}${_P}${_b64(salt)}${_b64(_scrypt(password, salt, cost, _R, _P))}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, cost, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _scrypt(password, _unb64(salt), int(cost), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, _unb64(digest))


def needs_rehash(stored: str, cost: int = DEFAULT_COST) -> bool:
    parts = stored.split("$")
    return len(parts) != 6 or parts[0] != "scrypt" or parts[1:4] != [str(cost), str(_R), str(_P)]


_dummy: dict[int, str] = {}


def burn_time(password: str, cost: int = DEFAULT_COST) -> None:
    """없는 계정이어도 해시 계산만큼 시간을 쓴다. 응답 시간으로 가입 여부를 알 수 없게 한다."""
    if cost not in _dummy:
        _dummy[cost] = hash_password(secrets.token_urlsafe(16), cost)
    verify_password(password, _dummy[cost])


def password_problem(password: str, email: str) -> str | None:
    """쓸 수 없는 비밀번호면 그 이유(화면에 보여 줄 문장), 괜찮으면 None"""
    normalized = unicodedata.normalize("NFKC", password)
    if len(normalized) < MIN_LENGTH:
        return f"비밀번호는 {MIN_LENGTH}자 이상이어야 합니다."
    if len(normalized) > MAX_LENGTH:
        return f"비밀번호는 {MAX_LENGTH}자 이하여야 합니다."
    low = normalized.lower()
    local = email.lower().split("@", 1)[0]
    if low in {email.lower(), local} or (len(local) >= 4 and local in low and len(low) - len(local) < 6):
        return "이메일 주소와 비슷하지 않은 비밀번호를 써 주세요."
    if len(set(low)) <= 2 or low in _COMMON:
        return "너무 흔하거나 단순한 비밀번호입니다. 다른 비밀번호를 써 주세요."
    return None

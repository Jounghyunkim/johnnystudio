"""회원 가입·로그인 (ADR-0007 매직 링크 + ADR-0008 비밀번호).

가입 (이메일 인증 → 비밀번호 설정)
  1. POST /api/auth/request {email, purpose: signup} → 메일로 링크를 보낸다. 가입한 적 없는 주소여도 응답은 같다.
  2. 메일의 링크(/login/verify/#t=…)를 열고 '계속하기' → POST /api/auth/verify {token}
     → 처음이면 계정을 만들고 세션 쿠키를 준다 (method=link). 링크를 여는 것만으로는 아무 일도 없다 (메일 보안 검사기 대비).
  3. 같은 화면에서 POST /api/account/password {password} → 비밀번호 설정. 메일 링크로 막 만든 세션이라 현재 비밀번호를 묻지 않는다.
로그인: POST /api/auth/login {email, password} (method=password)
비밀번호를 잊었을 때: purpose=reset 으로 링크를 받아 1~3 과 같이 새 비밀번호를 정한다. 비밀번호 없이 메일 링크만으로 로그인할 수도 있다.

저장하는 것: 이메일, 비밀번호의 scrypt 해시, 가입·마지막 로그인 시각, 토큰·세션의 해시,
IP 의 HMAC(요청 횟수 제한용, 하루 뒤 삭제), 로그인 실패 기록(하루 뒤 삭제).
"""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from .config import Settings
from .db import AuthSession, LoginFailure, LoginToken, User, utcnow
from .mailer import Mail, Mailer, send_quietly
from .passwords import burn_time, hash_password, needs_rehash, password_problem, verify_password
from .security import ip_hash, new_token, normalize_email, safe_next, token_hash

log = logging.getLogger("johnnystudio.auth")
router = APIRouter(prefix="/api")

# 쓴 토큰·만료된 토큰은 요청 횟수 제한(최대 1시간)에 쓰고 하루 뒤에 지운다
TOKEN_RETENTION = timedelta(days=1)
# 세션의 마지막 사용 시각은 이 간격보다 자주 갱신하지 않는다 (요청마다 DB 쓰기 방지)
LAST_SEEN_RESOLUTION = timedelta(hours=1)


# ── 의존성 ──────────────────────────────────────────────


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request):  # noqa: ANN201 - 제너레이터
    yield from request.app.state.db.session()


def get_mailer(request: Request) -> Mailer:
    return request.app.state.mailer


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]
MailerDep = Annotated[Mailer, Depends(get_mailer)]


def api_error(code: int, error: str, message: str, headers: dict[str, str] | None = None) -> HTTPException:
    return HTTPException(status_code=code, detail={"code": error, "message": message}, headers=headers)


def client_ip(request: Request) -> str:
    """API 는 127.0.0.1 에서만 듣고 nginx 뒤에 있다. nginx 가 넣은 X-Real-IP(Cloudflare 가 알려 준 방문자 IP)를 쓴다.
    그 헤더를 덮어써 주는 프록시가 없을 때(Next 개발 서버)는 믿지 않는다: 모든 요청이 한 IP 로 세어진다 (더 엄격하다)."""
    peer = request.client.host if request.client else ""
    if peer in {"127.0.0.1", "::1"} and request.app.state.settings.trust_proxy_ip:
        return request.headers.get("x-real-ip", peer) or peer
    return peer


def _session_row(request: Request, db: Session, settings: Settings) -> AuthSession | None:
    raw = request.cookies.get(settings.cookie_name)
    if not raw or len(raw) > 200:
        return None
    row = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(raw)))
    if row is None:
        return None
    now = utcnow()
    if row.expires_at <= now:
        db.delete(row)
        db.commit()
        return None
    if now - row.last_seen_at > LAST_SEEN_RESOLUTION:
        row.last_seen_at = now
        db.commit()
    return row


def optional_session(request: Request, db: DbDep, settings: SettingsDep) -> AuthSession | None:
    return _session_row(request, db, settings)


def required_session(request: Request, db: DbDep, settings: SettingsDep) -> AuthSession:
    row = _session_row(request, db, settings)
    if row is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_signed_in", "로그인이 필요합니다.")
    return row


# ── 쿠키 ────────────────────────────────────────────────


def set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.session_days * 24 * 3600,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,  # 페이지의 스크립트가 읽을 수 없다
        samesite="lax",  # 다른 사이트에서 보낸 POST 에는 붙지 않는다 (CSRF)
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(settings.cookie_name, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")


# ── 메일 ────────────────────────────────────────────────


Purpose = Literal["signup", "login", "reset"]


def login_mail(settings: Settings, email: str, token: str, existing: bool, purpose: Purpose = "login") -> Mail:
    link = f"{settings.site_url}/login/verify/#t={token}"
    minutes = settings.login_token_minutes
    if not existing:
        subject = "[JohnnyStudio] 가입 확인"
        lead = (
            "JohnnyStudio 가입을 마치려면 아래 링크를 열고 '계속하기' 버튼을 누른 뒤 비밀번호를 정하세요. "
            "이 이메일 주소로 계정이 만들어집니다."
        )
    elif purpose == "reset":
        subject = "[JohnnyStudio] 비밀번호 재설정"
        lead = "새 비밀번호를 정하려면 아래 링크를 열고 '계속하기' 버튼을 누르세요."
    else:
        subject = "[JohnnyStudio] 로그인 링크"
        lead = "JohnnyStudio에 로그인하려면 아래 링크를 열고 '계속하기' 버튼을 누르세요. 이미 가입한 주소입니다."
    body = (
        f"{lead}\n\n"
        f"{link}\n\n"
        f"이 링크는 {minutes}분 동안, 한 번만 쓸 수 있습니다.\n"
        "요청하지 않았다면 이 메일을 무시하세요. 링크를 누르지 않으면 아무 일도 일어나지 않습니다.\n\n"
        "JohnnyStudio\n"
        f"{settings.site_url}/\n"
    )
    return Mail(to=email, subject=subject, body=body)


# ── 응답 모양 ───────────────────────────────────────────


def user_out(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "has_password": user.password_hash is not None,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat(),
    }


class LinkRequest(BaseModel):
    email: str = Field(max_length=320)
    next: str | None = Field(default=None, max_length=500)
    purpose: Purpose = "login"


class VerifyRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class PasswordLogin(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)


class PasswordChange(BaseModel):
    password: str = Field(max_length=1024)
    current_password: str | None = Field(default=None, max_length=1024)


# ── 요청 횟수 제한 ──────────────────────────────────────


def _retry_after(db: Session, column: Any, value: str, window: timedelta, now: datetime) -> int:
    oldest = db.scalar(select(func.min(LoginToken.created_at)).where(column == value, LoginToken.created_at > now - window))
    if oldest is None:
        return 60
    return max(1, math.ceil((oldest + window - now).total_seconds()))


def _check_limit(db: Session, column: Any, value: str, limit: int, window_minutes: int, now: datetime) -> None:
    window = timedelta(minutes=window_minutes)
    count = db.scalar(
        select(func.count()).select_from(LoginToken).where(column == value, LoginToken.created_at > now - window)
    )
    if (count or 0) >= limit:
        retry = _retry_after(db, column, value, window, now)
        raise api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too_many_requests",
            f"요청이 너무 많습니다. {max(1, math.ceil(retry / 60))}분 뒤에 다시 시도해 주세요.",
            headers={"Retry-After": str(retry)},
        )


def _check_failures(db: Session, column: Any, value: str, limit: int, window_minutes: int, now: datetime) -> None:
    """비밀번호를 여러 번 틀리면 잠시 막는다. 메일 링크 로그인은 막지 않는다 (남이 일부러 틀려도 주인은 들어올 수 있다)."""
    window = timedelta(minutes=window_minutes)
    since = now - window
    count = db.scalar(select(func.count()).select_from(LoginFailure).where(column == value, LoginFailure.created_at > since))
    if (count or 0) < limit:
        return
    oldest = db.scalar(select(func.min(LoginFailure.created_at)).where(column == value, LoginFailure.created_at > since))
    retry = max(1, math.ceil(((oldest or now) + window - now).total_seconds()))
    raise api_error(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "too_many_attempts",
        f"비밀번호를 여러 번 틀렸습니다. {max(1, math.ceil(retry / 60))}분 뒤에 다시 시도하거나, 메일로 로그인 링크를 받으세요.",
        headers={"Retry-After": str(retry)},
    )


def _check_login_limits(db: Session, settings: Settings, email: str, iph: str, now: datetime) -> None:
    _check_failures(db, LoginFailure.email, email, settings.login_fail_email_limit, settings.login_fail_email_window_minutes, now)
    _check_failures(db, LoginFailure.ip_hash, iph, settings.login_fail_ip_limit, settings.login_fail_ip_window_minutes, now)


def _purge(db: Session, now: datetime) -> None:
    db.execute(delete(LoginToken).where(LoginToken.expires_at < now - TOKEN_RETENTION))
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now))
    db.execute(delete(LoginFailure).where(LoginFailure.created_at < now - TOKEN_RETENTION))


def _new_session(db: Session, settings: Settings, user: User, method: str, now: datetime) -> str:
    token = new_token()
    db.add(
        AuthSession(
            token_hash=token_hash(token),
            user_id=user.id,
            method=method,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(days=settings.session_days),
        )
    )
    return token


# ── 엔드포인트 ──────────────────────────────────────────


@router.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("/auth/request", status_code=status.HTTP_202_ACCEPTED)
def request_link(
    body: LinkRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
    settings: SettingsDep,
    mailer: MailerDep,
) -> dict[str, Any]:
    email = normalize_email(body.email)
    if email is None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_email", "이메일 주소 형식을 확인해 주세요.")

    now = utcnow()
    _purge(db, now)
    iph = ip_hash(settings.secret, client_ip(request))
    _check_limit(db, LoginToken.email, email, settings.email_limit, settings.email_window_minutes, now)
    _check_limit(db, LoginToken.ip_hash, iph, settings.ip_limit, settings.ip_window_minutes, now)

    token = new_token()
    db.add(
        LoginToken(
            token_hash=token_hash(token),
            email=email,
            ip_hash=iph,
            next_path=safe_next(body.next),
            purpose=body.purpose,
            created_at=now,
            expires_at=now + timedelta(minutes=settings.login_token_minutes),
        )
    )
    existing = db.scalar(select(User.id).where(User.email == email)) is not None
    db.commit()

    # 응답을 먼저 보내고 메일은 뒤에서 보낸다. 가입 여부와 상관없이 응답이 같다 (계정 존재 여부를 드러내지 않는다)
    background.add_task(send_quietly, mailer, login_mail(settings, email, token, existing, body.purpose))
    return {"ok": True, "expires_in_minutes": settings.login_token_minutes}


@router.post("/auth/verify")
def verify_link(body: VerifyRequest, response: Response, db: DbDep, settings: SettingsDep) -> dict[str, Any]:
    now = utcnow()
    invalid = api_error(
        status.HTTP_400_BAD_REQUEST,
        "invalid_link",
        "링크가 만료되었거나 이미 사용되었습니다. 로그인 링크를 다시 받아 주세요.",
    )
    row = db.scalar(select(LoginToken).where(LoginToken.token_hash == token_hash(body.token)))
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise invalid

    # 같은 링크를 동시에 두 번 눌러도 한 번만 성공한다 (조건부 UPDATE)
    claimed = db.execute(
        update(LoginToken).where(LoginToken.id == row.id, LoginToken.used_at.is_(None)).values(used_at=now)
    )
    if claimed.rowcount != 1:
        db.rollback()
        raise invalid

    user = db.scalar(select(User).where(User.email == row.email))
    created = user is None
    if user is None:
        user = User(id=uuid.uuid4().hex, email=row.email, created_at=now, last_login_at=now)
        db.add(user)
    else:
        user.last_login_at = now

    # 같은 주소로 보낸 다른 링크도 더는 쓸 수 없게 한다
    db.execute(update(LoginToken).where(LoginToken.email == row.email, LoginToken.used_at.is_(None)).values(used_at=now))

    session_token = _new_session(db, settings, user, "link", now)
    db.commit()
    log.info("메일 링크 로그인: %s", "가입" if created else "기존 회원")

    set_session_cookie(response, settings, session_token)
    return {"user": user_out(user), "created": created, "purpose": row.purpose, "next": row.next_path}


@router.post("/auth/login")
def login_with_password(
    body: PasswordLogin, request: Request, response: Response, db: DbDep, settings: SettingsDep
) -> dict[str, Any]:
    invalid = api_error(
        status.HTTP_400_BAD_REQUEST,
        "invalid_credentials",
        "이메일 또는 비밀번호가 맞지 않습니다. 비밀번호를 정하지 않았거나 잊었다면 메일로 로그인 링크를 받으세요.",
    )
    email = normalize_email(body.email)
    if email is None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_email", "이메일 주소 형식을 확인해 주세요.")
    now = utcnow()
    _purge(db, now)
    iph = ip_hash(settings.secret, client_ip(request))
    _check_login_limits(db, settings, email, iph, now)

    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.password_hash is None:
        burn_time(body.password, settings.password_cost)  # 가입 여부를 응답 시간으로 알 수 없게
        ok = False
    else:
        ok = verify_password(body.password, user.password_hash)
    if not ok or user is None or user.password_hash is None:
        db.add(LoginFailure(email=email, ip_hash=iph, created_at=now))
        db.commit()
        raise invalid

    if needs_rehash(user.password_hash, settings.password_cost):
        user.password_hash = hash_password(body.password, settings.password_cost)
    user.last_login_at = now
    session_token = _new_session(db, settings, user, "password", now)
    db.commit()
    log.info("비밀번호 로그인")

    set_session_cookie(response, settings, session_token)
    return {"user": user_out(user)}


@router.post("/account/password", status_code=status.HTTP_204_NO_CONTENT)
def set_password(
    body: PasswordChange,
    request: Request,
    db: DbDep,
    settings: SettingsDep,
    session: Annotated[AuthSession, Depends(required_session)],
) -> None:
    """비밀번호 정하기·바꾸기.

    현재 비밀번호를 묻지 않는 경우: 비밀번호가 아직 없거나, 메일 링크로 방금(링크 유효 시간 안에) 로그인한 세션 (가입·재설정).
    그 밖에는 현재 비밀번호가 맞아야 한다. 바꾸면 이 기기를 뺀 다른 기기의 로그인을 모두 끊는다.
    """
    user = db.get(User, session.user_id)
    if user is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_signed_in", "로그인이 필요합니다.")
    problem = password_problem(body.password, user.email)
    if problem:
        raise api_error(status.HTTP_400_BAD_REQUEST, "weak_password", problem)

    now = utcnow()
    had_password = user.password_hash is not None
    fresh_link = session.method == "link" and now - session.created_at <= timedelta(minutes=settings.login_token_minutes)
    if had_password and not fresh_link:
        iph = ip_hash(settings.secret, client_ip(request))
        _check_login_limits(db, settings, user.email, iph, now)
        if not body.current_password or not verify_password(body.current_password, user.password_hash):
            db.add(LoginFailure(email=user.email, ip_hash=iph, created_at=now))
            db.commit()
            raise api_error(status.HTTP_400_BAD_REQUEST, "wrong_current_password", "현재 비밀번호가 맞지 않습니다.")

    user.password_hash = hash_password(body.password, settings.password_cost)
    user.password_changed_at = now
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id, AuthSession.id != session.id))
    session.method = "password"  # 방금 링크 로그인으로 얻은 '현재 비밀번호 없이 바꾸기' 기회는 한 번만 쓴다
    db.commit()
    log.info("비밀번호 %s", "변경" if had_password else "설정")


@router.get("/auth/me")
def me(db: DbDep, session: Annotated[AuthSession | None, Depends(optional_session)]) -> dict[str, Any]:
    # 로그인하지 않았어도 200 으로 답한다 (브라우저 콘솔에 401 오류가 찍히지 않게)
    if session is None:
        return {"user": None}
    user = db.get(User, session.user_id)
    return {"user": user_out(user) if user else None}


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbDep,
    settings: SettingsDep,
    session: Annotated[AuthSession | None, Depends(optional_session)],
) -> None:
    if session is not None:
        db.delete(session)
        db.commit()
    clear_session_cookie(response, settings)


@router.post("/auth/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response,
    db: DbDep,
    settings: SettingsDep,
    session: Annotated[AuthSession, Depends(required_session)],
) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == session.user_id))
    db.commit()
    clear_session_cookie(response, settings)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    response: Response,
    db: DbDep,
    settings: SettingsDep,
    session: Annotated[AuthSession, Depends(required_session)],
) -> None:
    """회원 탈퇴: 계정·세션·남은 로그인 링크를 바로 지운다 (ideation R8)."""
    user = db.get(User, session.user_id)
    db.execute(delete(AuthSession).where(AuthSession.user_id == session.user_id))
    if user is not None:
        db.execute(delete(LoginToken).where(LoginToken.email == user.email))
        db.execute(delete(LoginFailure).where(LoginFailure.email == user.email))
        db.delete(user)
    db.commit()
    log.info("회원 탈퇴")
    clear_session_cookie(response, settings)

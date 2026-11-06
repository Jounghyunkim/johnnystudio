"""설정: 모두 환경 변수(JOHNNYSTUDIO_*)로 받는다.

개발(./scripts/dev.sh)에서는 아무것도 정하지 않아도 동작한다 (SQLite, 메일은 터미널 출력).
개발 중에 진짜 메일을 보내 보려면 api/.env.local 에 메일 설정을 적는다 (예시: api/.env.local.example).
dev.sh 가 그 파일을 JOHNNYSTUDIO_ENV_FILE 로 넘기고, 여기서 읽는다. 환경 변수에 같은 이름이 있으면 환경 변수가 이긴다.
운영(JOHNNYSTUDIO_ENV=production)에서는 비밀값·메일·HTTPS 주소가 빠지면 시작하지 않는다.
운영 값 예시: deploy/api.env.example (systemd 가 EnvironmentFile 로 읽는다)
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

API_DIR = Path(__file__).resolve().parent.parent


class ConfigError(RuntimeError):
    pass


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    site_url: str = "http://127.0.0.1:3000"
    database_url: str = f"sqlite:///{API_DIR / 'data' / 'dev.sqlite3'}"
    # IP 를 그대로 저장하지 않고 이 값으로 HMAC 해서 남긴다 (요청 횟수 제한용)
    secret: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    extra_origins: tuple[str, ...] = ()
    cookie_secure: bool = False
    # 127.0.0.1 에서 온 요청의 X-Real-IP 를 방문자 IP 로 믿는가. nginx·preview_server.py 는 이 헤더를 덮어쓰므로 믿어도 된다.
    # Next 개발 서버의 프록시는 방문자가 보낸 값을 그대로 넘기므로 dev.sh 는 끈다 (0)
    trust_proxy_ip: bool = True

    login_token_minutes: int = 15
    session_days: int = 30
    # 비밀번호 해시 강도 (log2 N, app/passwords.py). 테스트만 낮춘다
    password_cost: int = 17
    # 비밀번호 로그인 실패: 같은 이메일 15분에 5번, 같은 IP 1시간에 20번까지 (넘으면 잠시 막는다. 메일 링크 로그인은 그대로 된다)
    login_fail_email_limit: int = 5
    login_fail_email_window_minutes: int = 15
    login_fail_ip_limit: int = 20
    login_fail_ip_window_minutes: int = 60
    # 같은 이메일로 15분에 3번, 같은 IP 에서 1시간에 10번까지 링크를 보낸다
    email_limit: int = 3
    email_window_minutes: int = 15
    ip_limit: int = 10
    ip_window_minutes: int = 60

    mail_backend: str = "console"  # console | smtp
    mail_from: str = "JohnnyStudio <noreply@localhost>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_security: str = "starttls"  # starttls | ssl | none

    @property
    def production(self) -> bool:
        return self.env == "production"

    @property
    def allowed_origins(self) -> frozenset[str]:
        return frozenset({_origin(self.site_url), *self.extra_origins})

    @property
    def cookie_name(self) -> str:
        # __Host- 접두사: Secure + Path=/ + Domain 없음을 브라우저가 강제한다 (하위 도메인이 덮어쓸 수 없다)
        return "__Host-johnnystudio_session" if self.cookie_secure else "johnnystudio_session"

    def validate(self) -> None:
        if self.env not in {"development", "production"}:
            raise ConfigError(f"JOHNNYSTUDIO_ENV 는 development 또는 production 이어야 한다: {self.env}")
        if self.mail_backend not in {"console", "smtp"}:
            raise ConfigError(f"JOHNNYSTUDIO_MAIL_BACKEND 는 console 또는 smtp 여야 한다: {self.mail_backend}")
        if self.smtp_security not in {"starttls", "ssl", "none"}:
            raise ConfigError(f"JOHNNYSTUDIO_SMTP_SECURITY 는 starttls, ssl, none 중 하나여야 한다: {self.smtp_security}")
        if urlsplit(self.site_url).scheme not in {"http", "https"}:
            raise ConfigError(f"JOHNNYSTUDIO_SITE_URL 이 http(s) 주소가 아니다: {self.site_url}")
        if not self.production:
            # 운영 설정은 아래에서 문제를 한꺼번에 모아 보여 준다
            if self.mail_backend == "smtp" and not self.smtp_host:
                raise ConfigError("JOHNNYSTUDIO_MAIL_BACKEND=smtp 인데 JOHNNYSTUDIO_SMTP_HOST 가 없다 (api/.env.local 을 확인)")
            return
        problems = []
        if not self.site_url.startswith("https://"):
            problems.append("JOHNNYSTUDIO_SITE_URL 은 https:// 주소여야 한다")
        if len(self.secret) < 32:
            problems.append("JOHNNYSTUDIO_SECRET 이 없거나 짧다 (32자 이상)")
        if not self.cookie_secure:
            problems.append("운영에서는 쿠키에 Secure 를 붙여야 한다 (JOHNNYSTUDIO_COOKIE_SECURE)")
        if self.mail_backend != "smtp":
            problems.append("운영에서는 JOHNNYSTUDIO_MAIL_BACKEND=smtp 여야 한다 (console 은 메일을 보내지 않는다)")
        elif not self.smtp_host:
            problems.append("JOHNNYSTUDIO_SMTP_HOST 가 없다")
        if self.database_url.startswith("sqlite"):
            problems.append("운영 DB 는 PostgreSQL 이다 (JOHNNYSTUDIO_DATABASE_URL)")
        if problems:
            raise ConfigError("운영 설정 오류:\n  - " + "\n  - ".join(problems))


def parse_env_file(content: str) -> dict[str, str]:
    """systemd EnvironmentFile 의 단순한 형태: 빈 줄·# 주석 무시, KEY=VALUE, 값 양끝의 따옴표 하나 제거.
    셸로 source 하지 않는다 (MAIL_FROM 의 '<' 같은 문자가 리다이렉션이 된다)."""
    env: dict[str, str] = {}
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith(("#", ";")) or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        env[key.strip()] = value
    return env


def load_settings(environ: dict[str, str] | None = None) -> Settings:
    e: dict[str, str] = dict(os.environ if environ is None else environ)
    env_file = e.get("JOHNNYSTUDIO_ENV_FILE", "").strip()
    if env_file:
        try:
            from_file = parse_env_file(Path(env_file).read_text(encoding="utf-8"))
        except OSError as err:
            raise ConfigError(f"JOHNNYSTUDIO_ENV_FILE 을 읽을 수 없다: {env_file}: {err.strerror}") from err
        e = {**from_file, **e}

    def get(name: str, default: str = "") -> str:
        return e.get(f"JOHNNYSTUDIO_{name}", default).strip()

    env = get("ENV", "development")
    defaults = Settings()
    settings = Settings(
        env=env,
        site_url=get("SITE_URL", defaults.site_url).rstrip("/"),
        database_url=get("DATABASE_URL", defaults.database_url),
        secret=get("SECRET") or ("" if env == "production" else defaults.secret),
        extra_origins=tuple(o.strip().rstrip("/") for o in get("EXTRA_ORIGINS").split(",") if o.strip()),
        cookie_secure=_bool(e.get("JOHNNYSTUDIO_COOKIE_SECURE"), env == "production"),
        trust_proxy_ip=_bool(e.get("JOHNNYSTUDIO_TRUST_PROXY_IP"), True),
        mail_backend=get("MAIL_BACKEND", "smtp" if env == "production" else "console"),
        mail_from=get("MAIL_FROM", defaults.mail_from),
        smtp_host=get("SMTP_HOST"),
        smtp_port=int(get("SMTP_PORT", "587")),
        smtp_user=get("SMTP_USER"),
        smtp_password=e.get("JOHNNYSTUDIO_SMTP_PASSWORD", ""),
        smtp_security=get("SMTP_SECURITY", "starttls"),
    )
    settings.validate()
    return settings

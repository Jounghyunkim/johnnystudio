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


def _int(value: str, default: int, name: str) -> int:
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        raise ConfigError(f"JOHNNYSTUDIO_{name} 는 정수여야 한다: {value}") from None


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

    # ── Store (회원이 올린 Windows 앱, ADR-0012) ──
    # 올린 파일·아이콘을 두는 폴더. 운영은 /opt/johnnystudio/store (deploy/README.md §3-6)
    store_dir: Path = API_DIR / "data" / "store"
    # 검토·숨김·차단을 할 수 있는 회원 이메일 (쉼표로 구분). 비어 있으면 아무도 검토할 수 없다
    store_admins: frozenset[str] = frozenset()
    # 새 업로드를 받는가. 문제가 생기면 끄고(0) 다시 띄운다. 이미 공개된 앱은 그대로 받을 수 있다
    store_uploads_open: bool = True
    store_file_max_mb: int = 300  # 파일 하나
    store_user_quota_mb: int = 2048  # 회원 한 명이 올려 둔 파일 합계 (검토 중 포함)
    store_daily_uploads: int = 10  # 회원 한 명이 24시간에 시작할 수 있는 업로드 수
    # ClamAV 명령 (없으면 검사를 건너뛰고 '검사 안 함'으로 남긴다). 빈 값이면 검사하지 않는다
    store_clamscan: str = "clamscan"
    # 검사에서 탐지 없음이 나와야 공개(승인)할 수 있는가. 운영은 켠다
    store_require_scan: bool = False
    # 내려받기를 nginx 에 맡기는 내부 경로 (X-Accel-Redirect). 비어 있으면 API 가 직접 보낸다 (개발)
    store_accel_prefix: str = ""
    # 공개 내려받기 링크를 다른 등록 도메인으로 보낼 때 그 출처 (예: https://dl.example.net). 비어 있으면 사이트 주소 그대로.
    # 남이 올린 파일 때문에 포털 도메인이 위험 사이트 경고를 받지 않게 나중에 옮기는 자리다 (ADR-0012). 검토용 내려받기는 옮기지 않는다
    store_files_origin: str = ""

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
        if self.store_files_origin and (
            urlsplit(self.store_files_origin).scheme not in {"http", "https"} or _origin(self.store_files_origin) != self.store_files_origin
        ):
            raise ConfigError(f"JOHNNYSTUDIO_STORE_FILES_ORIGIN 은 경로 없는 출처여야 한다 (예: https://dl.example.net): {self.store_files_origin}")
        if self.store_accel_prefix and not (self.store_accel_prefix.startswith("/") and self.store_accel_prefix.endswith("/")):
            raise ConfigError(f"JOHNNYSTUDIO_STORE_ACCEL_PREFIX 는 / 로 시작하고 / 로 끝나야 한다: {self.store_accel_prefix}")
        for name, value in (
            ("STORE_FILE_MAX_MB", self.store_file_max_mb),
            ("STORE_USER_QUOTA_MB", self.store_user_quota_mb),
            ("STORE_DAILY_UPLOADS", self.store_daily_uploads),
        ):
            if value < 1:
                raise ConfigError(f"JOHNNYSTUDIO_{name} 는 1 이상이어야 한다: {value}")
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
        if not self.store_dir.is_absolute():
            problems.append("JOHNNYSTUDIO_STORE_DIR 은 절대 경로여야 한다")
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
        store_dir=Path(get("STORE_DIR") or ("/opt/johnnystudio/store" if env == "production" else str(defaults.store_dir))),
        store_admins=frozenset(a.strip().lower() for a in get("STORE_ADMINS").split(",") if a.strip()),
        store_uploads_open=_bool(e.get("JOHNNYSTUDIO_STORE_UPLOADS_OPEN"), True),
        store_file_max_mb=_int(get("STORE_FILE_MAX_MB"), defaults.store_file_max_mb, "STORE_FILE_MAX_MB"),
        store_user_quota_mb=_int(get("STORE_USER_QUOTA_MB"), defaults.store_user_quota_mb, "STORE_USER_QUOTA_MB"),
        store_daily_uploads=_int(get("STORE_DAILY_UPLOADS"), defaults.store_daily_uploads, "STORE_DAILY_UPLOADS"),
        store_clamscan=e.get("JOHNNYSTUDIO_STORE_CLAMSCAN", defaults.store_clamscan).strip(),  # 빈 값이면 검사하지 않는다
        store_require_scan=_bool(e.get("JOHNNYSTUDIO_STORE_REQUIRE_SCAN"), env == "production"),
        # 운영 nginx 의 internal location 과 맞춘다 (deploy/nginx/johnnystudio.conf)
        store_accel_prefix=get("STORE_ACCEL_PREFIX", "/_store_files/" if env == "production" else ""),
        store_files_origin=get("STORE_FILES_ORIGIN").rstrip("/"),
    )
    settings.validate()
    return settings

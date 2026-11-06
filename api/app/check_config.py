"""운영 설정 확인 도구 (deploy/README.md §3).

    .venv/bin/python -m app.check_config /opt/johnnystudio/api.env                 설정 검사 + DB 연결
    .venv/bin/python -m app.check_config /opt/johnnystudio/api.env --send-test me@example.com   시험 메일
    .venv/bin/python -m app.check_config .env.local --no-db --send-test me@example.com          개발 PC 에서 메일만

설정 파일은 systemd EnvironmentFile 형식(KEY=VALUE)이다. 셸로 source 하면 '<' 같은 문자가 리다이렉션이 되므로
여기서 직접 읽는다. 비밀값은 화면에 찍지 않는다.
"""

from __future__ import annotations

import argparse
import sys
from email.utils import parseaddr
from pathlib import Path

from sqlalchemy import text

from .config import ConfigError, Settings, load_settings, parse_env_file
from .db import make_engine
from .mailer import Mail, make_mailer
from .security import normalize_email

__all__ = ["main", "mail_warnings", "parse_env_file"]


def mail_warnings(s: Settings) -> list[str]:
    """개인 메일 계정(Gmail·네이버) SMTP 에서 자주 하는 실수"""
    if s.mail_backend != "smtp":
        return []
    warnings = []
    if " " in s.smtp_password:
        warnings.append("SMTP 비밀번호에 띄어쓰기가 있다. 앱 비밀번호는 띄어쓰기 없이 붙여 쓴다")
    sender = parseaddr(s.mail_from)[1].lower()
    user = s.smtp_user.lower()
    if user and "@" not in user and s.smtp_host.endswith("naver.com"):
        user = f"{user}@naver.com"
    if user and "@" in user and sender != user:
        warnings.append(
            f"보내는 주소({sender or '없음'})가 SMTP 계정({user})과 다르다. "
            "네이버는 거부하고, Gmail 은 계정 주소로 바꿔서 보낸다. MAIL_FROM 을 계정 주소로 맞춘다"
        )
    return warnings


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="JohnnyStudio API 운영 설정 확인")
    p.add_argument("env_file", type=Path)
    p.add_argument("--send-test", metavar="받는주소", help="이 주소로 시험 메일을 보낸다")
    p.add_argument("--no-db", action="store_true", help="DB 연결을 확인하지 않는다")
    args = p.parse_args(argv[1:])

    try:
        settings = load_settings(parse_env_file(args.env_file.read_text(encoding="utf-8")))
    except (OSError, ConfigError, ValueError) as e:
        print(f"✗ {e}")
        return 1
    print(f"✓ 설정: env={settings.env} site={settings.site_url} mail={settings.mail_backend}")
    print(f"  허용 출처: {', '.join(sorted(settings.allowed_origins))}")
    if settings.mail_backend == "smtp":
        print(f"  SMTP: {settings.smtp_host}:{settings.smtp_port} ({settings.smtp_security}), 계정 {settings.smtp_user or '없음'}")
    for w in mail_warnings(settings):
        print(f"⚠ {w}")

    if not args.no_db:
        try:
            with make_engine(settings.database_url).connect() as conn:
                conn.execute(text("select 1"))
        except Exception as e:  # noqa: BLE001
            print(f"✗ DB 연결 실패: {type(e).__name__}: {str(e).splitlines()[0]}")
            return 1
        print("✓ DB 연결")

    if args.send_test:
        to = normalize_email(args.send_test)
        if to is None:
            print("✗ 받는 주소 형식이 틀렸다")
            return 1
        try:
            make_mailer(settings).send(
                Mail(to=to, subject="[JohnnyStudio] 시험 메일", body="메일 발송 설정이 동작합니다.\n")
            )
        except Exception as e:  # noqa: BLE001
            print(f"✗ 메일 발송 실패: {type(e).__name__}: {e}")
            return 1
        print(f"✓ 시험 메일을 보냈다 → {to} (스팸함도 확인)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

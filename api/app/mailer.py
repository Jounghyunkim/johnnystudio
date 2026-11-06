"""메일 보내기.

- console: 메일을 보내지 않고 로그(터미널)에 찍는다. 개발용. 운영에서는 설정 검사가 막는다.
- smtp: 표준 라이브러리 smtplib 로 보낸다. 어느 발송 서비스든 SMTP 를 지원하면 쓸 수 있다.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import Protocol

from .config import Settings

log = logging.getLogger("johnnystudio.mail")


@dataclass(frozen=True)
class Mail:
    to: str
    subject: str
    body: str


class Mailer(Protocol):
    def send(self, mail: Mail) -> None: ...


class ConsoleMailer:
    def send(self, mail: Mail) -> None:
        log.warning(
            "\n──── 메일 (개발용: 실제로 보내지 않음) ────\n받는 사람: %s\n제목: %s\n\n%s\n────────────────────────────",
            mail.to,
            mail.subject,
            mail.body,
        )


class SmtpMailer:
    def __init__(self, settings: Settings) -> None:
        self.s = settings

    def _message(self, mail: Mail) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = self.s.mail_from
        msg["To"] = mail.to
        msg["Subject"] = mail.subject
        msg["Date"] = formatdate(localtime=False)
        msg["Message-ID"] = make_msgid(domain=self.s.smtp_host or None)
        msg["Auto-Submitted"] = "auto-generated"  # 자동 응답이 되돌아오지 않게
        msg.set_content(mail.body)
        return msg

    def send(self, mail: Mail) -> None:
        msg = self._message(mail)
        ctx = ssl.create_default_context()
        if self.s.smtp_security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(self.s.smtp_host, self.s.smtp_port, timeout=20, context=ctx)
        else:
            server = smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20)
        with server:
            if self.s.smtp_security == "starttls":
                server.starttls(context=ctx)
            if self.s.smtp_user:
                server.login(self.s.smtp_user, self.s.smtp_password)
            server.send_message(msg)


def make_mailer(settings: Settings) -> Mailer:
    return SmtpMailer(settings) if settings.mail_backend == "smtp" else ConsoleMailer()


def send_quietly(mailer: Mailer, mail: Mail) -> None:
    """응답을 보낸 뒤 백그라운드에서 부른다. 실패해도 사용자 응답은 같다 (계정 존재 여부를 드러내지 않는다).
    로그에는 받는 사람 주소를 남기지 않는다."""
    try:
        mailer.send(mail)
    except Exception as e:  # noqa: BLE001 - 어떤 실패든 기록만 하고 넘어간다
        log.error("메일 발송 실패: %s: %s", type(e).__name__, e)

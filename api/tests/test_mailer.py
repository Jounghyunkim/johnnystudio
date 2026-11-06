"""SmtpMailer 가 실제 SMTP 대화로 메일을 보내는지, 가짜 SMTP 서버로 확인한다 (평문, 인증 없음)."""

from __future__ import annotations

import email
import email.policy
import socket
import threading
from dataclasses import replace

from app.auth import login_mail
from app.config import Settings
from app.mailer import SmtpMailer


def fake_smtp(received: list[bytes]) -> tuple[socket.socket, threading.Thread]:
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)

    def run() -> None:
        conn, _ = srv.accept()
        f = conn.makefile("rwb")

        def say(line: str) -> None:
            f.write(line.encode() + b"\r\n")
            f.flush()

        say("220 fake")
        while line := f.readline():
            cmd = line.decode().strip().upper()
            if cmd.startswith(("EHLO", "HELO")):
                say("250-fake")
                say("250 SMTPUTF8")
            elif cmd == "DATA":
                say("354 go")
                data = b""
                while (chunk := f.readline()) != b".\r\n":
                    data += chunk
                received.append(data)
                say("250 ok")
            elif cmd == "QUIT":
                say("221 bye")
                break
            else:
                say("250 ok")
        conn.close()
        srv.close()

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return srv, t


def test_smtp_mailer_sends_korean_mail() -> None:
    received: list[bytes] = []
    srv, t = fake_smtp(received)
    s = replace(
        Settings(site_url="https://studio.example", mail_from="JohnnyStudio <noreply@studio.example>"),
        mail_backend="smtp",
        smtp_host="127.0.0.1",
        smtp_port=srv.getsockname()[1],
        smtp_security="none",
    )
    SmtpMailer(s).send(login_mail(s, "me@example.com", "T" * 43, existing=False))
    t.join(timeout=5)

    msg = email.message_from_bytes(received[0], policy=email.policy.default)
    assert msg["Subject"] == "[JohnnyStudio] 가입 확인"
    assert msg["To"] == "me@example.com"
    assert msg["From"] == "JohnnyStudio <noreply@studio.example>"
    assert msg["Auto-Submitted"] == "auto-generated"
    body = msg.get_content()
    assert f"https://studio.example/login/verify/#t={'T' * 43}" in body
    assert "15분" in body

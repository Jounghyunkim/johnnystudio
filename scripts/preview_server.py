#!/usr/bin/env python3
"""출시 빌드 미리보기 서버. scripts/preview.sh 가 부른다.

운영 nginx(deploy/nginx/johnnystudio.conf)를 흉내 낸다.
  - web/out 의 정적 파일을 내준다. 없는 주소는 404.html (nginx 의 error_page 404)
  - 보안 헤더(CSP 포함)는 nginx 설정 파일의 add_header 를 그대로 읽어서 붙인다 → 설정이 한 곳에만 있다
  - /api/ 는 로컬 API 로 넘긴다 (X-Real-IP 를 붙이고 X-Forwarded-For 는 넘기지 않는다)

Python 표준 라이브러리만 쓴다. 개발용이다. 운영에 쓰지 않는다.
"""

from __future__ import annotations

import argparse
import http.client
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ADD_HEADER = re.compile(r'^\s*add_header\s+([A-Za-z-]+)\s+"([^"]*)"\s+always;', re.M)
HOP_BY_HOP = {"connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer", "host"}
DROP_REQUEST = HOP_BY_HOP | {"x-forwarded-for", "x-real-ip", "content-length"}


def security_headers(conf: Path) -> list[tuple[str, str]]:
    return ADD_HEADER.findall(conf.read_text(encoding="utf-8"))


class Handler(SimpleHTTPRequestHandler):
    headers_to_add: list[tuple[str, str]] = []
    api: tuple[str, int] = ("127.0.0.1", 8090)

    def end_headers(self) -> None:
        for name, value in self.headers_to_add:
            self.send_header(name, value)
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # noqa: ANN002
        if self.path.startswith("/api/"):
            return  # API 로그는 uvicorn 이 남긴다
        super().log_message(fmt, *args)

    # ── 정적 파일 ──

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        page = Path(self.directory) / "404.html"
        if code == 404 and page.is_file() and self.command in {"GET", "HEAD"}:
            body = page.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command == "GET":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    # ── /api/ 프록시 ──

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in DROP_REQUEST}
        headers["X-Real-IP"] = self.client_address[0]
        conn = http.client.HTTPConnection(*self.api, timeout=30)
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            res = conn.getresponse()
            data = res.read()
        except OSError:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("502: 회원 API 에 연결할 수 없습니다\n".encode())
            return
        finally:
            conn.close()
        self.send_response(res.status)
        for name, value in res.getheaders():  # Set-Cookie 가 여러 개여도 그대로
            if name.lower() not in HOP_BY_HOP | {"content-length", "server", "date"}:
                self.send_header(name, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _route(self, static: bool) -> None:
        if self.path.startswith("/api/"):
            self._proxy()
        elif static:
            super().do_GET() if self.command == "GET" else super().do_HEAD()
        else:
            self.send_error(405)

    def do_GET(self) -> None:
        self._route(static=True)

    def do_HEAD(self) -> None:
        self._route(static=True)

    def do_POST(self) -> None:
        self._route(static=False)

    def do_DELETE(self) -> None:
        self._route(static=False)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="출시 빌드 미리보기 서버 (nginx 흉내)")
    p.add_argument("--root", default="web/out")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--api", default="http://127.0.0.1:8090")
    p.add_argument("--nginx-conf", default="deploy/nginx/johnnystudio.conf")
    args = p.parse_args(argv[1:])

    root = Path(args.root).resolve()
    if not (root / "index.html").is_file():
        print(f"✗ {root}/index.html 이 없다. 먼저 빌드한다 (npm --prefix web run build)")
        return 2
    api = urlsplit(args.api)
    Handler.headers_to_add = security_headers(Path(args.nginx_conf))
    Handler.api = (api.hostname or "127.0.0.1", api.port or 80)

    server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(root)))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

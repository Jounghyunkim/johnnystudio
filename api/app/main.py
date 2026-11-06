"""JohnnyStudio API 진입점.

    uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8082

정적 사이트(web/out)는 nginx 가 내주고, /api/ 만 이 앱으로 넘어온다 (ADR-0007).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from .auth import router
from .config import Settings, load_settings
from .db import Database
from .mailer import Mailer, make_mailer

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def create_app(settings: Settings | None = None, mailer: Mailer | None = None) -> FastAPI:
    settings = settings or load_settings()
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    db = Database(settings.database_url)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        # 개발용 SQLite 만 스키마가 바뀌면 다시 만든다. 운영(PostgreSQL)은 멈추고 알린다
        db.ensure_schema(reset_if_outdated=not settings.production and settings.database_url.startswith("sqlite"))
        yield
        db.engine.dispose()

    app = FastAPI(
        title="JohnnyStudio API",
        lifespan=lifespan,
        # 운영에서는 API 문서를 내주지 않는다
        docs_url=None if settings.production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.production else "/api/openapi.json",
    )
    app.state.settings = settings
    app.state.db = db
    app.state.mailer = mailer or make_mailer(settings)

    @app.middleware("http")
    async def guard(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # CSRF: 상태를 바꾸는 요청은 이 사이트에서 온 것만 받는다. SameSite=Lax 쿠키에 더한 두 번째 방어선이다.
        # (브라우저는 fetch POST 에 항상 Origin 을 붙인다. Origin 이 없는 요청은 브라우저가 아니므로 받지 않는다)
        if request.method in UNSAFE_METHODS and request.headers.get("origin") not in settings.allowed_origins:
            response: Response = JSONResponse(
                {"detail": {"code": "bad_origin", "message": "허용되지 않은 출처에서 온 요청입니다."}},
                status_code=403,
            )
        else:
            response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(router)
    return app

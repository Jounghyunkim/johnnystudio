"""설정 화면용 API (/api/site/): 운영자 현황(개수만)과 브라우저 캐시 지우기."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace

import pytest

from app.config import Settings
from tests.conftest import FakeMailer, make_client
from tests.test_store import ADMIN, Accounts, approve_latest, become_publisher, submit

SITE_URL = "https://notes.example.com/"


@pytest.fixture
def store_settings(settings: Settings, tmp_path) -> Settings:  # noqa: ANN001
    return replace(settings, store_dir=tmp_path / "store", store_admins=frozenset({ADMIN}), store_clamscan="", store_file_max_mb=123)


@pytest.fixture
def people(store_settings: Settings, mailer: FakeMailer) -> Iterator[Accounts]:
    for c in make_client(store_settings, mailer):
        yield Accounts(c, mailer)


def test_clear_cache_sends_clear_site_data(people: Accounts) -> None:
    guest = people.use(None)
    r = guest.post("/api/site/clear-cache")
    assert r.status_code == 204
    assert r.headers["clear-site-data"] == '"cache"'
    # 쿠키·저장소는 지우지 않는다 (로그인이 풀리면 안 된다)
    assert "cookies" not in r.headers["clear-site-data"] and "storage" not in r.headers["clear-site-data"]
    # 다른 출처에서 온 요청은 받지 않는다 (상태를 바꾸는 요청과 같은 검사)
    assert guest.post("/api/site/clear-cache", headers={"Origin": "https://evil.example"}).status_code == 403


def test_admin_stats_counts_only(people: Accounts) -> None:
    dev = people.use("dev@example.com")
    become_publisher(dev)
    approve_latest(people, submit(dev))  # 공개 1
    dev = people.use("dev@example.com")
    submit(dev, name="둘째 도구")  # 검토 대기 1
    dev = people.use("dev@example.com")
    assert dev.post("/api/showroom/services", json={"name": "메모", "url": SITE_URL}).status_code == 201
    people.use("other@example.com")

    # 운영자만 본다
    assert people.use("dev@example.com").get("/api/site/admin/stats").status_code == 403
    assert people.use(None).get("/api/site/admin/stats").status_code == 401

    r = people.use(ADMIN).get("/api/site/admin/stats")
    assert r.status_code == 200, r.text
    s = r.json()
    u = s["users"]
    assert u["total"] == 3 and u["new_7d"] == 3 and u["new_30d"] == 3 and u["login_7d"] == 3
    assert u["signed_in"] == 3 and u["active_24h"] == 3 and u["with_password"] == 0
    assert s["store"]["publishers"] == 1 and s["store"]["blocked"] == 0
    assert s["store"]["apps"] == {"pending": 1, "published": 1, "rejected": 0, "hidden": 0}
    assert s["store"]["releases_pending"] == 1 and s["store"]["reports_open"] == 0
    assert s["showroom"]["services"] == {"pending": 1, "published": 0, "rejected": 0, "hidden": 0}
    server = s["server"]
    assert server["file_max_mb"] == 123 and server["admins"] == 1 and server["database"] == "SQLite" and server["scanner"] is False

    # 차트용 추이: 90일 하루 가입 수(오늘에 3명), 마지막 로그인(모두 오늘), 내려받기 상위(아직 없음)
    t = s["trends"]
    assert t["days"] == 90 and len(t["signups"]) == 90 and t["signups"][-1]["count"] == 3 and sum(d["count"] for d in t["signups"]) == 3
    assert t["members_before"] == 0 and [r["key"] for r in t["login_recency"]] == ["today", "week", "month", "older"]
    assert [r["count"] for r in t["login_recency"]] == [3, 0, 0, 0] and t["top_downloads"] == []

    # 개수만 낸다: 회원 이메일·비밀값이 응답에 없다
    text = r.text
    assert "dev@example.com" not in text and "other@example.com" not in text and ADMIN not in text
    assert "secret" not in text and "smtp_password" not in text and "database_url" not in text

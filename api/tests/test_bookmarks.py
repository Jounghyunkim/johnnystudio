"""회원의 즐겨찾기 (ADR-0017): 계정마다 DB 에 두고, 다른 브라우저(새 세션)에서도 같게 보인다."""

from __future__ import annotations

from app.bookmarks import MAX_BOOKMARKS
from app.db import Bookmark
from tests.test_auth import COOKIE, rows, sign_in

PATH = "/api/account/bookmarks"


def test_requires_sign_in(client) -> None:
    assert client.get(PATH).status_code == 401
    assert client.post(PATH, json={"items": ["wlt"]}).status_code == 401
    assert client.delete(f"{PATH}/wlt").status_code == 401


def test_add_list_remove_in_order(client, mailer) -> None:
    sign_in(client, mailer)
    assert client.get(PATH).json() == {"items": []}
    assert client.post(PATH, json={"items": ["cmg-monitor"]}).json() == {"items": ["cmg-monitor"]}
    # 이미 있는 것은 건너뛰고, 새 것은 보낸 순서대로 뒤에 붙는다 (같은 값을 두 번 보내도 하나)
    r = client.post(PATH, json={"items": ["store:Ab12Cd34", "cmg-monitor", "wlt", "wlt"]})
    assert r.json() == {"items": ["cmg-monitor", "store:Ab12Cd34", "wlt"]}
    assert client.delete(f"{PATH}/store:Ab12Cd34").json() == {"items": ["cmg-monitor", "wlt"]}
    assert client.delete(f"{PATH}/store%3AAb12Cd34").status_code == 200  # 없어도 성공, 주소 인코딩도 같다
    assert client.get(PATH).json() == {"items": ["cmg-monitor", "wlt"]}


def test_same_list_in_another_browser(client, mailer) -> None:
    sign_in(client, mailer)
    client.post(PATH, json={"items": ["arkurator", "store:Ab12Cd34"]})
    # 다른 브라우저 = 쿠키 없이 새로 로그인한 세션
    client.cookies.clear()
    assert client.get(PATH).status_code == 401
    sign_in(client, mailer)
    assert client.get(PATH).json() == {"items": ["arkurator", "store:Ab12Cd34"]}


def test_each_member_has_own_list(client, mailer) -> None:
    sign_in(client, mailer, "a@example.com")
    client.post(PATH, json={"items": ["wlt"]})
    client.cookies.clear()
    sign_in(client, mailer, "b@example.com")
    assert client.get(PATH).json() == {"items": []}
    client.post(PATH, json={"items": ["arkurator"]})
    # b 가 a 의 값을 지우려 해도 자기 목록만 바뀐다
    client.delete(f"{PATH}/wlt")
    client.cookies.clear()
    sign_in(client, mailer, "a@example.com")
    assert client.get(PATH).json() == {"items": ["wlt"]}


def test_rejects_malformed_values(client, mailer) -> None:
    sign_in(client, mailer)
    for bad in ["", "Wlt", "../etc", "store:", "store:../x", "store:abc", "a" * 81, "showroom:Ab12Cd34"]:
        assert client.post(PATH, json={"items": [bad]}).status_code == 422, bad
    assert client.post(PATH, json={"items": []}).status_code == 422
    assert client.delete(f"{PATH}/Bad..Value").status_code == 422
    assert rows(client, Bookmark) == []


def test_limit(client, mailer) -> None:
    sign_in(client, mailer)
    assert client.post(PATH, json={"items": [f"w{i}" for i in range(MAX_BOOKMARKS)]}).status_code == 200
    r = client.post(PATH, json={"items": ["one-more"]})
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "too_many_bookmarks"
    # 이미 있는 값은 한도와 상관없이 그대로 성공한다
    assert client.post(PATH, json={"items": ["w0"]}).status_code == 200


def test_cross_origin_write_is_rejected(client, mailer) -> None:
    sign_in(client, mailer)
    assert client.post(PATH, json={"items": ["wlt"]}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.delete(f"{PATH}/wlt", headers={"Origin": "https://evil.example"}).status_code == 403


def test_delete_account_removes_bookmarks(client, mailer) -> None:
    sign_in(client, mailer)
    client.post(PATH, json={"items": ["wlt", "arkurator"]})
    assert client.cookies.get(COOKIE)
    assert client.delete("/api/account").status_code == 204
    assert rows(client, Bookmark) == []

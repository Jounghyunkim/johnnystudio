"""회원의 즐겨찾기 (My Studio, ADR-0017). 로그인한 회원의 목록을 DB 에 두어 다른 브라우저·기기에서도 같게 보인다.

비회원의 즐겨찾기는 지금처럼 브라우저(localStorage)에만 있다. 로그인하면 브라우저가 그 목록을 한 번 보내 계정 목록에 더하고 지운다.

    GET    /api/account/bookmarks            → {items}  넣은 순서대로
    POST   /api/account/bookmarks {items}    → {items}  없는 것만 뒤에 더한다 (하나 넣기, 로그인할 때 브라우저 목록 옮기기)
    DELETE /api/account/bookmarks/{item}     → {items}  없어도 성공

세 요청 모두 바뀐 뒤의 전체 목록을 돌려준다. 브라우저는 마지막 요청의 답으로 화면을 맞춘다 (여러 번 빨리 눌러도 어긋나지 않게).

값의 형식은 web/src/lib/bookmarks.ts 와 같다: Library 작품 slug, Store 앱 `store:<앱 코드>`.
그 작품·앱이 지금 공개되어 있는지는 보지 않는다 (My Studio 가 보일 때 사라진 것은 건너뛴다). 탈퇴하면 app/auth.py 가 지운다.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import DbDep, api_error, required_session
from .db import AuthSession, Bookmark

router = APIRouter(prefix="/api/account/bookmarks")

# slug(content 파일 이름 규칙) 또는 store:<Store 앱 코드>
ITEM_PATTERN = r"^(?:[a-z0-9]+(?:-[a-z0-9]+)*|store:[0-9A-Za-z]{4,12})$"
ITEM_MAX = 80
# 한 사람이 넣을 수 있는 수. 지금 공개 작품·앱을 모두 넣어도 넉넉하다
MAX_BOOKMARKS = 500

Item = Annotated[str, Field(min_length=1, max_length=ITEM_MAX, pattern=ITEM_PATTERN)]
SessionDep = Annotated[AuthSession, Depends(required_session)]


class AddRequest(BaseModel):
    items: list[Item] = Field(min_length=1, max_length=MAX_BOOKMARKS)


def _items(db: Session, user_id: str) -> list[str]:
    return list(db.scalars(select(Bookmark.item).where(Bookmark.user_id == user_id).order_by(Bookmark.id)))


@router.get("")
def list_bookmarks(db: DbDep, session: SessionDep) -> dict[str, Any]:
    return {"items": _items(db, session.user_id)}


@router.post("")
def add_bookmarks(body: AddRequest, db: DbDep, session: SessionDep) -> dict[str, Any]:
    # 두 탭이 같은 값을 거의 함께 넣으면 한쪽이 겹침 오류를 받는다: 다시 읽고 한 번 더 한다 (결과는 같다)
    for attempt in range(2):
        have = set(_items(db, session.user_id))
        new = [i for i in dict.fromkeys(body.items) if i not in have]
        if not new:
            break
        count = db.scalar(select(func.count()).select_from(Bookmark).where(Bookmark.user_id == session.user_id)) or 0
        if count + len(new) > MAX_BOOKMARKS:
            raise api_error(status.HTTP_409_CONFLICT, "too_many_bookmarks", f"즐겨찾기는 {MAX_BOOKMARKS}개까지 넣을 수 있습니다.")
        db.add_all(Bookmark(user_id=session.user_id, item=i) for i in new)
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()
            if attempt:
                raise
    return {"items": _items(db, session.user_id)}


@router.delete("/{item}")
def remove_bookmark(
    item: Annotated[str, Path(max_length=ITEM_MAX, pattern=ITEM_PATTERN)],
    db: DbDep,
    session: SessionDep,
) -> dict[str, Any]:
    db.execute(delete(Bookmark).where(Bookmark.user_id == session.user_id, Bookmark.item == item))
    db.commit()
    return {"items": _items(db, session.user_id)}

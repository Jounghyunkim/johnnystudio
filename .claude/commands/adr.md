---
description: 새 ADR(결정 기록)을 만든다
argument-hint: <결정 제목>
---

결정 "$ARGUMENTS" 에 대한 ADR 을 만든다.

1. `docs/04_architecture/adr/` 에서 가장 큰 번호를 찾고 +1 을 한다(4자리). 파일명은 `NNNN-<영문-kebab-slug>.md` 다.
2. 형식은 `docs/templates/ADR_TEMPLATE.md` 를 따른다. 사용자가 확정하기 전까지 상태는 `제안됨` 으로 둔다.
3. 맥락·검토한 선택지·결정·결과·재검토 조건을 대화 내용으로 채운다. 근거가 없는 부분은 지어내지 말고 사용자에게 묻는다.
4. 이 결정이 기존 ADR 을 대체하면, 기존 ADR 은 내용을 고치지 않는다. 상태만 `대체됨 (→ ADR-NNNN)` 으로 바꾼다.
5. `docs/04_architecture/adr/README.md` 목록에 한 줄을 추가한다.

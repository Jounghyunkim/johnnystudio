---
description: 이번 세션의 작업 로그를 dev_history 에 쓰고 ROADMAP 을 갱신한다
argument-hint: [주제-슬러그]
---

이번 세션의 작업 로그를 `dev_history/` 에 쓴다.

1. 파일명은 `dev_history/YYYY-MM-DD_<slug>.md` 로 한다. 날짜는 `date +%F` 결과를 쓴다.
   slug 는 `$ARGUMENTS` 를 쓰고, 비어 있으면 작업 내용으로 짧은 영문 kebab-case 를 정한다.
   같은 날짜·같은 주제의 파일이 이미 있으면 새 파일을 만들지 말고 맨 아래에 `## 추가 (HH:MM)` 섹션으로 이어 쓴다.
2. 형식은 `docs/templates/WORKLOG_TEMPLATE.md` 를 따른다.
3. 내용은 이 대화와 `git status`·`git diff --stat`·`git log` 로 확인한 사실만 쓴다.
   하지 않은 일을 한 것처럼 쓰지 않는다. 실행해서 확인하지 못한 것은 "미검증"이라고 적는다.
4. 이번 세션에서 결정한 것이 있는데 ADR 이 없으면, ADR 로 남길지 사용자에게 묻는다.
5. `docs/ROADMAP.md` 의 체크박스와 "현재 위치"를 갱신한다.
6. 쓴 내용을 짧게 요약해서 보여 준다. 커밋은 하지 않는다.

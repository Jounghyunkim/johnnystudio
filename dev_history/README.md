# dev_history: 작업 로그

> 세션(작업 한 번)마다 무엇을, 왜 했는지 남긴다. 다음 세션의 작업자는 사람이든 AI 든 여기서 맥락을 이어받는다.

## 규칙

- 파일명은 `YYYY-MM-DD_<주제-슬러그>.md` 다 (슬러그는 영문 kebab-case). 예: `2026-11-05_project-setup.md`
- 형식은 [../docs/templates/WORKLOG_TEMPLATE.md](../docs/templates/WORKLOG_TEMPLATE.md) 를 따른다.
- **쓴 내용은 고치지 않는다** (오타는 예외). 같은 날 같은 주제라면 맨 아래에 `## 추가 (HH:MM)` 섹션으로 이어 쓴다.
- **사실만 쓴다.** 실행해서 확인한 것과 확인하지 못한 것을 구분한다.
- 결정한 것은 ADR 로 링크하고, 진행 상황은 [../docs/ROADMAP.md](../docs/ROADMAP.md) 에 반영한다.
- Claude Code 에서는 `/worklog` 명령으로 쓴다.

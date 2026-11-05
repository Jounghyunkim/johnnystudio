# 디자인 시스템

> **상태**: 임시값. Phase 3 에서 철학·톤앤매너([PHILOSOPHY.md](../01_vision/PHILOSOPHY.md))를 바탕으로 확정한다.
> **Last Updated**: 2026-11-05

## 원칙 (지금 적용 중)

- 색·간격·글꼴·글자 크기는 `src/assets/css/tokens.css` 의 변수로만 쓴다. 토큰만 바꾸면 사이트 전체 인상이 바뀌어야 한다.
- 라이트/다크 모드는 OS 설정(`prefers-color-scheme`)을 따른다. 수동 전환 버튼을 둘지는 Phase 3 에서 정한다.
- 모바일 우선으로 만든다. 좌우 여백은 최소 16px 이고, 가로 스크롤이 생기면 안 된다.
- 색 대비는 WCAG AA 기준이다 (본문 4.5:1 이상, 큰 글자 3:1 이상).
- 한국어 줄바꿈은 어절 단위로 한다 (`word-break: keep-all`).
- `prefers-reduced-motion` 을 켠 사용자에게는 움직임을 끈다.

## 현재 토큰 (임시값)

| 그룹 | 변수 | 비고 |
|---|---|---|
| 색 | `--color-bg` `--color-surface` `--color-text` `--color-text-muted` `--color-border` `--color-accent` `--color-accent-contrast` `--color-success` | 중립 회색에 파란 강조색 (브랜드 색 아님) |
| 글꼴 | `--font-sans` | 시스템 한글 글꼴 스택. 웹폰트(Pretendard 등)는 미정이고, 도입하면 `src/assets/fonts/` 에 직접 둔다 |
| 글자 크기 | `--font-size-sm` … `--font-size-2xl` | `2xl` 은 화면 폭에 따라 커진다 (`clamp`) |
| 줄 높이 | `--line-height-tight` `--line-height-base` | |
| 간격 | `--space-1` … `--space-24` | 4px 배수 |
| 모양 | `--radius-sm` `--radius-md` `--radius-full` | |
| 레이아웃 | `--container-max` `--gutter` `--header-height` | |

## 컴포넌트 (`src/assets/css/components.css`)

`brand`, `nav`, `eyebrow`, `hero`, `section__title`, `card-grid`, `card`, `badge`

## Phase 3 에서 정할 것

- [ ] 브랜드 색 (주색·보조색·강조색)
- [ ] 로고·워드마크, 파비콘 (현재 `src/assets/img/favicon.svg` 는 임시 "J")
- [ ] 글꼴 (제목용 / 본문용)
- [ ] 이미지·일러스트 스타일, 모션 원칙
- [ ] 다크 모드 수동 전환 여부

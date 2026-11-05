// JohnnyStudio 공통 스크립트 (ES 모듈)
//
// 원칙: 콘텐츠는 HTML 에 있다. 이 스크립트가 없어도 페이지는 완전히 동작해야 한다.
// 여기에는 보조 기능만 둔다. (AGENTS.md §5)

// 푸터 연도를 올해로 맞춘다. JS 가 없으면 HTML 에 적힌 연도가 그대로 보인다.
for (const el of document.querySelectorAll("[data-year]")) {
  el.textContent = String(new Date().getFullYear());
}

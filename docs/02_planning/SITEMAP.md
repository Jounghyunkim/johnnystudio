# 사이트맵

> **상태**: Phase 1 구현 완료 (자리표시 콘텐츠 일부 남음). Phase 2 회원 가입·로그인 구현 (메일 발송 설정 전). 구역 구조는 [ideation.md](../ideation.md) §0.
> **Last Updated**: 2026-11-24

## 페이지

| 주소 | 구역 | 페이지 | 역할 | 상태 |
|---|---|---|---|---|
| `/` | — | 홈 (랜딩) | 히어로(한 줄 정의 + 다루는 작품 7가지 유형과 공개 개수), 이렇게 쓰세요(둘러보기·바로 쓰기·모아 두기·함께 일하기), 대표 작품(하나면 넓은 카드), 일하는 원칙, 함께 일하는 방식, 최근 기록, 자주 묻는 질문, 마지막 안내. 문구는 `profile.yaml` 의 `landing` | ✅ |
| `/library/` | Showcase | Library | 전체 작품: 검색, 유형 필터, 정렬. 상태가 주소(`?q=&type=&sort=`)에 남는다 | ✅ |
| `/library/<slug>/` | Showcase | 작품 상세 | 유형별 뷰어(실행·다운로드·체험·영상·사진·원문), 소개, 비슷한 작품 | ✅ |
| `/store/` | Store | Store 목록 | Library 의 Windows 앱('공식', 누르면 Library 상세) + 회원이 올리고 운영자가 승인한 앱: 검색·분류·정렬(`?q=&category=&sort=`). 회원 앱은 브라우저에서 API 로 읽는다 ([ADR-0012](../04_architecture/adr/0012-member-store.md), [기능 명세](features/store.md)) | ✅ |
| `/store/app/?id=<코드>` | Store | Store 앱 상세 | 내려받기, 검사 결과·SHA-256·서명 문구·VirusTotal 검색 링크, 소개, 이전 버전, 공유 주소, 신고 | ✅ |
| `/store/new/` | Store | 앱 올리기 | 로그인 → 표시 이름·약관 동의 → 파일 → 분석으로 채운 양식 → 검토 요청. `?app=<코드>` 는 새 버전. 색인 안 함 | ✅ |
| `/store/mine/` | Store | 내 앱 | 검토 상태·사유·검사 결과, 고치기·아이콘·새 버전·지우기. 색인 안 함 | ✅ |
| `/store/manage/` | (운영) | Store·Showroom 검토 | 검토 대기·신고·숨김·차단 (아래에 Showroom 절). 운영자 이메일만 (API 가 판단). 색인 안 함 | ✅ |
| `/store/terms/` | Store | Store·Showroom 이용약관 | `content/pages/store-terms.md` | ✅ (운영자·연락처는 `TODO(content)`) |
| `/showroom/` | Showroom | Showroom 목록 | Library 의 웹 서비스('공식') + 회원이 소개하고 운영자가 승인한 웹 서비스. 검색·분류·정렬. 카드의 '열기'는 새 탭 ([기능 명세](features/showroom.md)) | ✅ |
| `/showroom/service/?id=<코드>` | Showroom | 서비스 상세 | 서비스 열기, 화면 그림, 설명, 공유 주소, 신고 | ✅ |
| `/showroom/new/` | Showroom | 서비스 소개하기 | 로그인 → 표시 이름·약관 → 이름·주소·소개·분류·그림 → 검토 요청. 색인 안 함 | ✅ |
| `/showroom/mine/` | Showroom | 내 서비스 | 검토 상태·사유, 고치기(주소를 바꾸면 다시 검토), 그림, 지우기. 색인 안 함 | ✅ |
| `/log/` | Showcase | Life Log | 작품 + 마일스톤 타임라인, 연도별 | ✅ |
| `/about/` | Showcase | About | 원칙, 운영 방식(셀프 호스팅), 로드맵, 운영자 소개 | ✅ (운영자 소개는 자리표시) |
| `/work/` | Work with me | 함께 일하기 | 서비스, 진행 방식(GitHub 대응), Client Room 미리보기(`#client-room`), 연락 | ✅ (서비스·연락처는 초안) |
| `/studio/` | My Studio | My Studio | 즐겨찾기 모아 보기 (브라우저 저장) | ✅ |
| `404` | — | 오류 | 없는 주소 안내 | ✅ |
| `/login/` | My Studio | 로그인 | 이메일 + 비밀번호, 아이디(이메일) 기억하기(브라우저 저장). `?next=` 로 돌아올 곳. '비밀번호를 잊었나요?', '가입하기' 링크 ([ADR-0008](../04_architecture/adr/0008-password-login.md)) | ✅ |
| `/signup/` | My Studio | 가입 | 이메일을 받아 인증 메일을 보낸다 | ✅ |
| `/login/reset/` | My Studio | 비밀번호 재설정 | 가입한 이메일로 링크를 보낸다. 색인 안 함 | ✅ |
| `/login/verify/#t=…` | My Studio | 이메일 확인 | 메일 링크가 여는 곳. **계속하기**를 눌러야 링크가 쓰인다. 가입·재설정이면 이어서 비밀번호를 정한다. 색인 안 함 | ✅ |
| `/account/` | My Studio | 계정 | 이메일·가입일·마지막 로그인, 비밀번호 정하기·바꾸기, 로그아웃, 모든 기기에서 로그아웃, 회원 탈퇴(`<dialog>` 확인). 색인 안 함 | ✅ |
| `/privacy/` | — | 개인정보처리방침 | `content/pages/privacy.md`. 바닥글·로그인 화면에서 연결 | ✅ (운영자·연락처·발송 업체는 `TODO(content)`) |
| `/admin/` | (운영) | 작품 관리 | **개발 서버 전용** (`page.dev.tsx`, 출시 빌드에 없음). 작품 현황·검사, 새 작품, 편집, 이미지·다운로드 파일 올리기, 공개·초안·삭제. `dev.sh` 가 찍는 `#k=<토큰>` 주소로 연다 ([ADR-0009](../04_architecture/adr/0009-local-portfolio-manager.md), [기능 명세](features/portfolio-manager.md)) | ✅ |
| `/rooms/…` | Client Room | 의뢰인 룸 | Phase 3 | — |
| `play.<도메인>` | Showcase | 웹 패키지 샌드박스 | 별도 출처. Phase 1.5 | — |

## 메뉴

- **헤더**: **Library ▾**(펼침: 작품 전체 · Store · Showroom) · Life Log · Work with me · About, 오른쪽에 ★ My Studio (즐겨찾기 개수)와 **로그인 / 로그인한 이메일**(→ `/account/`).
  - 이메일은 남는 폭만큼만 보이고 넘치면 `…` 로 줄인다. 전체 주소는 마우스를 올리면 보인다
  - 휴대폰 폭에서는 @ 앞부분만 보이고, 메뉴 버튼(`<details>`, JS 없이도 열림) 맨 위에 전체 이메일이 있다
- **바닥글**: 같은 메뉴를 한 줄로(Library · Store · Showroom · Life Log · …) + My Studio, 운영 방식 한 줄, 개인정보처리방침, 외부 채널 링크(`profile.yaml` 의 `links`), 테마 선택(어둡게·밝게·시스템)
- **테마 버튼**: 헤더 오른쪽(넓은 화면), 휴대폰 메뉴 맨 아래

## 콘텐츠 목록

| 작품 | 유형 | 상태 | 비고 |
|---|---|---|---|
| Arkurator | 웹 서비스 | **공개** | https://arkurator.net |
| Johnny Mecro · Johnny-Dir · SmartFolder Organizer · Screen-REC · SpaceSense AI · TakeScreenShot · SentinelLite-AV · WLT · CMG Monitor | 데스크톱 툴 | **공개** (9개) | JohnnyStore 에서 옮김 (2026-11-22, [ADR-0011](../04_architecture/adr/0011-absorb-johnnystore.md)). 설치 파일은 서버 설정 뒤 `/opt/johnnystudio/files` 로 옮긴다. 옛 초안 '하드웨어 모니터링 앱'·'SSH 터미널 클라이언트'는 CMG Monitor·WLT 로 대신했다. Microsoft Store 주소: CMG Monitor·Johnny-Dir·WLT·Screen-REC·TakeScreenShot (2026-11-24) |
| My Claude Inspector | 데스크톱 툴 | **공개** | 2026-11-24 추가. 설치 파일 v0.1.2 (GitHub Releases 와 SHA-256 같음), 랭킹 웹·GitHub 링크. M8 서비스는 deploy/README §9 |
| JohnnyPlanner | 데스크톱 툴 | **공개** (개발 중) | 2026-11-24 설치 파일 추가. Microsoft Store 주소 확인 필요 `[확인 필요]` |
| Skill Hub | 웹 서비스 | 초안 | 소개·날짜·주소 필요 |
| 로봇 프로젝트 | 하드웨어 | 초안 | 이름·사진 또는 영상 필요 |

## 정해야 할 것

- [ ] 대표 작품 5~10개의 실제 내용 (ideation §9-3)
- [ ] 제공 서비스와 공개 연락처 (§9-4)
- [ ] 언어 (한국어만 / 한·영)
- [ ] 운영자 소개 범위 (§9-7)

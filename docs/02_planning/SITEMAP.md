# 사이트맵

> **상태**: Phase 1 구현 완료 (자리표시 콘텐츠 일부 남음). Phase 2 회원 가입·로그인 구현 (메일 발송 설정 전). 구역 구조는 [ideation.md](../ideation.md) §0.
> **Last Updated**: 2026-11-28

## 페이지

| 주소 | 구역 | 페이지 | 역할 | 상태 |
|---|---|---|---|---|
| `/` | — | 홈 (랜딩) | 히어로(한 줄 정의 + 다루는 작품 8가지 유형과 공개 개수 (2026-11-27: '데스크톱 툴' → '데스크톱 앱', '안드로이드 앱' 추가, ADR-0016), 버튼: Library 둘러보기 · Store · Showroom · 함께 일하기), 이렇게 쓰세요(둘러보기·바로 쓰기·모아 두기·함께 일하기), 대표 작품(하나면 넓은 카드), 일하는 원칙, 함께 일하는 방식, 최근 기록, 자주 묻는 질문, 마지막 안내. 문구는 `profile.yaml` 의 `landing` | ✅ |
| `/library/` | Showcase | Library | 앱·서비스 작품 (영상·사진·글·하드웨어는 Story 페이지, ADR-0018): 검색, 유형 필터, 정렬. 상태가 주소(`?q=&type=&sort=`)에 남는다. 유형(웹 서비스·데스크톱 앱 …)마다 칸을 나누고 칸 사이에 가로 점선, 카드는 1280px 부터 4칸 (2026-11-26). **Store·Showroom 에서 JohnnyStudio(운영자 계정)가 올린 공식 앱·서비스만** 모은 곳이다: 빌드된 카드(작품 파일)를 브라우저에서 공식 목록(`?official=true`)에 맞추고, 카드를 누르면 Store 앱·Showroom 서비스 화면으로 간다 (2026-11-27, [ADR-0015](../04_architecture/adr/0015-library-as-official-view.md)). 회원 앱·서비스는 Store·Showroom 에만 (시험이 확인한다) | ✅ |
| `/library/<slug>/` | Showcase | 작품 상세 | Store·Showroom 으로 옮긴 작품(`storeApp`·`showroomService`)은 그 화면으로 **넘겨 주기만** 한다 (meta refresh + 링크, 색인 안 함). 코드가 없는 작품(영상·사진·글·하드웨어, 옮기지 않은 앱)만 유형별 뷰어(실행·다운로드·체험·영상·사진·원문), 소개, 비슷한 작품 | ✅ |
| `/store/` | Store | Store 목록 | Library 의 Windows 앱('공식', 누르면 Library 상세) + 회원이 올리고 운영자가 승인한 앱: 검색·분류·정렬(`?q=&category=&sort=`). 회원 앱은 브라우저에서 API 로 읽는다. 개발 서버의 운영자에게는 공식 카드에 작품 지우기(Library 에서도 사라짐) ([ADR-0012](../04_architecture/adr/0012-member-store.md), [기능 명세](features/store.md)) | ✅ |
| `/store/app/?id=<코드>` | Store | Store 앱 상세 | Library 의 데스크톱 앱을 누르면 오는 설명 화면이기도 하다 (즐겨찾기는 Library 와 같은 slug, ADR-0015). 대표 그림, 내려받기, 검사 결과·SHA-256·서명 문구·VirusTotal 검색 링크, 소개 자료(추천 대상·기능·화면·사용 방법·설명·질문, 옆에 '한눈에'), 이전 버전, 공유 주소, 신고. 올린 사람·운영자에게는 머리글의 '편집'(소개 꾸미기 화면: 이름·설명·분류·아이콘·소개 자료)과 앱/버전 지우기, 올린 사람에게 새 버전 올리기 (겹치던 '정보 고치기'·'아이콘 바꾸기'·'검토 화면'은 2026-11-26 에 뺐다) | ✅ |
| `/store/new/` | Store | 앱 올리기 | 로그인 → 표시 이름·약관 동의 → 파일 → 분석으로 채운 양식 + AI 키트(프롬프트 복사·소개 자료 불러오기)·소개 자료 편집 → 검토 요청. `?app=<코드>` 는 새 버전. 색인 안 함 ([ADR-0013](../04_architecture/adr/0013-listing-kit.md)) | ✅ |
| `/store/listing/?app=<코드>` | Store | 앱 소개 꾸미기 | 소개 자료 편집·불러오기·미리보기·Microsoft Store 제출용 항목. 올린 사람·운영자. 색인 안 함 ([기능 명세](features/listing.md)) | ✅ |
| `/store/guide/` | Store | 소개 자료 만들기 | 항목 표(Microsoft Store 칸과 대조), 파일 묶음, 지킬 것, 프롬프트 복사·양식 내려받기 (Store·Showroom 공용) | ✅ |
| `/store/mine/` | Store | 내 앱 | 검토 상태·사유·검사 결과, 고치기·아이콘·새 버전·지우기. 색인 안 함 | ✅ |
| `/store/manage/` | (운영) | Store·Showroom 검토 | 검토 대기·신고·숨김·차단, 앱마다 편집(소개 꾸미기 화면 `/store/listing/?app=`)·아이콘 바꾸기·지우기 (아래에 Showroom 절, 서비스마다 편집·지우기). 운영자 이메일만 (API 가 판단). Store·Showroom 목록의 '검토' 버튼(운영자에게만 보임)으로 들어온다. 색인 안 함 | ✅ |
| `/store/terms/` | Store | Store·Showroom 이용약관 | `content/pages/store-terms.md` | ✅ (운영자·연락처는 `TODO(content)`) |
| `/showroom/` | Showroom | Showroom 목록 | Library 의 웹 서비스('공식') + 회원이 소개하고 운영자가 승인한 웹 서비스. 검색·분류·정렬. 카드의 '열기'는 새 탭. 개발 서버의 운영자에게는 공식 카드에 작품 지우기 ([기능 명세](features/showroom.md)) | ✅ |
| `/showroom/service/?id=<코드>` | Showroom | 서비스 상세 | 대표 그림, 서비스 열기, 소개 자료(Store 와 같은 절), 공유 주소, 신고. 소개한 사람·운영자에게는 머리글의 '편집'(소개 꾸미기 화면)과 '서비스 지우기' (겹치던 '검토 화면'은 2026-11-26 에 뺐다. 검토는 목록 머리글의 '검토') | ✅ |
| `/showroom/new/` | Showroom | 서비스 등록 | 로그인 → 표시 이름·약관 → AI 키트·소개 자료 편집(이름·주소·분류·그림 모음 …) → 검토 요청. 색인 안 함 | ✅ |
| `/showroom/listing/?id=<코드>` | Showroom | 서비스 소개 꾸미기 | 소개 자료 편집·불러오기. 소개한 사람·운영자. 색인 안 함 | ✅ |
| `/showroom/mine/` | Showroom | 내 서비스 | 검토 상태·사유, 고치기(주소를 바꾸면 다시 검토), 소개 꾸미기, 아이콘, 지우기. 색인 안 함 | ✅ |
| `/log/` | Showcase | Life Log | 작품 + 마일스톤 타임라인, 연도별 | ✅ |
| `/story/video/` · `/story/photo/` · `/story/article/` · `/story/hardware/` | Story | 영상 · 사진 · 글 · 하드웨어 | 그 유형의 작품만 (빌드된 HTML). 없으면 '준비 중'과 Library·Life Log 로 가는 길. '글'에는 'Blog 전체 보기'. 카드는 작품 상세로, 상세의 현재 위치는 `Story › 영상` (2026-11-27, ADR-0018) | ✅ |

**Story 아래 페이지**(Library · Life Log · 영상 · 사진 · 글 · 하드웨어)는 머리글 제목 위에 현재 위치(`Story › 영상`), 머리글 아래 가로줄에 **Story 탭**(Library · Life Log · Blog ↗ · 영상 · 사진 · 글 · 하드웨어)을 둔다. 지금 페이지의 탭에 밑줄. 휴대폰에서는 탭 줄만 옆으로 넘긴다 (2026-11-28, ADR-0018 결정 5).
| `/about/` | Showcase | About | 원칙, 운영 방식(셀프 호스팅), 로드맵, 운영자 소개 | ✅ (운영자 소개는 자리표시) |
| `/work/` | Work with me | 함께 일하기 | 서비스, 진행 방식(GitHub 대응), Client Room 미리보기(`#client-room`), 연락 | ✅ (서비스·연락처는 초안) |
| `/studio/` | My Studio | My Studio | 즐겨찾기 모아 보기. **로그인했으면 계정(DB)에 저장**되어 다른 브라우저·기기에서도 같고, 로그인하지 않으면 이 브라우저에만 저장된다. 로그인하면 브라우저 목록을 계정으로 옮긴다 (2026-11-27, [ADR-0017](../04_architecture/adr/0017-member-bookmarks.md)). 위에 저장 위치를 알린다. 두 구역: **JohnnyStudio**(Library 작품, Store 의 '공식' 앱 포함)와 **Store**(회원 앱, 공개 목록을 받아 브라우저에서 고른다) | ✅ |
| `404` | — | 오류 | 없는 주소 안내 | ✅ |
| `/login/` | My Studio | 로그인 | 이메일 + 비밀번호, 아이디(이메일) 기억하기(브라우저 저장). `?next=` 로 돌아올 곳. '비밀번호를 잊었나요?', '가입하기' 링크 ([ADR-0008](../04_architecture/adr/0008-password-login.md)) | ✅ |
| `/signup/` | My Studio | 가입 | 이메일을 받아 인증 메일을 보낸다 | ✅ |
| `/login/reset/` | My Studio | 비밀번호 재설정 | 가입한 이메일로 링크를 보낸다. 색인 안 함 | ✅ |
| `/login/verify/#t=…` | My Studio | 이메일 확인 | 메일 링크가 여는 곳. **계속하기**를 눌러야 링크가 쓰인다. 가입·재설정이면 이어서 비밀번호를 정한다. 색인 안 함 | ✅ |
| `/account/` | My Studio | 계정 | 이메일·가입일·마지막 로그인, 비밀번호 정하기·바꾸기, 로그아웃, 모든 기기에서 로그아웃, 회원 탈퇴(`<dialog>` 확인). 색인 안 함 | ✅ |
| `/settings/` | — | 설정 | 바닥글 오른쪽 아래 **설정** 버튼. 사용자 현황(내 계정·표시 이름 바꾸기, 운영자에게는 회원·Store·Showroom 전체 현황 개수와 차트: 가입 추이 30·90일, 마지막 로그인, 앱·서비스 상태, 내려받기 상위 앱), 앱 설정(테마·로그인 이메일 기억, 운영자에게는 운영 설정 읽기 전용), 일반 설정(캐시 지우기·이 브라우저 저장 값 지우기). 색인 안 함 ([기능 명세](features/settings.md)) | ✅ |
| `/privacy/` | — | 개인정보처리방침 | `content/pages/privacy.md`. 바닥글·로그인 화면에서 연결 | ✅ (운영자·연락처·발송 업체는 `TODO(content)`) |
| `/admin/` | (운영) | 작품 관리 | **개발 서버 전용** (`page.dev.tsx`, 출시 빌드에 없음). 작품 현황·검사, 새 작품, 편집, 이미지·다운로드 파일 올리기, 공개·초안·삭제. `dev.sh` 가 찍는 `#k=<토큰>` 주소로 연다 ([ADR-0009](../04_architecture/adr/0009-local-portfolio-manager.md), [기능 명세](features/portfolio-manager.md)) | ✅ |
| `/rooms/…` | Client Room | 의뢰인 룸 | Phase 3 | — |
| `play.<도메인>` | Showcase | 웹 패키지 샌드박스 | 별도 출처. Phase 1.5 | — |

## 메뉴

- **헤더**: **Story ▾** · Work with me · About **|** Store · Showroom. Story ▾ 아래: Library · Life Log · Blog(바깥 블로그 `profile.yaml` 의 `blog`, 새 탭) · 영상 · 사진 · 글 · 하드웨어 (2026-11-27, [ADR-0018](../04_architecture/adr/0018-story-menu.md)). 1024px 보다 좁으면 메뉴 버튼 안(Story 이름 아래에 들여서), 구분선 뒤에 Store · Showroom. 오른쪽에 ★ My Studio (즐겨찾기 개수)와 **로그인 / 로그인한 이메일**(→ `/account/`).
  - 이메일은 남는 폭만큼만 보이고 넘치면 `…` 로 줄인다. 전체 주소는 마우스를 올리면 보인다
  - 휴대폰 폭에서는 @ 앞부분만 보이고, 메뉴 버튼(`<details>`, JS 없이도 열림) 맨 위에 전체 이메일이 있다
- **바닥글**: 같은 메뉴를 풀어 두 줄로(Library · Life Log · Blog · 영상 · 사진 · 글 · 하드웨어 · Work with me · About · Store · Showroom) + My Studio, 운영 방식 한 줄, 개인정보처리방침, 외부 채널 링크(`profile.yaml` 의 `links`), 오른쪽 아래에 **설정**(→ `/settings/`)과 테마 선택(어둡게·밝게·시스템)
- **테마 버튼**: 헤더 오른쪽(넓은 화면), 휴대폰 메뉴 맨 아래

## 콘텐츠 목록

| 작품 | 유형 | 상태 | 비고 |
|---|---|---|---|
| Arkurator | 웹 서비스 | **공개** | https://arkurator.net. 아이콘은 Showroom 의 것을 둥글게 다듬어 씀 (2026-11-26, 예전 대표 그림 `logo.webp` 는 쓰지 않음) |
| JohnnyStudio | 웹 서비스 | **공개** | https://johnnystudio.net (이 사이트). 2026-11-26 Showroom 의 소개(`26FyFAKB`)에서 이름·소개·설명·아이콘을 가져와 등록, 시작한 날은 첫 작업 로그(2026-11-05) |
| Johnny Mecro · Johnny-Dir · SmartFolder Organizer · Screen-REC · SpaceSense AI · TakeScreenShot · SentinelLite-AV · WLT · CMG Monitor | 데스크톱 앱 | **공개** (9개) | JohnnyStore 에서 옮김 (2026-11-22, [ADR-0011](../04_architecture/adr/0011-absorb-johnnystore.md)). 설치 파일은 서버 설정 뒤 `/opt/johnnystudio/files` 로 옮긴다. 옛 초안 '하드웨어 모니터링 앱'·'SSH 터미널 클라이언트'는 CMG Monitor·WLT 로 대신했다. Microsoft Store 주소: CMG Monitor·Johnny-Dir·WLT·Screen-REC·TakeScreenShot (2026-11-24) |
| My Claude Inspector | 데스크톱 앱 | **공개** | 2026-11-24 추가. 설치 파일 v0.1.2 (GitHub Releases 와 SHA-256 같음), 랭킹 웹·GitHub 링크. M8 서비스는 deploy/README §9 |
| JohnnyPlanner | 데스크톱 앱 | **공개** (개발 중) | 2026-11-24 설치 파일 추가. Microsoft Store 주소 확인 필요 `[확인 필요]` |

## 정해야 할 것

- [ ] 대표 작품 5~10개의 실제 내용 (ideation §9-3)
- [ ] 제공 서비스와 공개 연락처 (§9-4)
- [ ] 언어 (한국어만 / 한·영)
- [ ] 운영자 소개 범위 (§9-7)

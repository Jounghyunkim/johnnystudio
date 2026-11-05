## JohnnyStudio 통합 허브 서비스 구축 기획안

정현 님의 수많은 창작물, SW 산출물, 그리고 삶의 궤적(Life Log)을 한곳에 모아 사용자들과 소통할 수 있는 **'통합 웹 서비스(JohnnyStudio Hub)'** 구축을 위한 상위 기획입니다.

### 1. 개발 철학 (Development Philosophy)

* **Digital Twin & Life Log (디지털 자아와 삶의 기록):** JohnnyStudio는 단순한 포트폴리오 사이트가 아닌, 정현 님의 과거(로봇, 영상, 블로그)와 현재(AI 에이전트, L-Genie, ARKURATOR), 그리고 미래를 담아내는 '디지털 자아'의 공간이어야 합니다.
* **Sovereignty & Self-Hosting (데이터 주권과 독립성):** 미니 PC와 싱글 보드 컴퓨터(SBC)를 활용한 홈 랩(Home Lab) 환경의 강점을 극대화합니다. 외부 플랫폼에 종속되지 않고 스스로 통제 가능한 아지트를 구축합니다.
* **Frictionless Accessibility (무마찰 접근성):** 방문자가 복잡한 탐색 과정 없이 정현 님의 흩어진 창작물과 서비스에 직관적으로 접근하고 체험할 수 있도록 진입 장벽을 최소화합니다.
* **Automated Curation (자동화된 큐레이션):** 창작물이 늘어날 때마다 수동으로 업데이트하는 대신, GitHub, 유튜브, 블로그 등의 활동 로그를 자동으로 수집하여 전시하는 지속 가능한 구조를 지향합니다.

### 2. 상위 컨셉 (High-Level Concepts)

* **The Nexus (모든 링크의 교차점):** 흩어져 있는 플랫폼(유튜브, 블로그, GitHub 등)으로 향하는 단순한 링크 모음이 아닌, 각 플랫폼의 최신 콘텐츠를 피드 형태로 당겨와(API 연동) 한눈에 보여주는 '대시보드형 갤러리' 컨셉입니다.
* **Interactive AI Hideout (대화형 AI 아지트):** 정현 님의 페르소나를 학습한 AI 에이전트(가칭 'JohnnyBot')를 메인 화면에 배치합니다. 방문자가 "최근에 만든 AI 툴이 뭐야?"라고 물으면 AI가 관련 프로젝트를 찾아 설명하고 바로가기 링크를 제공하는 인터랙티브 경험을 제공합니다.
* **Dark-Themed Minimalist Aesthetic:** 복잡한 정보들을 세련되게 담아내기 위해, 군더더기 없는 미니멀리스트 아이콘과 **Tailwind CSS 기반의 다크 테마**를 적용하여 개발자이자 크리에이터로서의 트렌디하고 전문적인 이미지를 강조합니다.
* **Service Launcher (서비스 론처):** ARKURATOR, 하드웨어 모니터링 앱, SSH 터미널 클라이언트, Skill Hub 등 직접 개발한 웹 앱과 다운로드 가능한 데스크톱 툴들을 마치 앱스토어처럼 나열하고 즉시 실행/다운로드할 수 있는 영역을 제공합니다.

### 3. 기술 스택 및 아키텍처 (Tech Stack & Architecture)

가지고 계신 기술적 역량과 선호도를 반영한 최적의 스택 구성입니다.

| 구분 | 기술 스택 | 설명 및 적용 방안 |
| --- | --- | --- |
| **Frontend** | React (또는 Next.js), Tailwind CSS | 다크 모드를 기본으로 한 반응형 UI. 애니메이션과 트랜지션을 활용하여 갤러리 탐색 경험 극대화. |
| **Backend** | Python (FastAPI) | 외부 API(유튜브, GitHub 등) 비동기 호출 및 메인 허브의 백엔드 로직 처리. |
| **AI 연동** | LangChain / LangGraph, ChromaDB | JohnnyStudio 내 콘텐츠를 RAG로 구성하여 방문자 응답용 AI 에이전트 파이프라인 구축. |
| **Database** | Redis (캐싱), PostgreSQL/TypeDB | API 호출 속도 최적화를 위한 캐싱 및 프로젝트/로그 데이터 구조화 저장. |
| **Infrastructure** | 미니 PC (GMKtec/Intel), Docker, Cloudflare Tunnel | 홈 랩 환경의 Docker 컨테이너로 서비스 배포 후 Cloudflare Tunnel을 통해 안전하게 외부 도메인(johnnystudio.net 등)과 연결. |

### 4. 단계별 구현 계획 (Implementation Phases)

**Phase 1: 기반 구축 및 랜딩 갤러리 (MVP)**

* **미니멀리스트 UI 설계:** 기획하신 브랜드 로고를 중심으로 Tailwind 다크 테마 기반의 반응형 랜딩 페이지 퍼블리싱.
* **정적 큐레이션:** 가장 대표적인 프로젝트(SW 산출물, 로봇, 영상) 5~10개를 타일 형태의 UI로 배치하여 직관적인 갤러리 구성.
* **Cloudflare Tunnel 연동:** 보유하신 미니 PC 서버 인프라에 도메인을 연결하여 초기 버전을 퍼블릭하게 오픈.

**Phase 2: 데이터 통합 및 동적 라이프로그 (Integration)**

* **API 파이프라인 구축:** FastAPI를 활용해 기존에 활동 중인 블로그(RSS), 유튜브(Data API), GitHub(GraphQL API)의 활동 내역을 주기적으로 크롤링/수집.
* **타임라인 뷰 개발:** 수집된 데이터를 시간순으로 정렬하여 'Life Log' 탭을 구성. 창작의 역사를 한눈에 볼 수 있는 인터랙티브 타임라인 구현.
* **SaaS 론처 연동:** ARKURATOR 등 기존 운용 중인 개별 서비스들을 서브도메인으로 연결하고, 허브 페이지에서 SSO(Single Sign-On)나 세션 공유 없이도 부드럽게 진입할 수 있는 라우팅 설계.

**Phase 3: AI 에이전트 결합 (Intelligence)**

* **RAG 기반 지식베이스 구축:** JohnnyStudio에 올라간 모든 텍스트, 설명, 코드 스니펫 등을 ChromaDB에 벡터화하여 저장.
* **JohnnyBot 탑재:** 화면 우측 하단 또는 메인 인터페이스에 대화형 에이전트 탑재. 방문자의 목적에 맞게 포트폴리오를 추천해주거나, 정현 님의 개발 철학 등을 대신 대답해 주는 가상 비서 역할 수행.
* **분석 대시보드 연동:** 방문자들의 주요 관심사 및 대화 로그를 수집하여, 향후 어떤 콘텐츠를 더 개발할지 인사이트를 얻는 백오피스(Admin) 환경 구축.
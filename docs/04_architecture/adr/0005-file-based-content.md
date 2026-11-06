# ADR-0005: 공개 콘텐츠는 저장소의 파일(content/)로 두고 스키마로 검증한다

- **상태**: 채택됨
- **날짜**: 2026-11-05
- **관련**: [ideation.md](../../ideation.md) §1-2 · §3-1, [CONTENT_GUIDE.md](../../02_planning/CONTENT_GUIDE.md)

## 맥락

- Sovereignty 원칙: 콘텐츠 원본을 스스로 갖고, 언제든 옮길 수 있어야 한다. Arkurator 의 "파일이 곧 데이터베이스"를 이어받는다.
- Phase 1 에는 DB 가 없다 (정적 내보내기, ADR-0004).
- 작품 유형이 7가지이고 유형마다 필요한 정보가 다르다. 빠진 값이나 오타를 빌드 전에 잡아야 한다.
- exe·zip 같은 큰 파일은 git 에 넣으면 저장소가 무거워진다.

## 결정

1. **콘텐츠 원본은 `content/` 의 텍스트 파일**이다.
   - `content/assets/<slug>.md`: 작품 하나 = 파일 하나. YAML 머리말 + Markdown 본문. 파일명이 주소(`/library/<slug>/`)가 된다.
   - `content/lifelog.yaml`: Life Log 마일스톤. 작품은 따로 적지 않아도 날짜에 맞춰 타임라인에 들어간다.
   - `content/profile.yaml`: 홈·About·Work with me 문구 (한 줄 정의, 원칙, 서비스, 진행 방식, 연락처).
2. **스키마**(`web/src/lib/schema.ts`, zod)가 형식을 정한다. 유형별로 필드가 다르다(discriminated union). 모르는 필드는 거부한다 (오타 잡기).
   형식이 틀리면 빌드가 파일명·필드와 함께 멈춘다.
3. **초안**: `draft: true` 는 개발 미리보기에만 보이고 출시 빌드에서 빠진다.
   - 초안이 아닌 작품은 **완성도 검사**(`missingFields`: 날짜, 유형별 필수 값, 실제 체크섬, `TODO(` 표시)를 통과해야 한다. 테스트가 막는다.
   - `sample-` 로 시작하는 작품은 뷰어 예시라서 **출시할 수 없다** (검사가 막는다).
4. **파일 위치**
   - 작은 이미지(대표 이미지, 사진)는 `web/public/media/<slug>/` 에 두고 git 에 넣는다 (webp, 한 장 수백 KB 이하).
   - 큰 파일(exe·zip·고해상도 원본)은 git 밖의 **`/opt/johnnystudio/files/<slug>/`** 에 두고, nginx 가 `/files/` 로 내준다. 릴리스와 따로라서 배포·롤백해도 그대로다.
   - 크기·SHA-256 은 `scripts/file-meta.sh` 로 구해 머리말에 적는다.
5. 출시 전에 채워야 할 곳에는 `TODO(content)` · `TODO(design)` · `TODO(launch)` 표시를 남긴다. 출시 체크리스트가 `grep` 으로 찾는다.

## 결과

- **좋아지는 점**: 작품 추가는 파일 하나 추가로 끝난다. git 이 이력을 남기고, JohnnyBot(Phase 4) 인덱싱 원본으로 바로 쓸 수 있다.
  틀린 콘텐츠는 배포 전에 잡힌다.
- **감수할 점**: 웹 화면에서 바로 편집할 수 없다 (편집기 + git). 큰 파일은 서버에 따로 올려야 한다.

## 재검토 조건

- Phase 2~3 에서 회원·의뢰인 데이터가 생기면 그것은 PostgreSQL 에 둔다. 공개 작품 목록까지 DB 로 옮길지는 그때 다시 정한다.
- 웹에서 콘텐츠를 편집하는 관리 화면이 필요해질 때

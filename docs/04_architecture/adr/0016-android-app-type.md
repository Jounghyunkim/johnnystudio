# ADR-0016: 작품 유형에 '안드로이드 앱'을 더하고, '데스크톱 툴'을 '데스크톱 앱'으로 부른다

- **상태**: 제안됨
- **날짜**: 2026-11-27
- **관련**: [ideation §3-1](../../ideation.md) (하나의 스키마, 유형별 뷰어), [ADR-0005](0005-file-based-content.md) (작품은 파일), [ADR-0015](0015-library-as-official-view.md) (Library 는 Store·Showroom 의 공식 목록),
  [ADR-0012](0012-member-store.md) (Store 는 Windows 앱)

## 맥락

- 사용자 요청 (2026-11-27): "메인 페이지에 '다루는 작품'에 '데스크톱 툴'을 '데스크톱 앱'으로 바꾸고 '안드로이드 앱' 카테고리(유형)도 하나 추가해 주세요."
- 작품 유형은 7가지였다 (`lib/asset-types.ts`). 홈의 '다루는 작품'과 Library 의 유형 칸·필터, 관리 화면의 '새 작품'이 이 목록을 그대로 쓴다.
- Store 는 Windows 설치 파일만 받는다 (ADR-0012). 안드로이드 앱을 둘 Store·Showroom 자리는 아직 없다.

## 결정

1. **'desktop-app' 의 화면 이름을 '데스크톱 툴' → '데스크톱 앱'으로 바꾼다.** 값(`desktop-app`)은 그대로라서 작품 파일·주소(`?type=desktop-app`)·즐겨찾기는 바뀌지 않는다.
2. **유형 `android-app` (안드로이드 앱)을 더한다.** 데스크톱 앱 다음에 둔다 (홈·Library·관리 화면의 순서).
   - 칸: `googlePlay` (Google Play 앱 주소 `https://play.google.com/store/apps/details?id=<패키지 이름>`만 받는다), `downloads` (APK, `os: [android]`), `requirements`
   - 공개하려면 `googlePlay` 또는 APK 1개 이상, APK 마다 크기·SHA-256 (데스크톱 앱과 같은 검사)
   - 상세 화면: 'Google Play에서 받기' + APK 내려받기 패널 (체크섬·검증 방법, 데스크톱 앱과 같은 패널). 카드 바로가기는 'Google Play'
   - Google Play 상표 그림은 쓰지 않고 유형 아이콘(휴대폰)만 쓴다
3. **안드로이드 앱의 설명 페이지는 Library 상세다.** Store·Showroom 코드(`storeApp`·`showroomService`)가 없는 작품이라 ADR-0015 결정 2 의 "코드가 없는 작품" 과 같다. 빌드된 카드가 그대로 Library 에 남는다.
4. **유형 색은 fuchsia.** Android 를 떠올리는 초록 계열은 사이트 강조색(lime, `#bef264`)·사진(emerald)과 겹친다. 비어 있던 보라~분홍 사이를 쓴다 (`lib/type-style.ts`).
5. Download 의 `os` 에 `android` 를 더한다. 관리 화면은 안드로이드 앱에서만 Android 를 고르게 하고, `.apk` 를 올리면 Android 로 짐작한다 (`guessDownload`, `scripts/file-meta.sh`).

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **A. 새 유형 `android-app` (채택)** | 홈·Library 에 따로 보이고 유형 필터로 거를 수 있다. Google Play 주소를 검사할 수 있다 | 스키마·관리 화면·문서를 함께 고쳐야 한다 |
| B. `desktop-app` 을 '앱'으로 넓히고 OS 에 Android 추가 | 유형 수가 그대로 | 사용자가 말한 '카테고리 하나 추가'와 다르다. Store(Windows 앱)로 옮기는 규칙과 섞인다 |
| C. Store 에 안드로이드 앱을 받는다 | Library = Store 의 공식 목록과 맞는다 | Store 의 검사(ClamAV·서명·VirusTotal)·소개 자료가 Windows 기준이다. 따로 정할 일이 크다 |

## 결과

- **좋아지는 점**: 안드로이드 앱을 다른 작품과 같은 카드·필터·즐겨찾기로 보인다. 지금은 0개라서 홈에서는 '준비 중'으로 보인다.
- **나빠지는 점·주의**
  - 안드로이드 앱은 Store·Showroom 에 없으므로, 새 버전은 작품 파일(관리 화면)에서 고친다
  - 설치 파일 검사(ClamAV 등)를 거치지 않는다. 운영자가 올린 APK 만 받는다 (데스크톱 앱의 작품 파일과 같다)
- **재검토 조건**: 회원이 안드로이드 앱을 올리게 하거나 공식 안드로이드 앱이 늘면, Store 에 Android 를 받을지 다시 정한다 (선택지 C)

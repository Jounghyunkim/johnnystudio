---
# 예시: 데스크톱 툴 뷰어(다운로드 패널)가 어떻게 보이는지 확인하는 용도. 값은 모두 가짜다.
# sample- 로 시작하는 에셋은 출시할 수 없다 (검사가 막는다).
title: "샘플: 데스크톱 툴"
type: desktop-app
summary: 다운로드 패널 예시. 버전·OS·크기·SHA-256 과 검증 방법을 보여 줍니다.
status: beta
date: 2026-11
tags: [샘플, 데스크톱]
draft: true
requirements: Windows 10 이상, .NET 8 런타임
downloads:
  - label: Windows 설치 파일
    file: /files/sample-desktop-tool/sample-tool-1.2.0-setup.exe
    version: 1.2.0
    os: [windows]
    size: 18874368
    sha256: 7b75437fb949705bb838b76cbc4115605fabee40ae049385eaee21e8234c4795
    released: 2026-11-01
    signed: false
    notes: 시작 속도 개선, 다크 모드 추가
---

이 항목은 예시입니다. 실제 툴을 등록할 때는 `docs/02_planning/CONTENT_GUIDE.md` 를 참고하세요.

## 변경 내역

- **1.2.0**: 시작 속도 개선, 다크 모드 추가
- **1.1.0**: 첫 공개

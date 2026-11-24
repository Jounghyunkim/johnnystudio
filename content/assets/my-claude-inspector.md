---
title: My Claude Inspector
type: desktop-app
summary: Claude Code 교육생이 내 Claude의 현재 상태를 한눈에 보고, 각 항목의 뜻을 이해하고, 사용 패턴에 맞춰 더 잘 쓰는 방법을 추천받는 PC용 데스크톱 앱입니다.
status: live
date: 2026-11-19
tags: [교육, 개발 도구, 데스크톱, Claude Code]
icon: /media/my-claude-inspector/icon.png
requirements: Windows 10·11 (64비트)
links:
  - { label: 사용량 랭킹, href: "https://myclaudeinspector.vercel.app/ranking" }
  - { label: GitHub, href: "https://github.com/Jounghyunkim/myclaudeinspector" }
downloads:
  - label: Windows 설치 파일 (x64)
    file: /files/my-claude-inspector/MyClaudeInspector-Setup-0.1.2.exe
    version: 0.1.2
    os: [windows]
    size: 126231061
    sha256: 5c207be113fda5e494b3dbb1ec1cd8a9ebc0ca9de7b3d20301c5ae2f82380911
    released: 2026-11-19
    signed: false
---

<!-- 출처: ~/workspace/myclaudeinspector 의 PRODUCT.md·README.md·커밋 기록 (c6acf01), GitHub Releases v0.1.2 (SHA-256 은 릴리스가 공개한 값과 같다) -->

Claude Code 강의를 듣는 교육생이 수업을 듣거나 작업하다가 "지금 내 Claude가 어떤 상태지?"가 궁금할 때 여는 앱입니다. 설치한 Skill과 MCP가 무엇인지, 토큰을 하루와 한 주에 얼마나 썼는지 대화창에 묻지 않아도 늘 같은 자리에서 한눈에 봅니다.

## 한눈에 보는 내 Claude

내 Claude 설치 경로와 프로젝트 경로를 넣으면 관리해야 할 항목의 현황을 보여 줍니다.

- **토큰 사용량**: 일별·주별
- **컨텍스트 윈도**
- **도구**: CLI, MCP, Skills, CLAUDE.md, Memory 등
- **설정과 그 계층**

## 쉬운 설명과 추천

- 모든 값에 "이게 무슨 뜻인지"와 "왜 중요한지"를 붙여, 막 배우기 시작한 사람도 그 값이 작업에 어떤 영향을 주는지 이해할 수 있습니다.
- 내 사용 패턴을 바탕으로 나에게 맞는 설정과 더 효율적인 사용 방식을 추천합니다. 예: "토큰을 많이 써서 작업이 끊길 수 있으니 모델을 Sonnet으로 바꾸세요."
- 추천에는 바로 따라 할 수 있는 프롬프트가 함께 나옵니다. 그 프롬프트를 내 Claude에 넣어 설정 변경, Skill 설치·삭제, MCP 활용 같은 변경을 직접 합니다. 앱은 Claude 설정을 직접 바꾸지 않습니다.

## 사용량 랭킹 (선택)

원하는 사람만 로그인해서 하루 단위 사용량 숫자(토큰, 세션 수, 사용 시간, 도구 호출, 컨텍스트 %)를 올리고, 다른 교육생과 순위를 비교합니다. 기수나 반을 따로 나누지 않습니다. 로그인하지 않으면 PC 안에서만 씁니다.

## 개인정보

- 내 Claude 정보는 PC에서 읽습니다.
- 랭킹 서버에는 사용 숫자와 이름(Skill·MCP·CLI 이름 같은 것)까지만 올립니다. 대화 내용, 파일 경로, 프로젝트 이름, CLAUDE.md와 Memory 본문은 올리지 않습니다.
- 로그인 정보, 토큰, API 키 같은 비밀 값은 아예 읽지 않습니다.
- 올린 기록은 본인이 언제든 지울 수 있습니다.

## 변경 내역

### 0.1.2

- 데스크톱 서버가 Windows 인증서 저장소를 쓰도록 설정

### 0.1.1

- 플랜 한도 사용률을 사용량 API에서 실시간으로 조회

### 0.1.0

첫 Windows 데스크톱 앱입니다.

- 대시보드(토큰·컨텍스트·세션·도구 현황과 추천), 트렌드
- 이메일 로그인과 사용량 랭킹, 본인 랭킹 기록 전체 삭제

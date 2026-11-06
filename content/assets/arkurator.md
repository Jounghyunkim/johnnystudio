---
title: Arkurator
type: web-app
summary: 파일 기반 지식 관리와 RAG AI 에이전트를 결합한 지능형 아카이빙 플랫폼
status: live
date: 2025-12-19
tags: [AI, RAG, 지식관리, FastAPI, LangGraph]
url: https://arkurator.net
cover: /media/arkurator/logo.webp
coverAlt: 파도 위의 방주를 그린 Arkurator 로고
featured: true
---

## 무엇을 하나

- **파일이 곧 데이터베이스**: 폴더 하나가 전체 콘텐츠입니다. 복사만 하면 이전이 끝납니다.
- **별자리 워크스페이스**: 지식 분야를 별자리로 나눈 2D 캔버스에서 워크스페이스를 오갑니다.
- **IDE 스타일 문서 뷰어**: 여러 탭, 드래그로 화면 나누기, 코드 편집과 미리보기를 지원합니다.
- **AI 학습과 질의응답**: HTML·Markdown·PDF 를 학습하고, Gemini·Claude·GPT 중 골라 출처와 함께 실시간으로 답합니다.

## 구성

PHP 프론트엔드와 FastAPI · LangGraph · ChromaDB · PostgreSQL 백엔드로 이루어져 있고, 백엔드는 홈랩 서버에서 운영합니다.

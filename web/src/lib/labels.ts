/**
 * 화면에 보이는 이름. 아이콘·색과 분리해 두어 서버·클라이언트·테스트 어디서나 가볍게 쓴다.
 */
import type { AssetStatus, AssetType, LogKind } from "./schema";

export const TYPE_LABELS: Record<AssetType, string> = {
  "web-app": "웹 서비스",
  "desktop-app": "데스크톱 툴",
  "web-package": "웹 패키지",
  video: "영상",
  gallery: "사진",
  article: "글",
  hardware: "하드웨어",
};

/** 유형마다 방문자가 이 사이트에서 할 수 있는 일 (components/viewers 의 실제 동작과 맞춘다) */
export const TYPE_ACTIONS: Record<AssetType, string> = {
  "web-app": "브라우저에서 바로 실행합니다",
  "desktop-app": "설치 파일을 체크섬과 함께 내려받습니다",
  "web-package": "내려받아 열어 봅니다 (바로 체험은 준비 중)",
  video: "누를 때만 불러오는 영상으로 봅니다",
  gallery: "사진을 크게 넘겨 봅니다",
  article: "원문 글로 이어집니다",
  hardware: "만든 과정을 사진과 영상으로 봅니다",
};

export const STATUS_LABELS: Record<AssetStatus, string> = {
  live: "운영 중",
  beta: "베타",
  dev: "개발 중",
  archived: "보관",
};

export const LOG_KIND_LABELS: Record<LogKind | "asset", string> = {
  start: "시작",
  release: "출시",
  milestone: "이정표",
  note: "기록",
  asset: "작품",
};

export const OS_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
} as const;

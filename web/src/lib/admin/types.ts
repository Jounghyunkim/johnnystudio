/**
 * 작품 관리 API(로컬 관리 서버 ↔ 관리 화면)가 주고받는 형태. 타입만 둔다.
 */
import type { AssetStatus, AssetType } from "../asset-types";

export interface AdminIssue {
  /** 머리말 필드 경로 (예: downloads.0.sha256). 파일 전체 문제면 빈 문자열 */
  path: string;
  message: string;
}

/** 목록의 한 줄 */
export interface AdminAssetRow {
  slug: string;
  title: string;
  /** 형식 오류로 읽지 못했으면 null */
  type: AssetType | null;
  status: AssetStatus | null;
  draft: boolean;
  featured: boolean;
  sample: boolean;
  date?: string;
  updated?: string;
  cover?: string;
  coverAlt?: string;
  summary?: string;
  tags: string[];
  /** 형식 오류: 하나라도 있으면 사이트 빌드가 멈춘다 */
  errors: AdminIssue[];
  /** 공개하려면 채워야 할 것 (완성도 검사 + 이미지 파일 존재 + 대체 텍스트) */
  missing: string[];
  /** 공개는 되지만 고치면 좋은 것 */
  warnings: string[];
  /** 이 작품을 가리키는 곳 (Life Log, profile.yaml 서비스) */
  references: string[];
  /** 파일 수정 시각 (ms). 저장할 때 그사이 다른 도구가 고쳤는지 확인한다 */
  mtime: number;
}

export interface AdminAssetDetail extends AdminAssetRow {
  /** 머리말을 가공하지 않은 값 (기본값을 채우지 않는다) */
  data: Record<string, unknown>;
  body: string;
}

export interface AdminState {
  assets: AdminAssetRow[];
  /** 지금 작품들이 쓰는 태그 (입력 도움말) */
  tags: string[];
  /** 다운로드 파일을 두는 곳과, 운영 위치(/opt/johnnystudio/files)인지 */
  files: { dir: string; production: boolean };
}

export interface CreateAssetInput {
  slug: string;
  type: AssetType;
  title: string;
  summary?: string;
  date?: string;
}

export interface SaveAssetInput {
  data: Record<string, unknown>;
  body: string;
  /** 불러올 때의 mtime. 파일이 그사이 바뀌었으면 저장을 거부한다 */
  baseMtime: number;
}

export interface UploadedMedia {
  /** 사이트 안 경로: /media/<slug>/<파일명> */
  path: string;
  size: number;
  warnings: string[];
}

export interface UploadedFile {
  /** 머리말에 쓸 경로: /files/<slug>/<파일명> */
  file: string;
  size: number;
  sha256: string;
  released: string;
  /** 실제로 저장한 위치 */
  savedTo: string;
  /** 운영 위치가 아니면 서버에 복사하는 명령 */
  installCommand: string | null;
}

/** 다운로드 파일 조각 하나를 받은 결과. 마지막 조각이면 file 이 있다 */
export interface UploadChunkResult {
  received: number;
  file: UploadedFile | null;
}

export interface AdminErrorBody {
  code: string;
  message: string;
  issues?: AdminIssue[];
  missing?: string[];
  references?: string[];
}

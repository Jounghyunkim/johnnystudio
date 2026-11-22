/**
 * 작품 파일(content/assets/<slug>.md) 읽기·쓰기. 서버(Node)에서만 쓴다.
 *
 * 사람이 쓴 파일을 도구가 고쳐도 알아볼 수 있게 남긴다.
 * - yaml 의 Document 로 읽어서 **바뀐 키만** 바꾼다. 주석, 키 순서, 바뀌지 않은 값의 모양은 그대로다.
 * - 없던 키는 FIELD_ORDER 순서에 맞춰 끼워 넣는다. 값 없는 키("", null)는 지운다.
 * - 짧은 목록(tags, os)은 [a, b] 한 줄로 쓴다.
 */
import { Document, isMap, isScalar, isSeq, type Node, parseDocument, visit, type YAMLMap } from "yaml";

import { splitFrontmatterText } from "../content";
import { AssetFrontmatter } from "../schema";
import { FIELD_ORDER } from "./fields";
import type { AdminIssue } from "./types";

export class AssetFileError extends Error {
  override name = "AssetFileError";
  readonly issues: AdminIssue[];
  constructor(issues: AdminIssue[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("\n"));
    this.issues = issues;
  }
}

export interface AssetSource {
  doc: Document;
  body: string;
}

const TO_STRING = { lineWidth: 0, flowCollectionPadding: false } as const;

export function parseAssetSource(raw: string): AssetSource {
  const parts = splitFrontmatterText(raw);
  if (!parts) throw new AssetFileError([{ path: "", message: "맨 위에 --- 로 둘러싼 YAML 머리말이 없다" }]);
  const doc = parseDocument(parts.yaml);
  if (doc.errors.length) {
    throw new AssetFileError(doc.errors.map((e) => ({ path: "", message: `머리말 YAML 을 읽을 수 없다: ${e.message.split("\n")[0]}` })));
  }
  if (!isMap(doc.contents)) throw new AssetFileError([{ path: "", message: "머리말은 '키: 값' 목록이어야 한다" }]);
  return { doc, body: parts.body };
}

export function serializeAssetSource({ doc, body }: AssetSource): string {
  const text = body.trim();
  return `---\n${doc.toString(TO_STRING)}---\n${text ? `\n${text}\n` : ""}`;
}

/** 가공하지 않은 머리말 값 */
export function sourceData(source: AssetSource): Record<string, unknown> {
  const value: unknown = source.doc.toJS();
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** 스키마 검사. 실패하면 필드 경로와 문구 */
export function validateFrontmatter(data: unknown): { ok: true; value: AssetFrontmatter } | { ok: false; issues: AdminIssue[] } {
  const parsed = AssetFrontmatter.safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
}

/** 비교용: YAML 이 2024 를 숫자로 읽은 값과 화면이 보낸 "2024" 를 같게 본다 */
function norm(v: unknown): unknown {
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, norm(x)]),
    );
  }
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

function rank(key: string): number {
  const i = (FIELD_ORDER as readonly string[]).indexOf(key);
  return i < 0 ? FIELD_ORDER.length : i;
}

function keyOf(item: { key: unknown }): string | null {
  return isScalar(item.key) ? String(item.key.value) : null;
}

function makeNode(doc: Document, value: unknown): Node {
  const node = doc.createNode(value) as Node;
  // 글자·숫자만 담은 목록은 한 줄로: tags: [AI, RAG], os: [windows]
  visit(node, {
    Seq(_, seq) {
      if (seq.items.every((i) => isScalar(i))) seq.flow = true;
    },
  });
  return node;
}

/** 키 하나를 바꾸거나(주석 유지) 순서에 맞춰 끼워 넣는다 */
export function setField(doc: Document, key: string, value: unknown): void {
  const map = doc.contents as YAMLMap;
  const node = makeNode(doc, value);
  const pair = map.items.find((p) => keyOf(p) === key);
  if (pair) {
    const old = pair.value as Node | null;
    if (old && (isScalar(old) || isMap(old) || isSeq(old))) {
      if (old.comment) node.comment = old.comment;
      if (old.commentBefore) node.commentBefore = old.commentBefore;
    }
    pair.value = node;
    return;
  }
  const at = map.items.findIndex((p) => {
    const k = keyOf(p);
    return k !== null && rank(k) > rank(key);
  });
  const created = doc.createPair(key, node);
  if (at < 0) map.items.push(created);
  else map.items.splice(at, 0, created);
}

/**
 * 머리말을 data 로 맞춘다: 바뀐 키만 다시 쓰고, data 에 없는 키는 지운다.
 * data 는 fields.ts 의 cleanValue 를 거친 값이어야 한다.
 */
export function applyData(source: AssetSource, data: Record<string, unknown>): void {
  const current = sourceData(source);
  const { doc } = source;
  for (const key of Object.keys(current)) {
    if (!(key in data)) doc.delete(key);
  }
  for (const [key, value] of Object.entries(data)) {
    if (key in current && same(current[key], value)) continue;
    setField(doc, key, value);
  }
}

/** 새 파일 내용 (키는 FIELD_ORDER 순서) */
export function createAssetText(data: Record<string, unknown>, body: string): string {
  const doc = new Document({});
  const source: AssetSource = { doc, body };
  for (const key of Object.keys(data).sort((a, b) => rank(a) - rank(b))) setField(doc, key, data[key]);
  return serializeAssetSource(source);
}

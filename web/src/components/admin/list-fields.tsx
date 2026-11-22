"use client";

/**
 * 관리 화면의 목록 입력: 링크, 사진, 다운로드 파일. 값은 머리말 그대로의 모양(객체 배열)으로 다룬다.
 */
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { adminApi } from "@/lib/admin/client";
import { guessDownload, today } from "@/lib/admin/fields";
import { OS_LABELS } from "@/lib/labels";

import { CopyButton } from "../copy-button";
import { CheckboxField, FilePicker, iconButton, smallButton, TextField } from "./controls";

type Item = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** 필드 경로(photos.0.alt)로 오류 문구를 찾는다 */
export type ErrorAt = (path: string) => string | undefined;

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function RowTools({ index, count, label, onMove, onRemove }: { index: number; count: number; label: string; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp aria-hidden="true" className="size-4" />
        <span className="sr-only">{label} 위로</span>
      </button>
      <button type="button" className={iconButton} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown aria-hidden="true" className="size-4" />
        <span className="sr-only">{label} 아래로</span>
      </button>
      <button type="button" className={`${iconButton} hover:text-danger`} onClick={onRemove}>
        <Trash2 aria-hidden="true" className="size-4" />
        <span className="sr-only">{label} 빼기</span>
      </button>
    </div>
  );
}

// ── 링크 ──

export function LinksField({ value, onChange, errorAt }: { value: Item[]; onChange: (v: Item[]) => void; errorAt: ErrorAt }) {
  const set = (i: number, patch: Item) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="grid gap-4">
      {value.length === 0 && <p className="text-sm text-fg-subtle">추가 링크가 없습니다. 저장소·블로그 글·발표 자료 등을 걸 수 있습니다.</p>}
      {value.map((l, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <TextField label="이름" value={str(l.label)} onChange={(v) => set(i, { label: v })} placeholder="GitHub" error={errorAt(`links.${i}.label`)} />
          <TextField label="주소" type="url" mono value={str(l.href)} onChange={(v) => set(i, { href: v })} placeholder="https://…" error={errorAt(`links.${i}.href`)} />
          <RowTools index={i} count={value.length} label={`링크 ${i + 1}`} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <button type="button" className={smallButton} onClick={() => onChange([...value, { label: "", href: "" }])}>
          <Plus aria-hidden="true" className="size-3.5" />
          링크 추가
        </button>
      </div>
    </div>
  );
}

// ── 사진 ──

export const IMAGE_ACCEPT = "image/webp,image/png,image/jpeg,image/avif";

/** 이미지 올리기: 같은 이름이 있으면 바꿀지 묻는다 */
export async function uploadImage(slug: string, file: File): Promise<{ ok: true; path: string; warnings: string[] } | { ok: false; message: string }> {
  let r = await adminApi.uploadMedia(slug, file);
  if (!r.ok && r.error.code === "exists" && window.confirm(`${r.error.message}\n새 파일로 바꿀까요?`)) {
    r = await adminApi.uploadMedia(slug, file, true);
  }
  return r.ok ? { ok: true, path: r.data.path, warnings: r.data.warnings } : { ok: false, message: r.error.message };
}

export function PhotosField({ slug, value, onChange, errorAt }: { slug: string; value: Item[]; onChange: (v: Item[]) => void; errorAt: ErrorAt }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const set = (i: number, patch: Item) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function add(file: File) {
    setBusy(true);
    setNotice(null);
    const r = await uploadImage(slug, file);
    setBusy(false);
    if (!r.ok) {
      setNotice({ tone: "error", text: r.message });
      return;
    }
    onChange([...value, { src: r.path, alt: "" }]);
    setNotice({ tone: "ok", text: [`올렸습니다: ${r.path}. 대체 텍스트를 써 주세요.`, ...r.warnings].join(" ") });
  }

  return (
    <div className="grid gap-4">
      {value.length === 0 && <p className="text-sm text-fg-subtle">사진이 없습니다. 올리면 web/public/media/{slug}/ 에 저장됩니다.</p>}
      {value.map((p, i) => (
        <div key={i} className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-[8rem_1fr_auto]">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-canvas">
            {str(p.src) && <img src={str(p.src)} alt="" className="size-full object-cover" />}
          </div>
          <div className="grid gap-3">
            <TextField label="파일 경로" mono value={str(p.src)} onChange={(v) => set(i, { src: v })} error={errorAt(`photos.${i}.src`)} />
            <TextField label="대체 텍스트" required value={str(p.alt)} onChange={(v) => set(i, { alt: v })} hint="무엇이 보이는지 한 문장으로" error={errorAt(`photos.${i}.alt`)} />
            <TextField label="설명 (선택)" value={str(p.caption)} onChange={(v) => set(i, { caption: v })} error={errorAt(`photos.${i}.caption`)} />
          </div>
          <RowTools index={i} count={value.length} label={`사진 ${i + 1}`} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <FilePicker label={busy ? "올리는 중…" : "사진 올리기"} accept={IMAGE_ACCEPT} disabled={busy} onFile={add} />
        {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-fg-subtle" />}
      </div>
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-fg-muted"}>
          {notice.text}
        </p>
      )}
    </div>
  );
}

// ── 다운로드 ──

function DownloadItemFields({ prefix, value, onChange, errorAt }: { prefix: string; value: Item; onChange: (v: Item) => void; errorAt: ErrorAt }) {
  const set = (patch: Item) => onChange({ ...value, ...patch });
  const os = Array.isArray(value.os) ? (value.os as string[]) : [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="이름표" required value={str(value.label)} onChange={(v) => set({ label: v })} placeholder="Windows 설치 파일" error={errorAt(`${prefix}.label`)} />
      <TextField label="버전" required value={str(value.version)} onChange={(v) => set({ version: v })} placeholder="1.2.0" error={errorAt(`${prefix}.version`)} />
      <TextField
        label="파일"
        required
        mono
        className="sm:col-span-2"
        value={str(value.file)}
        onChange={(v) => set({ file: v })}
        hint="/files/<slug>/<파일명> (서버의 /opt/johnnystudio/files) 또는 https 주소"
        error={errorAt(`${prefix}.file`)}
      />
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-semibold text-fg">운영체제 (필수)</legend>
        <div className="mt-2 flex flex-wrap gap-5">
          {(Object.keys(OS_LABELS) as Array<keyof typeof OS_LABELS>).map((o) => (
            <CheckboxField key={o} label={OS_LABELS[o]} checked={os.includes(o)} onChange={(c) => set({ os: c ? [...os, o] : os.filter((x) => x !== o) })} />
          ))}
        </div>
        {errorAt(`${prefix}.os`) && <p className="mt-1.5 text-xs text-danger">{errorAt(`${prefix}.os`)}</p>}
      </fieldset>
      <TextField
        label="크기 (바이트)"
        type="number"
        value={str(value.size)}
        onChange={(v) => set({ size: v === "" ? undefined : Number(v) })}
        error={errorAt(`${prefix}.size`)}
      />
      <TextField label="배포일" value={str(value.released)} onChange={(v) => set({ released: v })} placeholder={today()} error={errorAt(`${prefix}.released`)} />
      <TextField label="SHA-256" mono className="sm:col-span-2" value={str(value.sha256)} onChange={(v) => set({ sha256: v })} error={errorAt(`${prefix}.sha256`)} />
      <TextField label="바뀐 점 (선택)" className="sm:col-span-2" value={str(value.notes)} onChange={(v) => set({ notes: v })} error={errorAt(`${prefix}.notes`)} />
      <div className="sm:col-span-2">
        <CheckboxField label="코드 서명함" hint="끄면 상세 화면에 SmartScreen 경고 안내가 붙습니다" checked={value.signed === true} onChange={(c) => set({ signed: c })} />
      </div>
    </div>
  );
}

function UploadResult({ installCommand, savedTo }: { installCommand: string | null; savedTo: string }) {
  return (
    <div role="status" className="rounded-xl border border-line bg-canvas p-4 text-sm">
      <p className="text-fg-muted">
        저장 위치: <code className="break-all font-mono text-xs text-fg">{savedTo}</code>
      </p>
      {installCommand ? (
        <>
          <p className="mt-2 text-fg-muted">운영 서버의 다운로드 폴더에 복사해야 내려받을 수 있습니다:</p>
          <div className="mt-2 flex items-start gap-2">
            <code className="block flex-1 break-all rounded-lg bg-raised px-3 py-2 font-mono text-xs text-fg">{installCommand}</code>
            <CopyButton value={installCommand} label="서버 복사 명령" />
          </div>
        </>
      ) : (
        <p className="mt-2 text-fg-muted">운영 다운로드 폴더에 바로 저장했습니다. 작품을 공개하고 배포하면 내려받을 수 있습니다.</p>
      )}
    </div>
  );
}

function useFileUpload(slug: string) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ installCommand: string | null; savedTo: string } | null>(null);

  async function run(file: File): Promise<Item | null> {
    setError(null);
    setResult(null);
    setProgress(0);
    const r = await adminApi.uploadFile(slug, file, setProgress);
    setProgress(null);
    if (!r.ok) {
      setError(r.error.message);
      return null;
    }
    setResult({ installCommand: r.data.installCommand, savedTo: r.data.savedTo });
    return { ...guessDownload(file.name), file: r.data.file, size: r.data.size, sha256: r.data.sha256, released: r.data.released, signed: false };
  }

  const status = (
    <>
      {progress !== null && (
        <p role="status" className="text-sm text-fg-muted">
          올리는 중… <span className="tabular-nums">{Math.round(progress * 100)}%</span> (크기와 SHA-256 을 함께 계산합니다)
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {result && <UploadResult {...result} />}
    </>
  );
  return { run, busy: progress !== null, status };
}

export function DownloadsField({ slug, value, onChange, errorAt }: { slug: string; value: Item[]; onChange: (v: Item[]) => void; errorAt: ErrorAt }) {
  const upload = useFileUpload(slug);
  return (
    <div className="grid gap-4">
      {value.length === 0 && <p className="text-sm text-fg-subtle">다운로드 파일이 없습니다. 설치 파일을 올리면 크기·SHA-256 이 자동으로 채워집니다.</p>}
      {value.map((d, i) => (
        <div key={i} className="rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-fg">
              {str(d.label) || `다운로드 ${i + 1}`} {str(d.version) && <span className="font-normal text-fg-subtle">v{str(d.version)}</span>}
            </p>
            <RowTools index={i} count={value.length} label={`다운로드 ${i + 1}`} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <DownloadItemFields prefix={`downloads.${i}`} value={d} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} errorAt={errorAt} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <FilePicker
          label={upload.busy ? "올리는 중…" : "설치 파일 올리기"}
          disabled={upload.busy}
          onFile={async (file) => {
            const item = await upload.run(file);
            if (item) onChange([item, ...value]);
          }}
        />
        <button type="button" className={smallButton} onClick={() => onChange([...value, { label: "", file: `/files/${slug}/`, version: "", os: [], signed: false }])}>
          <Plus aria-hidden="true" className="size-3.5" />
          직접 입력
        </button>
      </div>
      {upload.status}
    </div>
  );
}

/** 웹 패키지의 zip 하나 (download) */
export function SingleDownloadField({ slug, value, onChange, errorAt }: { slug: string; value: Item | undefined; onChange: (v: Item | undefined) => void; errorAt: ErrorAt }) {
  const upload = useFileUpload(slug);
  return (
    <div className="grid gap-4">
      {value ? (
        <div className="rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-fg">내려받기 파일</p>
            <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden="true" className="size-4" />
              <span className="sr-only">내려받기 파일 빼기</span>
            </button>
          </div>
          <DownloadItemFields prefix="download" value={value} onChange={onChange} errorAt={errorAt} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <FilePicker
            label={upload.busy ? "올리는 중…" : "zip 올리기"}
            accept=".zip,application/zip"
            disabled={upload.busy}
            onFile={async (file) => {
              const item = await upload.run(file);
              if (item) onChange({ ...item, label: str(item.label) || "웹 패키지 (zip)", os: ["windows", "macos", "linux"] });
            }}
          />
          <button type="button" className={smallButton} onClick={() => onChange({ label: "웹 패키지 (zip)", file: `/files/${slug}/`, version: "", os: ["windows", "macos", "linux"], signed: false })}>
            <Plus aria-hidden="true" className="size-3.5" />
            직접 입력
          </button>
        </div>
      )}
      {upload.status}
    </div>
  );
}

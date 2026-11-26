"use client";

/*
 * Store·Showroom 의 '공식' 항목(= Library 작품, content/assets/<slug>.md) 지우기. 작품 자체가 지워져 Library 에서도 사라진다.
 *
 * - 공식 항목은 DB 가 아니라 저장소의 파일이라 작품 관리 서버(개발 서버 전용, /__admin/, ADR-0009)로만 지운다.
 *   관리 화면의 '삭제'와 같다: 초안으로 돌린 뒤 작품 파일·그림 폴더를 .local/trash 로 옮긴다 (되옮기면 되살아난다).
 *   다운로드 파일(.local/files, /opt/johnnystudio/files)은 건드리지 않는다.
 * - 출시 빌드(NODE_ENV=production)에는 관리 서버가 없으므로 버튼을 그리지 않는다.
 * - 버튼은 Store 운영자(로그인)나 이 탭에 관리 토큰이 있는 사람에게만 보인다. 권한은 관리 서버가 토큰으로 다시 판단한다.
 */
import { KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { adminApi, setAdminToken, useAdminToken } from "@/lib/admin/client";
import { useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { type StoreMe, loadRemote, storeApi, useRemote } from "@/lib/store";

import { buttonClass, cx } from "../ui";
import { dialogClass, inputClass } from "./store-ui";

/** 개발 서버에서만 true. 출시 빌드에서는 상수 false 가 되어 버튼·대화상자가 그려지지 않는다 */
const DEV_BUILD = process.env.NODE_ENV !== "production";

export type OfficialTarget = { slug: string; title: string };

/** 공식 항목 지우기 버튼을 보일까: 개발 서버 + (Store 운영자이거나 이 탭에 관리 토큰이 있음) */
export function useOfficialDelete(): boolean {
  const isClient = useIsClient();
  const session = useSession();
  const signedIn = DEV_BUILD && session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);
  const token = useAdminToken();
  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);
  return DEV_BUILD && isClient && (Boolean(token) || (me?.status === "ready" && me.data.admin));
}

/** 카드 안의 작은 지우기 버튼. z-10: 카드 전체 링크 위에서 따로 눌리게 */
export function OfficialDeleteButton({ target, onClick }: { target: OfficialTarget; onClick: (t: OfficialTarget) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(target)}
      title="작품 지우기 (운영자)"
      className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <Trash2 aria-hidden="true" className="size-4" />
      <span className="sr-only">{target.title} 작품 지우기</span>
    </button>
  );
}

export function OfficialDeleteDialog({ target, where, onClose }: { target: OfficialTarget; where: "Store" | "Showroom"; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const token = useAdminToken();
  const [tokenInput, setTokenInput] = useState("");
  const [askToken, setAskToken] = useState(!token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenId = useId();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function run(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (askToken) {
      if (!tokenInput.trim()) return setError("작품 관리 토큰을 넣어 주세요.");
      setAdminToken(tokenInput);
    }
    setBusy(true);
    setError(null);
    const fail = (message: string, needToken = false) => {
      setBusy(false);
      setError(message);
      if (needToken) {
        setAskToken(true);
        setTokenInput("");
      }
    };

    // 1. 지금 상태: 다른 작품이 가리키고 있으면 지우지 않는다 (관리 화면과 같은 규칙)
    const detail = await adminApi.get(target.slug);
    if (!detail.ok) return fail(detail.httpStatus === 401 ? "작품 관리 토큰이 맞지 않습니다. 다시 넣어 주세요." : detail.error.message, detail.httpStatus === 401);
    if (detail.data.references.length) {
      return fail(
        `다른 곳에서 이 작품을 가리키고 있어 지울 수 없습니다: ${detail.data.references.join(" · ")}. ` +
          "Life Log(content/lifelog.yaml)·서비스 소개(content/profile.yaml)에서 그 연결을 먼저 빼 주세요.",
      );
    }
    // 2. 공개 중이면 초안으로 → 3. 휴지통으로. 지우기에 실패하면 다시 공개해 처음 상태로 돌린다
    const wasPublished = detail.data.data.draft !== true;
    if (wasPublished) {
      const r = await adminApi.unpublish(target.slug);
      if (!r.ok) return fail(r.error.message);
    }
    const removed = await adminApi.remove(target.slug);
    if (!removed.ok) {
      if (wasPublished) await adminApi.publish(target.slug);
      return fail(removed.error.message);
    }
    // 개발 서버가 바뀐 content/ 로 이 화면을 다시 그린다 (카드가 사라진다)
    router.refresh();
    setBusy(false);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="official-delete-title" className={dialogClass}>
      <form onSubmit={run}>
        <h2 id="official-delete-title" className="text-lg font-semibold">
          {target.title} 작품을 지울까요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          JohnnyStudio의 공식 작품이라 {where}만이 아니라 <strong className="font-semibold text-fg">Library에서도 사라집니다</strong>. 작품 파일(
          <code className="font-mono text-xs text-fg">content/assets/{target.slug}.md</code>)과 그림 폴더는 <code className="font-mono text-xs text-fg">.local/trash</code> 로 옮겨지고, 되옮기면 되살릴 수 있습니다.
          다운로드 파일은 그대로 둡니다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">저장소의 파일이 바뀌므로, 출시 사이트에는 커밋하고 배포해야 반영됩니다.</p>
        {askToken && (
          <div className="mt-4 space-y-2">
            <label htmlFor={tokenId} className="flex items-center gap-2 text-sm font-semibold text-fg">
              <KeyRound aria-hidden="true" className="size-4" />
              작품 관리 토큰
            </label>
            <input
              id={tokenId}
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="토큰 붙여 넣기"
              className={cx(inputClass, "h-10 font-mono")}
            />
            <p className="text-xs leading-relaxed text-fg-subtle">
              작품 파일을 고치는 도구라 토큰을 확인합니다. <code className="font-mono">./scripts/dev.sh</code> 터미널의 <code className="font-mono">작품 관리: …/admin/#k=…</code> 주소의 #k= 뒤 값이나{" "}
              <code className="font-mono">.local/admin-token</code> 에 있습니다. 이 탭에만 기억합니다.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            취소
          </button>
          <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "bg-danger text-danger-ink hover:bg-danger/90 disabled:opacity-60")}>
            {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            작품 지우기
          </button>
        </div>
      </form>
    </dialog>
  );
}

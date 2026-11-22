"use client";

/**
 * 작품 관리 화면 (개발 서버 전용, ADR-0009). 목록 ↔ 편집(?edit=<slug>)을 오간다.
 * 데이터는 모두 로컬 관리 서버(/__admin/)에서 온다. 빌드된 HTML 에는 아무것도 없다.
 */
import { KeyRound, LoaderCircle, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { useIsClient } from "@/lib/bookmarks";
import {
  captureTokenFromHash,
  loadAssetDetail,
  refreshAdminState,
  setAdminToken,
  useAdminState,
  useAdminToken,
  useAssetDetail,
} from "@/lib/admin/client";
import { useLocationSearch } from "@/lib/use-location-search";

import { buttonClass, cx } from "../ui";
import { AssetEditor } from "./asset-editor";
import { AssetList } from "./asset-list";
import { inputClass, panelClass, smallButton } from "./controls";
import { CreateAssetButton } from "./create-dialog";

function TokenForm({ reason }: { reason: string }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAdminToken(value);
  };
  return (
    <div className={cx(panelClass, "max-w-2xl")}>
      <p className="flex items-center gap-2 font-semibold text-fg">
        <KeyRound aria-hidden="true" className="size-4" />
        관리 토큰이 필요합니다
      </p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{reason}</p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        <code className="font-mono text-xs text-fg">./scripts/dev.sh</code> 를 띄운 터미널에 찍힌 <code className="font-mono text-xs text-fg">작품 관리: http://…/admin/#k=…</code> 주소로 여세요.
        토큰은 <code className="font-mono text-xs text-fg">.local/admin-token</code> 에도 있습니다.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="admin-token" className="sr-only">
          관리 토큰
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="토큰 붙여 넣기"
          className={cx(inputClass, "h-10 flex-1 font-mono")}
        />
        <button type="submit" className={buttonClass("primary", "sm")}>
          열기
        </button>
      </form>
    </div>
  );
}

export function AdminApp() {
  const isClient = useIsClient();
  const token = useAdminToken();
  const state = useAdminState();
  const detail = useAssetDetail();
  const [search, setSearch] = useLocationSearch();
  const edit = new URLSearchParams(search).get("edit") ?? "";
  const [notice, setNotice] = useState<string | null>(null);

  // 처음 열 때와, 열린 탭에 #k=… 주소를 다시 붙여 넣었을 때 (해시만 바뀌면 페이지가 다시 열리지 않는다)
  useEffect(() => {
    captureTokenFromHash();
    window.addEventListener("hashchange", captureTokenFromHash);
    return () => window.removeEventListener("hashchange", captureTokenFromHash);
  }, []);
  useEffect(() => {
    if (token) void refreshAdminState();
  }, [token]);
  useEffect(() => {
    if (token && edit) void loadAssetDetail(edit);
  }, [token, edit]);

  const go = (slug: string) => {
    setNotice(null);
    setSearch(slug ? `?edit=${encodeURIComponent(slug)}` : "");
    window.scrollTo({ top: 0 });
  };

  if (!isClient) return <p className="text-sm text-fg-subtle">관리 화면을 준비하는 중입니다…</p>;
  if (!token) return <TokenForm reason="이 화면은 작품 파일을 고칩니다. 같은 네트워크의 다른 사람이 고치지 못하도록 토큰을 확인합니다." />;

  const failure = state.status === "error" ? state : detail.status === "error" && edit ? detail : null;
  if (failure?.httpStatus === 401) return <TokenForm reason={failure.error.message} />;

  if (state.status === "error" && failure) {
    return (
      <div role="alert" className={cx(panelClass, "max-w-2xl")}>
        <p className="font-semibold text-fg">{failure.httpStatus === 0 || failure.error.code === "offline" ? "작품 관리 서버에 연결할 수 없습니다" : "목록을 불러오지 못했습니다"}</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{failure.error.message}</p>
        <button type="button" onClick={() => void refreshAdminState()} className={cx(smallButton, "mt-4")}>
          <RefreshCw aria-hidden="true" className="size-3.5" />
          다시 시도
        </button>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-subtle">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        작품 목록을 불러오는 중입니다…
      </p>
    );
  }

  if (edit) {
    if (detail.status === "error") {
      return (
        <div role="alert" className={cx(panelClass, "max-w-2xl")}>
          <p className="font-semibold text-fg">작품을 열 수 없습니다</p>
          <p className="mt-2 text-sm text-fg-muted">{detail.error.message}</p>
          <button type="button" onClick={() => go("")} className={cx(smallButton, "mt-4")}>
            목록으로
          </button>
        </div>
      );
    }
    if (detail.status !== "ready" || detail.data.slug !== edit) {
      return (
        <p className="flex items-center gap-2 text-sm text-fg-subtle">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          불러오는 중입니다…
        </p>
      );
    }
    return (
      <AssetEditor
        // 파일에서 다시 불러오면(mtime 이 바뀌면) 편집기를 새로 연다
        key={`${detail.data.slug}:${detail.data.mtime}`}
        initial={detail.data}
        knownTags={state.data.tags}
        onBack={() => go("")}
        onChanged={() => void refreshAdminState()}
        onDeleted={(message) => {
          void refreshAdminState();
          go("");
          setNotice(message);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">
          여기서 고친 내용은 <code className="font-mono text-xs text-fg">content/assets/</code> 파일로 저장됩니다. 커밋·배포는 지금처럼 합니다:{" "}
          <code className="font-mono text-xs text-fg">./scripts/check.sh</code> → 커밋 → <code className="font-mono text-xs text-fg">./deploy/deploy.sh</code>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void refreshAdminState()} className={buttonClass("ghost", "sm")}>
            <RefreshCw aria-hidden="true" className="size-4" />
            새로 고침
          </button>
          <CreateAssetButton
            existing={state.data.assets.map((a) => a.slug)}
            onCreated={(slug) => {
              void refreshAdminState();
              go(slug);
            }}
          />
        </div>
      </div>
      {notice && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-fg-muted">
          {notice}
        </p>
      )}
      <AssetList state={state.data} onEdit={go} />
    </div>
  );
}

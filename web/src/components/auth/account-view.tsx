"use client";

import { KeyRound, LoaderCircle, LogOut, UserX } from "lucide-react";
import { useRef, useState } from "react";

import { type ApiResult, deleteAccount, loginHref, logout, logoutEverywhere, useSession } from "@/lib/auth";
import { forgetRememberedEmail } from "@/lib/remember-email";

import { ButtonLink, buttonClass, cx } from "../ui";
import { PasswordForm } from "./password-form";

const panel = "rounded-card border border-line bg-surface p-6 sm:p-8";

/** 보는 사람의 시간대로 표시한다 (API 는 UTC 로 준다) */
function localDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

type Busy = null | "logout" | "logout-all" | "delete";

/** 계정 정보, 로그아웃, 회원 탈퇴 */
export function AccountView() {
  const session = useSession();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<ApiResult<undefined>>, done: string) {
    setBusy(kind);
    setError(null);
    const r = await action();
    setBusy(null);
    if (r.ok) {
      dialog.current?.close();
      setNotice(done);
    } else {
      setError(r.message);
    }
  }

  if (session.status === "loading") {
    return <p className="text-sm text-fg-subtle">로그인 상태를 확인하는 중입니다…</p>;
  }

  if (session.status === "unavailable") {
    return (
      <div className={panel}>
        <p className="font-semibold text-fg">회원 서버에 연결할 수 없습니다</p>
        <p className="mt-2 text-sm text-fg-muted">잠시 뒤 다시 시도해 주세요. 즐겨찾기는 이 브라우저에 그대로 있습니다.</p>
      </div>
    );
  }

  if (session.status === "signed-out") {
    return (
      <div role={notice ? "status" : undefined} className={panel}>
        <p className="font-semibold text-fg">{notice ?? "로그인하지 않았습니다"}</p>
        <p className="mt-2 text-sm text-fg-muted">이메일과 비밀번호로 로그인합니다. 처음이면 이메일 인증으로 가입합니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={loginHref("/account/")}>로그인</ButtonLink>
          <ButtonLink href="/signup/" variant="secondary">
            가입하기
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { user } = session;
  return (
    <div className="space-y-6">
      <section aria-labelledby="account-info" className={panel}>
        <h2 id="account-info" className="text-lg font-semibold text-fg">
          계정 정보
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-fg-subtle">이메일</dt>
          <dd className="break-all text-fg">{user.email}</dd>
          <dt className="text-fg-subtle">가입일</dt>
          <dd className="text-fg">{localDate(user.created_at)}</dd>
          <dt className="text-fg-subtle">마지막 로그인</dt>
          <dd className="text-fg">{localDate(user.last_login_at, true)}</dd>
        </dl>
        <p className="mt-5 text-sm text-fg-subtle">로그인은 30일 동안 유지됩니다. 받는 정보는 이메일 주소와 비밀번호(되돌릴 수 없게 변환해 저장)뿐입니다.</p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy !== null} onClick={() => run("logout", logout, "로그아웃했습니다")} className={cx(buttonClass("secondary"), "disabled:opacity-60")}>
            {busy === "logout" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LogOut aria-hidden="true" className="size-4" />}
            로그아웃
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("logout-all", logoutEverywhere, "모든 기기에서 로그아웃했습니다")}
            className={cx(buttonClass("ghost"), "disabled:opacity-60")}
          >
            {busy === "logout-all" && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            모든 기기에서 로그아웃
          </button>
        </div>
      </section>

      <section aria-labelledby="account-password" className={panel}>
        <h2 id="account-password" className="text-lg font-semibold text-fg">
          비밀번호
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {user.has_password
            ? "이메일과 비밀번호로 로그인합니다. 바꾸면 이 기기를 뺀 다른 기기는 모두 로그아웃됩니다."
            : "아직 비밀번호가 없습니다. 정해 두면 메일을 기다리지 않고 이메일과 비밀번호로 로그인할 수 있습니다."}
        </p>
        {passwordNotice && !passwordOpen && (
          <p role="status" className="mt-3 text-sm text-accent">
            {passwordNotice}
          </p>
        )}
        {passwordOpen ? (
          <div className="mt-6">
            <PasswordForm
              email={user.email}
              requireCurrent={user.has_password}
              submitLabel={user.has_password ? "비밀번호 바꾸기" : "비밀번호 저장"}
              onDone={() => {
                setPasswordOpen(false);
                setPasswordNotice(user.has_password ? "비밀번호를 바꿨습니다. 다른 기기는 로그아웃되었습니다." : "비밀번호를 저장했습니다.");
              }}
            />
            <button type="button" onClick={() => setPasswordOpen(false)} className={cx(buttonClass("ghost", "sm"), "mt-3 -ml-3.5")}>
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPasswordNotice(null);
              setPasswordOpen(true);
            }}
            className={cx(buttonClass("secondary"), "mt-5")}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            {user.has_password ? "비밀번호 바꾸기" : "비밀번호 정하기"}
          </button>
        )}
        {user.has_password && (
          <p className="mt-4 text-sm text-fg-subtle">
            현재 비밀번호가 기억나지 않으면 로그아웃한 뒤 로그인 화면의 &lsquo;비밀번호를 잊었나요?&rsquo;로 재설정하세요.
          </p>
        )}
      </section>

      <section aria-labelledby="account-delete" className={panel}>
        <h2 id="account-delete" className="text-lg font-semibold text-fg">
          회원 탈퇴
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          계정과 로그인 기록이 바로 지워지고 되돌릴 수 없습니다. 이 브라우저에 저장된 즐겨찾기는 그대로 남습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            dialog.current?.showModal();
          }}
          className="mt-5 -ml-5 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-danger transition-colors hover:bg-raised"
        >
          <UserX aria-hidden="true" className="size-4" />
          탈퇴하기
        </button>
      </section>

      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line-strong bg-surface p-6 text-fg shadow-2xl shadow-black/60 light:shadow-black/15"
      >
        <h2 id="delete-title" className="text-lg font-semibold">
          정말 탈퇴할까요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">{user.email}</strong> 계정이 바로 삭제됩니다. 같은 주소로 다시 가입할 수는 있지만, 지금의 계정은 되살릴 수 없습니다.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
            취소
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run(
                "delete",
                async () => {
                  const r = await deleteAccount();
                  if (r.ok) forgetRememberedEmail(user.email); // 없어진 계정의 이메일은 기억하지 않는다
                  return r;
                },
                "탈퇴했습니다. 그동안 이용해 주셔서 고맙습니다.",
              )
            }
            className={cx(buttonClass("primary"), "bg-danger text-danger-ink hover:bg-danger/90 disabled:opacity-60")}
          >
            {busy === "delete" && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            탈퇴하기
          </button>
        </div>
      </dialog>
    </div>
  );
}

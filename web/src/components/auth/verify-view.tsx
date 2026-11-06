"use client";

import { CircleCheck, KeyRound, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { needsPasswordStep, parseLinkToken, safeNext, type VerifyResult, verifyLink } from "@/lib/auth";

import { ButtonLink, buttonClass, cx } from "../ui";
import { panelClass } from "./fields";
import { PasswordForm } from "./password-form";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// token: 이 상태를 만든 링크. 같은 탭에서 다른 링크(# 뒤만 다름)를 열면 페이지가 다시 로드되지 않으므로, 토큰이 바뀌면 처음 상태로 본다
type Phase =
  | { kind: "idle" }
  | { kind: "working"; token: string }
  | { kind: "password"; token: string; result: VerifyResult }
  | { kind: "done"; token: string; result: VerifyResult; passwordSet: boolean }
  | { kind: "error"; token: string; message: string };

/**
 * 메일 링크(/login/verify/#t=…)를 연 화면 (ADR-0007, ADR-0008).
 * 1. '계속하기'를 눌러야 링크가 쓰인다 (메일 보안 검사기가 링크를 미리 열어 보더라도 토큰이 쓰이지 않게).
 * 2. 가입·재설정이거나 비밀번호가 없으면 이어서 비밀번호를 정한다. 다음부터는 이메일 + 비밀번호로 로그인한다.
 */
export function VerifyView() {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => null,
  );
  const [state, setPhase] = useState<Phase>({ kind: "idle" });
  const token = hash === null ? null : parseLinkToken(hash);
  // 링크가 쓰이면 주소의 # 부분을 지우므로(hash="") 다음 화면은 남는다. # 뒤가 다른 값으로 바뀌면 새 링크로 다시 시작한다
  const phase: Phase = state.kind !== "idle" && hash && token !== state.token ? { kind: "idle" } : state;

  if (phase.kind === "password") {
    const { result } = phase;
    const title = result.created ? "가입: 비밀번호 정하기" : result.purpose === "reset" ? "새 비밀번호 정하기" : "비밀번호 정하기";
    return (
      <div className={panelClass}>
        <KeyRound aria-hidden="true" className="size-8 text-accent" />
        <h2 className="mt-4 text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">{result.user.email}</strong> 주소를 확인했습니다. 다음부터는 이 이메일과 비밀번호로
          로그인합니다.
        </p>
        <div className="mt-6">
          <PasswordForm
            email={result.user.email}
            requireCurrent={false}
            submitLabel={result.created ? "가입 완료" : "비밀번호 저장"}
            onDone={() => setPhase({ kind: "done", token: phase.token, result, passwordSet: true })}
          />
        </div>
        {!result.created && (
          <button
            type="button"
            onClick={() => setPhase({ kind: "done", token: phase.token, result, passwordSet: false })}
            className={cx(buttonClass("ghost", "sm"), "mt-4 -ml-3.5")}
          >
            비밀번호는 그대로 두고 계속하기
          </button>
        )}
      </div>
    );
  }

  if (phase.kind === "done") {
    const { result, passwordSet } = phase;
    const next = safeNext(result.next);
    const title = result.created ? "가입을 마쳤습니다" : passwordSet ? "비밀번호를 저장했습니다" : "로그인했습니다";
    return (
      <div role="status" className={panelClass}>
        <CircleCheck aria-hidden="true" className="size-8 text-accent" />
        <p className="mt-4 text-lg font-semibold text-fg">{title}</p>
        <p className="mt-2 text-sm text-fg-muted">
          {result.user.email}
          {passwordSet && " · 다음부터는 이메일과 비밀번호로 로그인하세요."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {next ? <ButtonLink href={next}>이어서 보기</ButtonLink> : <ButtonLink href="/studio/">My Studio로</ButtonLink>}
          <ButtonLink href="/account/" variant="secondary">
            계정 보기
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (hash === null) {
    return <p className="text-sm text-fg-subtle">링크를 확인하는 중입니다…</p>;
  }

  if (!token) {
    return (
      <div className={panelClass}>
        <TriangleAlert aria-hidden="true" className="size-8 text-danger" />
        <p className="mt-4 text-lg font-semibold text-fg">링크가 올바르지 않습니다</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">메일의 링크 전체가 주소창에 들어갔는지 확인하거나, 링크를 다시 받아 주세요.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/login/" variant="secondary">
            로그인
          </ButtonLink>
          <ButtonLink href="/signup/" variant="ghost">
            가입 메일 다시 받기
          </ButtonLink>
        </div>
      </div>
    );
  }

  async function onConfirm(t: string) {
    setPhase({ kind: "working", token: t });
    const r = await verifyLink(t);
    if (!r.ok) {
      setPhase({ kind: "error", token: t, message: r.message });
      return;
    }
    setPhase(needsPasswordStep(r.data) ? { kind: "password", token: t, result: r.data } : { kind: "done", token: t, result: r.data, passwordSet: false });
    // 다 쓴 토큰을 주소창·방문 기록에서 지운다
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }

  const working = phase.kind === "working";
  return (
    <div className={panelClass}>
      <p className="text-lg font-semibold text-fg">이 브라우저에서 계속할까요?</p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        아래 버튼을 누르면 이메일 주소가 확인되고 로그인됩니다. 처음이면 이어서 비밀번호를 정합니다. 직접 요청한 링크가 아니라면 이 창을 닫으세요.
      </p>
      {phase.kind === "error" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {phase.message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => onConfirm(token)} disabled={working} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
          {working && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {working ? "확인하는 중…" : "계속하기"}
        </button>
        {phase.kind === "error" && (
          <ButtonLink href="/login/" variant="secondary">
            로그인 화면으로
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

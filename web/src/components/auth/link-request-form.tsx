"use client";

import { LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

import { requestLink, safeNext, useSession } from "@/lib/auth";
import { useRememberedEmail } from "@/lib/remember-email";
import { useLocationSearch } from "@/lib/use-location-search";

import { ButtonLink, buttonClass, cx } from "../ui";
import { FieldLabel, FormError, inputClass, linkClass, panelClass } from "./fields";

type Purpose = "signup" | "reset";

const COPY: Record<Purpose, { button: string; note: string; back: string; backLink: string }> = {
  signup: {
    button: "인증 메일 받기",
    note: "메일의 링크를 열어 주소를 확인한 뒤 비밀번호를 정하면 가입이 끝납니다. 받는 정보는 이메일 주소와 비밀번호뿐이고, 비밀번호는 되돌릴 수 없게 변환해서 저장합니다.",
    back: "이미 계정이 있나요?",
    backLink: "로그인",
  },
  reset: {
    button: "재설정 링크 받기",
    note: "가입한 주소로 링크를 보냅니다. 링크를 열면 새 비밀번호를 정할 수 있고, 비밀번호 없이 그대로 로그인할 수도 있습니다.",
    back: "비밀번호가 기억났나요?",
    backLink: "로그인",
  },
};

type Phase = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string; minutes: number } | { kind: "error"; message: string };

/** 메일 링크 요청: 가입(이메일 인증)과 비밀번호 재설정 */
export function LinkRequestForm({ purpose }: { purpose: Purpose }) {
  const session = useSession();
  const [search] = useLocationSearch();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const remembered = useRememberedEmail();
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  // 비밀번호 재설정은 로그인 화면에서 기억한 이메일을 미리 채운다 (가입 화면은 비워 둔다)
  const email = typedEmail ?? (purpose === "reset" ? remembered : "");
  const emailId = useId();
  const errorId = useId();
  const copy = COPY[purpose];
  const next = safeNext(new URLSearchParams(search).get("next"));
  const loginHref = next ? `/login/?next=${encodeURIComponent(next)}` : "/login/";

  if (session.status === "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">이미 로그인되어 있습니다</p>
        <p className="mt-2 text-sm text-fg-muted">
          {session.user.email}
          {purpose === "reset" && " · 비밀번호는 계정 화면에서 바꿀 수 있습니다."}
        </p>
        <ButtonLink href="/account/" variant="secondary" className="mt-6">
          계정 보기
        </ButtonLink>
      </div>
    );
  }

  if (phase.kind === "sent") {
    return (
      <div role="status" className={panelClass}>
        <MailCheck aria-hidden="true" className="size-8 text-accent" />
        <p className="mt-4 text-lg font-semibold text-fg">메일을 보냈습니다</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">{phase.email}</strong>으로 보낸 링크를 {phase.minutes}분 안에 열고, 화면의{" "}
          <strong className="font-semibold text-fg">계속하기</strong> 버튼을 누르세요.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-fg-subtle">
          <li>메일이 보이지 않으면 스팸함을 확인해 주세요.</li>
          <li>링크는 다른 기기에서 열어도 됩니다. 연 기기에서 이어집니다.</li>
        </ul>
        <button type="button" onClick={() => setPhase({ kind: "idle" })} className={cx(buttonClass("ghost", "sm"), "mt-6 -ml-3.5")}>
          다른 주소로 다시 보내기
        </button>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setPhase({ kind: "sending" });
    const r = await requestLink(value, next, purpose);
    setPhase(r.ok ? { kind: "sent", email: value, minutes: r.data.expires_in_minutes } : { kind: "error", message: r.message });
  }

  const sending = phase.kind === "sending";
  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className={panelClass}>
        <FieldLabel htmlFor={emailId}>이메일</FieldLabel>
        <input
          id={emailId}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setTypedEmail(e.target.value)}
          aria-invalid={phase.kind === "error"}
          aria-describedby={phase.kind === "error" ? errorId : undefined}
          className={cx(inputClass, "mt-2")}
        />
        <FormError id={errorId} message={phase.kind === "error" ? phase.message : null} />
        <button type="submit" disabled={sending} className={cx(buttonClass("primary"), "mt-5 w-full disabled:opacity-60")}>
          {sending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {sending ? "보내는 중…" : copy.button}
        </button>
        <p className="mt-5 text-sm leading-relaxed text-fg-subtle">
          {copy.note}{" "}
          {purpose === "signup" && (
            <Link href="/privacy/" className={linkClass}>
              개인정보처리방침
            </Link>
          )}
        </p>
        {session.status === "unavailable" && (
          <p className="mt-3 text-sm text-fg-subtle">지금은 회원 서버에 연결되지 않습니다. 잠시 뒤 다시 시도해 주세요.</p>
        )}
      </form>
      <p className="text-center text-sm text-fg-muted">
        {copy.back}{" "}
        <Link href={loginHref} className={linkClass}>
          {copy.backLink}
        </Link>
      </p>
    </div>
  );
}

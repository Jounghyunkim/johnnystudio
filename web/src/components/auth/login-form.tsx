"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { loginWithPassword, safeNext, useSession } from "@/lib/auth";
import { updateRememberedEmail, useRememberedEmail } from "@/lib/remember-email";
import { useLocationSearch } from "@/lib/use-location-search";

import { ButtonLink, buttonClass, cx } from "../ui";
import { FieldLabel, FormError, inputClass, linkClass, PasswordInput, panelClass } from "./fields";

/**
 * 이메일 + 비밀번호 로그인. 가입과 비밀번호 재설정은 메일 링크로 한다 (/signup/, /login/reset/)
 * "아이디(이메일) 기억하기": 기억한 이메일은 브라우저에서만 읽으므로(빌드된 HTML 에는 없다),
 * 입력값 = 사용자가 친 값 ?? 기억한 값, 체크 = 사용자가 고른 값 ?? 기억한 이메일이 있는가 로 정한다 (effect 안 setState 없음).
 */
export function LoginForm() {
  const session = useSession();
  const router = useRouter();
  const [search] = useLocationSearch();
  const remembered = useRememberedEmail();
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState<boolean | null>(null);
  const email = typedEmail ?? remembered;
  const remember = rememberChoice ?? remembered !== "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const rememberId = useId();
  const rememberHintId = useId();

  const next = safeNext(new URLSearchParams(search).get("next"));
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  if (session.status === "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">이미 로그인되어 있습니다</p>
        <p className="mt-2 text-sm text-fg-muted">{session.user.email}</p>
        <ButtonLink href={next ?? "/account/"} variant="secondary" className="mt-6">
          {next ? "이어서 보기" : "계정 보기"}
        </ButtonLink>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const r = await loginWithPassword(email.trim(), password);
    if (r.ok) {
      // 로그인에 성공했을 때만 기억하거나 지운다 (틀린 주소를 기억하지 않게). 서버가 정리한 주소(소문자)를 쓴다
      updateRememberedEmail(r.data.user.email, remember);
      router.push(next ?? "/studio/");
      return;
    }
    setBusy(false);
    setError(r.message);
  }

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
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setTypedEmail(e.target.value)}
          className={cx(inputClass, "mt-2")}
        />
        <div className="mt-5 flex items-baseline justify-between gap-4">
          <FieldLabel htmlFor={passwordId}>비밀번호</FieldLabel>
          <Link href={withNext("/login/reset/")} className={cx(linkClass, "text-sm")}>
            비밀번호를 잊었나요?
          </Link>
        </div>
        <PasswordInput
          id={passwordId}
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="mt-2"
        />
        <div className="mt-4 flex items-start gap-3">
          <input
            id={rememberId}
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRememberChoice(e.target.checked)}
            aria-describedby={rememberHintId}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
          />
          <div className="text-sm">
            <label htmlFor={rememberId} className="cursor-pointer text-fg">
              아이디(이메일) 기억하기
            </label>
            <p id={rememberHintId} className="mt-0.5 text-fg-subtle">
              이 브라우저에만 저장하고, 비밀번호는 저장하지 않습니다. 여러 사람이 함께 쓰는 PC에서는 켜지 마세요.
            </p>
          </div>
        </div>
        <FormError id={errorId} message={error} />
        <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "mt-6 w-full disabled:opacity-60")}>
          {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {busy ? "확인하는 중…" : "로그인"}
        </button>
        {session.status === "unavailable" && (
          <p className="mt-3 text-sm text-fg-subtle">지금은 회원 서버에 연결되지 않습니다. 잠시 뒤 다시 시도해 주세요.</p>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-line-strong px-6 py-5 text-sm">
        <p className="text-fg-muted">처음이신가요? 이메일 인증으로 가입합니다.</p>
        <ButtonLink href={withNext("/signup/")} variant="secondary" size="sm">
          가입하기
        </ButtonLink>
      </div>
    </div>
  );
}

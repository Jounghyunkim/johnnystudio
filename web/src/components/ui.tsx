/**
 * 공통 레이아웃·버튼 조각. 서버·클라이언트 어디서나 쓴다.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-page px-4 sm:px-6", className)}>{children}</div>;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

// 글자색은 한 종류에 하나만 둔다. 뒤에 text-… 를 덧붙이면 CSS 순서에 따라 지기도 한다 (ghost + text-danger 가 회색으로 보였다)
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-raised text-fg hover:border-fg-subtle",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg",
  /** 되돌릴 수 없는 동작(지우기)의 여는 버튼. 확인 버튼은 대화상자 안의 bg-danger */
  danger: "text-danger hover:bg-danger/10",
};

export function buttonClass(variant: Variant = "primary", size: "md" | "sm" = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
    size === "md" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-sm",
    VARIANT[variant],
  );
}

/** 사이트 안 링크 */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "sm" }) {
  return <Link {...props} className={cx(buttonClass(variant, size), className)} />;
}

/** 외부 링크: 새 탭, 출처 정보 보내지 않음 */
export function ExternalButton({
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<"a"> & { variant?: Variant; size?: "md" | "sm" }) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer" className={cx(buttonClass(variant, size), className)}>
      {children}
      <span className="sr-only">(새 탭에서 열림)</span>
    </a>
  );
}

/** actions: 머리글 맨 아래(가로줄 위)의 버튼 줄. 있으면 아래 여백을 조금 줄인다 (버튼이 가로줄에서 너무 떠 보이지 않게) */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="hero-glow border-b border-line">
      <Container className={cx("pt-14 sm:pt-20", actions ? "pb-10 sm:pb-14" : "pb-14 sm:pb-20")}>
        {eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide text-accent">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{description}</p>}
        {children}
        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </Container>
    </header>
  );
}

export function SectionHeading({ id, title, description, action }: { id: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-fg-muted sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}

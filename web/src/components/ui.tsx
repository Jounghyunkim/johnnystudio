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

type Variant = "primary" | "secondary" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-raised text-fg hover:border-fg-subtle",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg",
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

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <header className="hero-glow border-b border-line">
      <Container className="py-14 sm:py-20">
        {eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide text-accent">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{description}</p>}
        {children}
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

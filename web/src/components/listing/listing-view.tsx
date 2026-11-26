"use client";

/**
 * 소개 자료 보여 주기 (ADR-0013): Store 앱·Showroom 서비스 상세가 함께 쓴다.
 *
 * 회원이 쓴 글이다. HTML 로 넣지 않고 React 요소로만 그린다 (dangerouslySetInnerHTML 금지).
 * 설명의 Markdown 은 marked 의 lexer 로 토큰만 얻고, 허용한 모양(문단·제목·목록·인용·코드·굵게·기울임·링크)만 그린다.
 * 링크는 https 만, 새 탭 + UGC rel, 주소의 호스트를 함께 보여 준다. 그림 토큰은 설명 글자로만 남긴다 (바깥 그림 금지).
 */
import { Lexer, type Token, type Tokens } from "marked";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { type GalleryImage, type ListingKind, type ListingPage, httpsHost, isEmail, isMsStoreUrl } from "@/lib/listing";
import { UGC_REL } from "@/lib/showroom";

import { MsStoreIcon } from "../ms-store-icon";
import { panelClass } from "../store/store-ui";
import { buttonClass, cx } from "../ui";

// ── 안전한 Markdown ──

function inline(tokens: Token[] | undefined, key = "i"): ReactNode[] {
  return (tokens ?? []).map((t, i) => {
    const k = `${key}-${i}`;
    switch (t.type) {
      case "strong":
        return <strong key={k}>{inline((t as Tokens.Strong).tokens, k)}</strong>;
      case "em":
        return <em key={k}>{inline((t as Tokens.Em).tokens, k)}</em>;
      case "del":
        return <del key={k}>{inline((t as Tokens.Del).tokens, k)}</del>;
      case "codespan":
        return <code key={k}>{(t as Tokens.Codespan).text}</code>;
      case "br":
        return <br key={k} />;
      case "link": {
        const link = t as Tokens.Link;
        const host = httpsHost(link.href);
        const label = inline(link.tokens, k);
        if (!host) return <span key={k}>{label}</span>;
        return (
          <a key={k} href={link.href} target="_blank" rel={UGC_REL}>
            {label}
            <span className="ml-1 text-xs text-fg-subtle">({host})</span>
            <span className="sr-only"> (새 탭에서 열림)</span>
          </a>
        );
      }
      case "image":
        return <span key={k}>{(t as Tokens.Image).text}</span>;
      case "text": {
        const text = t as Tokens.Text;
        return text.tokens ? <span key={k}>{inline(text.tokens, k)}</span> : <span key={k}>{text.text}</span>;
      }
      case "escape":
        return <span key={k}>{(t as Tokens.Escape).text}</span>;
      default:
        return <span key={k}>{"raw" in t ? String(t.raw) : ""}</span>;
    }
  });
}

function blocks(tokens: Token[], key = "b"): ReactNode[] {
  return tokens.map((t, i) => {
    const k = `${key}-${i}`;
    switch (t.type) {
      case "space":
      case "def":
        return null;
      case "heading": {
        const h = t as Tokens.Heading;
        return h.depth <= 3 ? <h3 key={k}>{inline(h.tokens, k)}</h3> : <h4 key={k} className="font-semibold text-fg">{inline(h.tokens, k)}</h4>;
      }
      case "paragraph":
        return <p key={k}>{inline((t as Tokens.Paragraph).tokens, k)}</p>;
      case "list": {
        const list = t as Tokens.List;
        const items = list.items.map((item, j) => <li key={`${k}-${j}`}>{blocks(item.tokens, `${k}-${j}`)}</li>);
        return list.ordered ? (
          <ol key={k} start={typeof list.start === "number" ? list.start : undefined}>
            {items}
          </ol>
        ) : (
          <ul key={k}>{items}</ul>
        );
      }
      case "blockquote":
        return <blockquote key={k}>{blocks((t as Tokens.Blockquote).tokens, k)}</blockquote>;
      case "code":
        return (
          <pre key={k}>
            <code>{(t as Tokens.Code).text}</code>
          </pre>
        );
      case "hr":
        return <hr key={k} className="border-line" />;
      case "table": {
        const table = t as Tokens.Table;
        return (
          <div key={k} className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  {table.header.map((c, j) => (
                    <th key={j}>{inline(c.tokens, `${k}-h${j}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) => (
                      <td key={j}>{inline(c.tokens, `${k}-${r}-${j}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "text": {
        // 목록 항목 안의 글 (tight list)
        const text = t as Tokens.Text;
        return <span key={k}>{text.tokens ? inline(text.tokens, k) : text.text}</span>;
      }
      case "html":
        return <p key={k}>{(t as Tokens.HTML).text}</p>;
      default:
        return <p key={k}>{"raw" in t ? String(t.raw) : ""}</p>;
    }
  });
}

/** 회원이 쓴 설명 (Markdown 일부). 줄바꿈은 그대로 줄바꿈 */
export function SafeMarkdown({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => blocks(Lexer.lex(text, { gfm: true, breaks: true })), [text]);
  return <div className={cx("prose-studio break-words", className)}>{nodes}</div>;
}

// ── 그림 ──

type Shown = GalleryImage & { src: string };

function Lightbox({ images, index, onIndex, title }: { images: Shown[]; index: number | null; onIndex: (i: number | null) => void; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);
  const count = images.length;
  const current = index === null ? undefined : images[index];
  const move = (step: number) => onIndex(index === null ? null : (index + step + count) % count);
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
  };
  const round = "flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-raised";
  return (
    <dialog
      ref={dialog}
      aria-label={`${title} 그림 크게 보기`}
      onClose={() => onIndex(null)}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onIndex(null);
      }}
      className="m-auto max-h-[92dvh] w-[min(92vw,80rem)] bg-transparent p-0 text-fg"
    >
      {current && (
        <figure className="flex flex-col gap-3">
          <img src={current.src} alt={current.caption || `${title} 그림`} className="max-h-[80dvh] w-full rounded-xl object-contain" />
          <figcaption className="flex items-center justify-between gap-4 text-sm text-fg-muted">
            <span>{current.caption}</span>
            <span className="tabular-nums text-fg-subtle">
              {(index ?? 0) + 1} / {count}
            </span>
          </figcaption>
        </figure>
      )}
      <div className="mt-3 flex justify-center gap-2">
        {count > 1 && (
          <button type="button" onClick={() => move(-1)} className={round}>
            <ChevronLeft aria-hidden="true" className="size-5" />
            <span className="sr-only">이전 그림</span>
          </button>
        )}
        <button type="button" onClick={() => onIndex(null)} className={round}>
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">닫기</span>
        </button>
        {count > 1 && (
          <button type="button" onClick={() => move(1)} className={round}>
            <ChevronRight aria-hidden="true" className="size-5" />
            <span className="sr-only">다음 그림</span>
          </button>
        )}
      </div>
    </dialog>
  );
}

function Picture({ image, onOpen, className, sizes = "aspect-[16/10]" }: { image: Shown; onOpen: () => void; className?: string; sizes?: string }) {
  return (
    <figure className={className}>
      <button type="button" onClick={onOpen} className="group block w-full overflow-hidden rounded-xl border border-line bg-canvas focus-visible:outline-2 focus-visible:outline-accent">
        <img
          src={image.src}
          alt={image.caption || "소개 그림"}
          width={image.width || undefined}
          height={image.height || undefined}
          loading="lazy"
          decoding="async"
          className={cx("w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]", sizes)}
        />
        <span className="sr-only">크게 보기</span>
      </button>
      {image.caption && <figcaption className="mt-2 text-sm text-fg-subtle">{image.caption}</figcaption>}
    </figure>
  );
}

// ── 절 ──

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-fg sm:text-xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 연관 검색어 (머리 부분에 작게) */
export function KeywordChips({ keywords }: { keywords: readonly string[] }) {
  if (!keywords.length) return null;
  return (
    <ul aria-label="연관 검색어" className="flex flex-wrap gap-1.5">
      {keywords.map((k) => (
        <li key={k} className="rounded-full bg-raised px-2.5 py-1 text-xs text-fg-muted">
          #{k}
        </li>
      ))}
    </ul>
  );
}

/**
 * 소개 본문: 대표 그림, 추천 대상, 주요 기능, 화면, 사용 방법, 설명, 자주 묻는 질문.
 * lead: 대표 그림 바로 뒤에 넣을 것 (내려받기·서비스 열기 패널)
 */
export function ListingMain({
  page,
  description,
  imageSrc,
  title,
  lead,
  descriptionTitle = "소개",
}: {
  page: ListingPage;
  description: string;
  imageSrc: (id: string) => string;
  title: string;
  lead?: ReactNode;
  descriptionTitle?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const images: Shown[] = page.gallery.map((g) => ({ ...g, src: imageSrc(g.id) }));
  const at = (id: string) => images.findIndex((g) => g.id === id);
  const featureImages = new Set(page.features.map((f) => f.image).filter(Boolean));
  const loose = images.filter((g) => !featureImages.has(g.id));
  const [cover, ...screens] = loose;

  return (
    <div className="space-y-10">
      {cover && <Picture image={cover} onOpen={() => setIndex(at(cover.id))} sizes="aspect-video" />}
      {lead}

      {page.audience.length > 0 && (
        <Section id="listing-audience" title="이런 분께 추천해요">
          <ul className={cx(panelClass, "grid gap-3 sm:grid-cols-2")}>
            {page.audience.map((a) => (
              <li key={a} className="flex items-start gap-2.5 text-fg-muted">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {page.features.length > 0 && (
        <Section id="listing-features" title="주요 기능">
          <ul className="space-y-6">
            {page.features.map((f, i) => {
              const img = f.image ? images[at(f.image)] : undefined;
              return (
                <li key={`${f.title}-${i}`} className={cx(panelClass, img && "grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center")}>
                  <div>
                    <p className="flex items-baseline gap-3">
                      <span aria-hidden="true" className="font-mono text-sm text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-base font-semibold text-fg">{f.title}</span>
                    </p>
                    {f.text && <p className="mt-2 whitespace-pre-line leading-relaxed text-fg-muted">{f.text}</p>}
                  </div>
                  {img && <Picture image={img} onOpen={() => setIndex(at(img.id))} />}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {screens.length > 0 && (
        <Section id="listing-screens" title="화면">
          <ul className="grid gap-5 sm:grid-cols-2">
            {screens.map((g) => (
              <li key={g.id}>
                <Picture image={g} onOpen={() => setIndex(at(g.id))} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {page.steps.length > 0 && (
        <Section id="listing-steps" title="사용 방법">
          <ol className="space-y-3">
            {page.steps.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-start gap-4">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-semibold tabular-nums text-fg">
                  {i + 1}
                </span>
                <span className="pt-1 leading-relaxed text-fg-muted">{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {description && (
        <Section id="listing-about" title={descriptionTitle}>
          <SafeMarkdown text={description} className="text-fg-muted" />
        </Section>
      )}

      {page.faq.length > 0 && (
        <Section id="listing-faq" title="자주 묻는 질문">
          <div className="divide-y divide-line rounded-card border border-line">
            {page.faq.map((x, i) => (
              <details key={`${x.q}-${i}`} className="group px-5 py-4">
                <summary className="cursor-pointer font-semibold text-fg marker:text-fg-subtle">{x.q}</summary>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-fg-muted">{x.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {images.length > 0 && <Lightbox images={images} index={index} onIndex={setIndex} title={title} />}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="mt-1 break-words text-fg-muted">{children}</dd>
    </div>
  );
}

function UgcLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel={UGC_REL} className="break-all text-fg underline-offset-4 hover:text-accent hover:underline">
      {children}
      <span className="sr-only"> (새 탭에서 열림)</span>
    </a>
  );
}

/** Microsoft Store 에서 받기 (회원이 준 주소라 UGC rel) */
export function MsStoreButton({ href, className }: { href: string; className?: string }) {
  if (!isMsStoreUrl(href)) return null;
  return (
    <a href={href} target="_blank" rel={UGC_REL} className={cx(buttonClass("secondary"), className)}>
      <MsStoreIcon />
      Microsoft Store에서 받기
      <span className="sr-only"> (새 탭에서 열림)</span>
    </a>
  );
}

/** 옆 칸의 '한눈에': 가격·만든 이·필요한 환경·지원·관련 링크 */
export function ListingFacts({ page, kind, children }: { page: ListingPage; kind: ListingKind; children?: ReactNode }) {
  const any =
    page.pricing || page.developer || page.license || page.requirements.length || page.recommended.length || page.website || page.support || page.privacy_url || page.links.length || page.copyright || page.ms_store_url;
  if (!any && !children) return null;
  return (
    <div className={panelClass}>
      <p className="text-sm font-semibold text-fg">한눈에</p>
      {page.ms_store_url && <MsStoreButton href={page.ms_store_url} className="mt-3 w-full" />}
      <dl className="mt-3 space-y-4 text-sm">
        {children}
        {page.pricing && <Fact label="가격">{page.pricing}</Fact>}
        {page.developer && <Fact label="개발자">{page.developer}</Fact>}
        {page.license && <Fact label="라이선스">{page.license}</Fact>}
        {page.requirements.length > 0 && (
          <Fact label={page.recommended.length ? "최소 환경" : "필요한 환경"}>
            <ul className="space-y-1">
              {page.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Fact>
        )}
        {page.recommended.length > 0 && (
          <Fact label="권장 환경">
            <ul className="space-y-1">
              {page.recommended.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Fact>
        )}
        {page.website && (
          <Fact label="웹 사이트">
            <UgcLink href={page.website}>{httpsHost(page.website) ?? page.website}</UgcLink>
          </Fact>
        )}
        {page.support && (
          <Fact label="지원">
            {isEmail(page.support) ? (
              <span className="break-all font-mono text-xs">{page.support}</span>
            ) : (
              <UgcLink href={page.support}>{httpsHost(page.support) ?? page.support}</UgcLink>
            )}
          </Fact>
        )}
        {page.privacy_url && (
          <Fact label="개인정보처리방침">
            <UgcLink href={page.privacy_url}>{`${kind === "store" ? "앱" : "서비스"}의 개인정보처리방침 (${httpsHost(page.privacy_url) ?? ""})`}</UgcLink>
          </Fact>
        )}
        {page.links.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">관련 링크</dt>
            <dd className="mt-1">
              <ul className="space-y-2">
                {page.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel={UGC_REL} className="group inline-flex items-start gap-1.5 text-fg hover:text-accent">
                      <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                      <span>
                        {l.label}
                        <span className="block break-all text-xs text-fg-subtle">{httpsHost(l.url) ?? l.url}</span>
                      </span>
                      <ArrowUpRight aria-hidden="true" className="mt-0.5 size-3 shrink-0 opacity-0 group-hover:opacity-100" />
                      <span className="sr-only">(새 탭에서 열림)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      {page.copyright && <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">{page.copyright}</p>}
    </div>
  );
}

"use client";

/**
 * Microsoft Store 제출용 항목 (2026-11-25 사용자 요청): 같은 소개 자료를 Partner Center 의 칸 이름·한도대로 보여 주고 칸마다 복사한다.
 * 글자 수가 넘거나 Microsoft Store 에서 꼭 채워야 하는 칸이 비어 있으면 알린다 (JohnnyStudio 등록은 막지 않는다).
 */
import { TriangleAlert } from "lucide-react";

import type { ListingDraft } from "@/lib/listing-draft";
import { msStoreFields, msStoreText } from "@/lib/listing-msstore";

import { CopyButton } from "../copy-button";
import { MsStoreIcon } from "../ms-store-icon";

export function MsStoreExport({ draft, msCategories, notes }: { draft: ListingDraft; msCategories: Record<string, string>; notes: boolean }) {
  const fields = msStoreFields(draft, msCategories, { notes });
  const problems = fields.reduce((n, f) => n + f.problems.length, 0);
  return (
    <details className="rounded-xl border border-line">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm font-semibold text-fg">
        <MsStoreIcon />
        Microsoft Store 제출용 항목
        <span className="font-normal text-fg-subtle">{problems ? `· 확인할 곳 ${problems}개` : "· 한도 안"}</span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        <p className="text-sm leading-relaxed text-fg-muted">
          Partner Center 의 <strong className="font-semibold text-fg">Store 등록 정보·속성</strong> 칸에 하나씩 붙여 넣습니다. 그림은 소개 자료 zip 의 <code className="font-mono text-xs">images/</code>(스크린샷·1080×1080 아이콘)와{" "}
          <code className="font-mono text-xs">ms/</code>(300×300 타일 아이콘·포스터) PNG 원본을 올립니다. 연령 등급·가격·출시 국가는 Partner Center 에서 따로 정합니다.
        </p>
        <div className="flex justify-end">
          <CopyButton value={msStoreText(fields)} label="Microsoft Store 제출용 항목 전체" />
        </div>
        <dl className="divide-y divide-line">
          {fields.map((f) => (
            <div key={f.en} className="py-3">
              <dt className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg">
                  {f.label} <span className="font-normal text-fg-subtle">({f.en})</span>
                </span>
                {f.value.trim() && <CopyButton value={f.value} label={f.label} />}
              </dt>
              <dd className="mt-1 space-y-1 text-sm">
                {f.value.trim() ? (
                  <p className="line-clamp-3 whitespace-pre-line break-words text-fg-muted">{f.value}</p>
                ) : (
                  <p className="text-fg-subtle">(비어 있음)</p>
                )}
                {f.note && <p className="text-xs text-fg-subtle">{f.note}</p>}
                {f.problems.map((p) => (
                  <p key={p} className="flex items-start gap-1.5 text-xs text-amber-300 light:text-amber-800">
                    <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    {p}
                  </p>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

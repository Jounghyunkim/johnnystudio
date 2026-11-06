import { Download, ShieldAlert, ShieldCheck } from "lucide-react";

import { formatBytes, formatDate } from "@/lib/format";
import { OS_LABELS } from "@/lib/labels";
import type { Download as DownloadInfo } from "@/lib/schema";

import { CopyButton } from "../copy-button";
import { buttonClass, cx } from "../ui";

function fileName(path: string): string {
  return decodeURIComponent(path.split("?")[0]?.split("/").pop() ?? path);
}

/**
 * 다운로드 패널: 버전·OS·크기·SHA-256 과 검증 방법을 보여 준다. (ideation 1-5 Trust by Design, R3)
 */
export function DownloadPanel({ downloads, requirements }: { downloads: readonly DownloadInfo[]; requirements?: string }) {
  if (downloads.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong p-6 text-sm text-fg-muted">
        다운로드 파일을 준비하고 있습니다.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {requirements && (
        <p className="text-sm text-fg-muted">
          <span className="font-semibold text-fg">필요 환경</span> · {requirements}
        </p>
      )}
      {downloads.map((d) => {
        const name = fileName(d.file);
        return (
          <section key={d.file} aria-label={`${d.label} ${d.version}`} className="rounded-card border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-fg">
                  {d.label} <span className="ml-1 font-mono text-sm text-fg-muted">v{d.version}</span>
                </p>
                <p className="mt-1 text-sm text-fg-subtle">
                  {[d.os.map((o) => OS_LABELS[o]).join(" · "), formatBytes(d.size), d.released && `${formatDate(d.released)} 공개`]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
              <a href={d.file} download className={buttonClass("primary")}>
                <Download aria-hidden="true" className="size-4" />
                다운로드
                <span className="sr-only">: {name}</span>
              </a>
            </div>

            {d.notes && <p className="mt-4 text-sm text-fg-muted">{d.notes}</p>}

            {d.sha256 && (
              <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">SHA-256</p>
                  <CopyButton value={d.sha256} label="SHA-256 체크섬" />
                </div>
                <p className="mt-2 break-all font-mono text-xs leading-relaxed text-fg-muted">{d.sha256}</p>
                <details className="group mt-3 text-sm">
                  <summary className="cursor-pointer text-fg-muted hover:text-fg">파일이 맞는지 확인하는 방법</summary>
                  <div className="mt-3 space-y-2 text-fg-muted">
                    <p>내려받은 파일의 값이 위 체크섬과 같으면 변조되지 않은 파일입니다.</p>
                    <pre className="overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-fg">
                      {`# Windows (PowerShell)\nGet-FileHash .\\${name} -Algorithm SHA256\n\n# macOS\nshasum -a 256 ${name}\n\n# Linux\nsha256sum ${name}`}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            <p className={cx("mt-4 flex items-start gap-2 text-xs", d.signed ? "text-emerald-300 light:text-emerald-700" : "text-fg-subtle")}>
              {d.signed ? (
                <>
                  <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0" />
                  코드 서명된 파일입니다.
                </>
              ) : (
                <>
                  <ShieldAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
                  {d.os.includes("windows")
                    ? "코드 서명이 없어서 Windows 가 경고(SmartScreen)를 띄울 수 있습니다. 체크섬으로 파일을 확인하세요."
                    : "코드 서명이 없는 파일입니다. 체크섬으로 파일을 확인하세요."}
                </>
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}

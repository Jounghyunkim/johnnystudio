import { ArrowUpRight, FileText, Globe, Package } from "lucide-react";
import type { ReactNode } from "react";

import { hostOf } from "@/lib/format";

import { ExternalButton } from "../ui";

function Panel({ icon, title, detail, children }: { icon: ReactNode; title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-raised text-fg-muted">{icon}</span>
        <div>
          <p className="font-semibold text-fg">{title}</p>
          {detail && <p className="mt-0.5 break-all text-sm text-fg-subtle">{detail}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Pending({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-dashed border-line-strong p-6 text-sm text-fg-muted">{children}</div>;
}

/** 웹 서비스: 새 탭에서 실행 */
export function LaunchPanel({ url }: { url?: string }) {
  if (!url) return <Pending>서비스 주소를 준비하고 있습니다.</Pending>;
  return (
    <Panel icon={<Globe aria-hidden="true" className="size-5" />} title="웹에서 바로 실행" detail={hostOf(url)}>
      <ExternalButton href={url}>
        실행하기
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalButton>
    </Panel>
  );
}

/** 글: 원문으로 */
export function OutlinkPanel({ url, source }: { url?: string; source?: string }) {
  if (!url) return <Pending>원문 주소를 준비하고 있습니다.</Pending>;
  return (
    <Panel icon={<FileText aria-hidden="true" className="size-5" />} title={source ?? "원문"} detail={hostOf(url)}>
      <ExternalButton href={url}>
        원문 읽기
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalButton>
    </Panel>
  );
}

/**
 * 웹 패키지: 포털과 다른 출처(샌드박스 도메인)에서 격리 실행한다. (ideation R4)
 * sandbox 에 allow-same-origin 을 넣지 않는다. 같이 넣으면 iframe 안의 코드가 격리를 풀 수 있다.
 */
export function SandboxPanel({ playUrl, title }: { playUrl?: string; title: string }) {
  if (!playUrl) {
    return <Pending>샌드박스 체험을 준비하고 있습니다 (Phase 1.5). 아래 파일을 내려받아 직접 열어 볼 수 있습니다.</Pending>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-card border border-line bg-canvas">
        <iframe
          src={playUrl}
          title={`${title} 체험`}
          sandbox="allow-scripts allow-forms allow-pointer-lock"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="aspect-video w-full"
        />
      </div>
      <Panel icon={<Package aria-hidden="true" className="size-5" />} title="격리된 환경에서 실행됩니다" detail={hostOf(playUrl)}>
        <ExternalButton href={playUrl} variant="secondary">
          새 탭에서 열기
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </ExternalButton>
      </Panel>
    </div>
  );
}

import type { Asset } from "@/lib/schema";

import { DownloadPanel, StoreAppPanel } from "./download-panel";
import { LaunchPanel, OutlinkPanel, SandboxPanel } from "./link-panels";
import { PhotoGallery } from "./photo-gallery";
import { YouTubeLite } from "./youtube-lite";

/** 유형별 뷰어: "하나의 스키마, 유형별 뷰어" (ideation §3-1) */
export function AssetViewer({ asset }: { asset: Asset }) {
  switch (asset.type) {
    case "web-app":
      return <LaunchPanel url={asset.url} showroomCode={asset.showroomService} />;
    case "desktop-app":
      // Store DB 로 옮긴 앱은 설치 파일을 Store 에서 받는다 (ADR-0014)
      return asset.storeApp ? (
        <StoreAppPanel code={asset.storeApp} requirements={asset.requirements} microsoftStore={asset.microsoftStore} />
      ) : (
        <DownloadPanel downloads={asset.downloads} requirements={asset.requirements} microsoftStore={asset.microsoftStore} />
      );
    case "web-package":
      return (
        <div className="space-y-6">
          <SandboxPanel playUrl={asset.playUrl} title={asset.title} />
          {asset.download && <DownloadPanel downloads={[asset.download]} />}
        </div>
      );
    case "video":
      return <YouTubeLite id={asset.youtubeId} title={asset.title} />;
    case "gallery":
      return <PhotoGallery photos={asset.photos} title={asset.title} />;
    case "article":
      return <OutlinkPanel url={asset.url} source={asset.source} />;
    case "hardware":
      return (
        <div className="space-y-6">
          {asset.youtubeId && <YouTubeLite id={asset.youtubeId} title={asset.title} />}
          <PhotoGallery photos={asset.photos} title={asset.title} />
        </div>
      );
  }
}

/** 뷰어 위에 붙는 제목 */
export const VIEWER_HEADING: Record<Asset["type"], string> = {
  "web-app": "실행",
  "desktop-app": "다운로드",
  "web-package": "체험과 다운로드",
  video: "영상",
  gallery: "사진",
  article: "원문",
  hardware: "사진과 영상",
};

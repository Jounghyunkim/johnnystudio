/**
 * 유형·상태별 아이콘과 색 포인트. Tailwind 가 클래스를 찾을 수 있도록 클래스 이름은 모두 완전한 문자열로 쓴다.
 * 밝은 테마는 light: 짝을 쓴다: 글자는 같은 계열 700 (흰 바탕에서 4.5:1 이상), 배경·테두리는 한 단계 진하게.
 */
import {
  Clapperboard,
  Cpu,
  FileText,
  Globe,
  Images,
  type LucideIcon,
  MonitorDown,
  Package,
} from "lucide-react";

import type { AssetStatus, AssetType } from "./schema";

interface TypeStyle {
  icon: LucideIcon;
  /** 배지 글자·배경·테두리 */
  badge: string;
  /** 대표 이미지가 없을 때의 배경 */
  placeholder: string;
  /** 아이콘 색 */
  ink: string;
}

export const TYPE_STYLE: Record<AssetType, TypeStyle> = {
  "web-app": {
    icon: Globe,
    badge: "text-sky-300 bg-sky-400/10 ring-sky-400/25 light:text-sky-700 light:bg-sky-500/10 light:ring-sky-600/25",
    placeholder: "from-sky-400/20 via-sky-400/5 to-transparent light:from-sky-500/15 light:via-sky-500/5",
    ink: "text-sky-300 light:text-sky-700",
  },
  "desktop-app": {
    icon: MonitorDown,
    badge: "text-violet-300 bg-violet-400/10 ring-violet-400/25 light:text-violet-700 light:bg-violet-500/10 light:ring-violet-600/25",
    placeholder: "from-violet-400/20 via-violet-400/5 to-transparent light:from-violet-500/15 light:via-violet-500/5",
    ink: "text-violet-300 light:text-violet-700",
  },
  "web-package": {
    icon: Package,
    badge: "text-amber-300 bg-amber-400/10 ring-amber-400/25 light:text-amber-700 light:bg-amber-500/10 light:ring-amber-600/25",
    placeholder: "from-amber-400/20 via-amber-400/5 to-transparent light:from-amber-500/15 light:via-amber-500/5",
    ink: "text-amber-300 light:text-amber-700",
  },
  video: {
    icon: Clapperboard,
    badge: "text-rose-300 bg-rose-400/10 ring-rose-400/25 light:text-rose-700 light:bg-rose-500/10 light:ring-rose-600/25",
    placeholder: "from-rose-400/20 via-rose-400/5 to-transparent light:from-rose-500/15 light:via-rose-500/5",
    ink: "text-rose-300 light:text-rose-700",
  },
  gallery: {
    icon: Images,
    badge: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/25 light:text-emerald-700 light:bg-emerald-500/10 light:ring-emerald-600/25",
    placeholder: "from-emerald-400/20 via-emerald-400/5 to-transparent light:from-emerald-500/15 light:via-emerald-500/5",
    ink: "text-emerald-300 light:text-emerald-700",
  },
  article: {
    icon: FileText,
    badge: "text-zinc-300 bg-zinc-400/10 ring-zinc-400/25 light:text-zinc-700 light:bg-zinc-500/10 light:ring-zinc-600/25",
    placeholder: "from-zinc-400/20 via-zinc-400/5 to-transparent light:from-zinc-500/15 light:via-zinc-500/5",
    ink: "text-zinc-300 light:text-zinc-700",
  },
  hardware: {
    icon: Cpu,
    badge: "text-orange-300 bg-orange-400/10 ring-orange-400/25 light:text-orange-700 light:bg-orange-500/10 light:ring-orange-600/25",
    placeholder: "from-orange-400/20 via-orange-400/5 to-transparent light:from-orange-500/15 light:via-orange-500/5",
    ink: "text-orange-300 light:text-orange-700",
  },
};

export const STATUS_DOT: Record<AssetStatus, string> = {
  live: "bg-emerald-400 light:bg-emerald-500",
  beta: "bg-sky-400 light:bg-sky-500",
  dev: "bg-amber-400 light:bg-amber-500",
  archived: "bg-zinc-500 light:bg-zinc-400",
};

import type { Metadata } from "next";
import Link from "next/link";

import { ListingGuideKit } from "@/components/listing/listing-guide-kit";
import { Container, PageHeader, SectionHeading } from "@/components/ui";
import { LISTING_FIELDS } from "@/lib/listing-fields";
import { BUNDLE_DIR } from "@/lib/listing-prompt";

export const metadata: Metadata = {
  title: "소개 자료 만들기",
  description: "Store 앱·Showroom 서비스의 소개 자료(listing.md + 그림) 항목과 양식, AI 코딩 도구로 만드는 방법. Microsoft Store 등록 항목과 함께 씁니다.",
};

const STEPS = [
  { title: "프롬프트 복사", text: "아래 버튼으로 프롬프트를 복사해, 앱·서비스 저장소를 연 AI 코딩 도구(Claude Code, Gemini CLI 등)에 붙여 넣습니다." },
  { title: "AI가 자료를 만듭니다", text: "코드·문서를 읽고 소개 글을 쓰고, 실제 화면을 캡처하고(웹은 Playwright), 아이콘·대표 그림을 만들어 zip으로 묶습니다." },
  { title: "불러오고 확인", text: "앱 올리기·서비스 등록 화면에서 zip(또는 listing.md)을 불러오면 양식이 채워집니다. 미리보기로 확인하고 고칩니다." },
  { title: "검토 요청 · Microsoft Store", text: "검토를 요청하면 운영자가 확인한 뒤 공개합니다. 같은 자료를 'Microsoft Store 제출용 항목'에서 칸별로 복사해 Partner Center에도 씁니다." },
];

const TREE = `${BUNDLE_DIR}.zip
└── ${BUNDLE_DIR}/          (폴더 없이 맨 위에 두어도 됩니다)
    ├── listing.md          글 (머리말 YAML + ## 절)
    ├── images/             사이트와 Microsoft Store 에 함께 쓰는 PNG
    │   ├── icon.png        1080×1080
    │   ├── cover.png       1920×1080 대표 그림
    │   ├── screen-1.png …  1920×1080 실제 화면
    │   └── feature-1.png … 기능 그림 (선택)
    └── ms/                 Microsoft Store 에만 (사이트는 읽지 않는다, 선택)
        ├── tile-300.png    300×300 앱 타일 아이콘
        └── poster.png      720×1080 포스터`;

export default function ListingGuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Store · Showroom"
        title="소개 자료 만들기"
        description="리뷰 글처럼 읽히는 소개를 AI 코딩 도구로 빠르게 만들고, 한 번 만든 자료를 JohnnyStudio와 Microsoft Store에 함께 씁니다."
      />
      <Container className="space-y-16 py-12">
        <section aria-labelledby="guide-steps">
          <SectionHeading id="guide-steps" title="이렇게 만듭니다" />
          <ol className="grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-card border border-line bg-surface p-5">
                <p className="font-mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 font-semibold text-fg">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <ListingGuideKit />
          </div>
          <p className="mt-4 text-sm text-fg-muted">
            AI 없이 직접 써도 됩니다. 양식(listing.md)을 내려받아 채우거나,{" "}
            <Link href="/store/new/" className="underline underline-offset-4">
              앱 올리기
            </Link>
            ·
            <Link href="/showroom/new/" className="underline underline-offset-4">
              서비스 등록
            </Link>{" "}
            화면의 칸에 바로 적습니다.
          </p>
        </section>

        <section aria-labelledby="guide-fields">
          <SectionHeading id="guide-fields" title="항목" description="Store와 Showroom이 같은 항목을 쓰고, 한도는 Microsoft Store 등록 항목에 맞췄습니다. * 는 꼭 채울 칸입니다." />
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-raised text-xs uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    항목
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    listing.md
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    한도
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Microsoft Store 칸
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LISTING_FIELDS.map((f) => (
                  <tr key={f.label} className="align-top">
                    <th scope="row" className="px-4 py-3 font-semibold text-fg">
                      {f.label}
                      {f.required && <span aria-label="필수"> *</span>}
                      {f.only && <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-xs font-normal text-fg-muted">{f.only === "store" ? "Store" : "Showroom"}</span>}
                    </th>
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">{f.md}</td>
                    <td className="px-4 py-3 text-fg-muted">{f.limit}</td>
                    <td className="px-4 py-3 text-fg-muted">{f.ms ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="guide-files" className="grid gap-8 lg:grid-cols-2">
          {/* min-w-0: 그리드 칸이 긴 줄(pre)만큼 넓어지지 않게 (휴대폰 가로 넘침) */}
          <div className="min-w-0">
            <SectionHeading id="guide-files" title="파일 묶음" />
            <pre className="overflow-x-auto rounded-card border border-line bg-surface p-5 font-mono text-xs leading-relaxed text-fg-muted">{TREE}</pre>
          </div>
          <div className="min-w-0">
            <h2 className="mb-8 text-xl font-bold tracking-tight text-fg sm:text-2xl">지킬 것</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-fg-muted">
              <li>
                <strong className="font-semibold text-fg">사실만 씁니다.</strong> 확인하지 못한 기능·가격·지원 환경은 쓰지 않습니다. AI가 만든 글도 올리는 사람이 책임집니다.
              </li>
              <li>
                <strong className="font-semibold text-fg">화면 그림은 실제 화면</strong>이어야 합니다. 꾸민 그림은 대표 그림에만 씁니다.
              </li>
              <li>
                <strong className="font-semibold text-fg">개인정보·비밀값이 보이지 않게</strong> 예시 데이터로 캡처합니다. 개발자·지원 연락처는 누구나 볼 수 있습니다.
              </li>
              <li>
                그림은 서버가 다시 그려(긴 변 1600px WebP, 아이콘 256px PNG) 냅니다. 원본 PNG는 Microsoft Store 제출용으로 가지고 있으세요.
              </li>
              <li>
                설명에는 문단·소제목·목록·굵게·코드·https 링크만 보입니다. HTML과 바깥 그림은 글자로만 보입니다.
              </li>
              <li>
                공개는 운영자 검토 뒤입니다 (
                <Link href="/store/terms/" className="underline underline-offset-4">
                  Store·Showroom 이용약관
                </Link>
                ). 공개 뒤 글·그림을 고치면 바로 반영되고, Showroom 서비스 주소를 바꾸면 다시 검토합니다.
              </li>
            </ul>
          </div>
        </section>
      </Container>
    </>
  );
}

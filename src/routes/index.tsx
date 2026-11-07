import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Homepage } from "@/components/homepage";
import { buildOrganizationSchema } from "@/lib/seo";
const title = "BiBi Studio — Little things, made to touch your heart";
const description =
  "BiBi Studio sáng tạo sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet lấy cảm hứng từ Việt Nam và những câu chuyện nhỏ.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(buildOrganizationSchema()) }],
  }),
  component: Home,
});

function Home() {
  return (
    <PageShell>
      <Homepage />
    </PageShell>
  );
}

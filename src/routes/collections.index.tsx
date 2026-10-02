import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { Reveal } from "@/components/brand/reveal";
import { ContactBand } from "@/components/contact-cta";
import { collections, productsByCollection, tx } from "@/data/catalogue";

const title = "Bộ sưu tập — BiBi Studio";
const description = "Bảy câu chuyện của BiBi Studio: Khám phá Việt Nam, Món ăn Việt Nam, Áo dài, Thiệp chúc mừng và hơn thế nữa.";

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  return (
    <PageShell>
      <PageIntro eyebrow="Collections" title="Mỗi bộ sưu tập là một chương." lead="Những câu chuyện về nơi chốn, hương vị và khoảnh khắc — kể lại bằng giấy." />
      <section className="mx-auto max-w-[1280px] space-y-24 px-6 pb-28 lg:px-12">
        {collections.map((c, i) => (
          <Reveal key={c.id}>
            <Link to="/collections/$slug" params={{ slug: c.slug }} className={`group grid gap-8 md:grid-cols-2 md:items-center ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div className="overflow-hidden">
                <div className="transition duration-700 ease-out group-hover:scale-[1.04]">
                  {c.image ? <img src={c.image} alt={tx(c.name)} loading="lazy" className="aspect-[5/4] w-full object-cover" /> : <PaperPlaceholder label={tx(c.name)} ratio="5/4" />}
                </div>
              </div>
              <div>
                <span className="font-display text-xl text-kraft">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{tx(c.name)}</h2>
                <p className="mt-1 text-[13px] uppercase tracking-[0.2em] text-muted-foreground">{c.name.en}</p>
                <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">{tx(c.tagline)}</p>
                <p className="eyebrow mt-8 flex items-center gap-2 text-foreground transition group-hover:gap-3">
                  {productsByCollection(c.id).length} sản phẩm · Khám phá <ArrowRight className="size-3.5" />
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </section>
      <ContactBand />
    </PageShell>
  );
}

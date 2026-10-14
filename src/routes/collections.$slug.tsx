import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { CatalogueGrid } from "@/components/catalogue-card";
import { ContactBand } from "@/components/contact-cta";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { Reveal } from "@/components/brand/reveal";
import { SplitWords } from "@/components/brand/motion";
import { collections, getCollectionBySlug, occasions, productsByCollection, productsByOccasion, tx } from "@/data/catalogue";

const chapters: Record<string, { quote?: string; themes?: string[] }> = {
  "explore-vietnam": { themes: ["Nơi chốn", "Phố phường", "Kiến trúc", "Ẩm thực", "Văn hoá", "Đời thường"] },
  motivation: { quote: "Mỗi ngày một trang, mỗi trang một bước nhỏ." },
  "vietnamese-food": { themes: ["Phở", "Bánh mì", "Cà phê"] },
};

export const Route = createFileRoute("/collections/$slug")({
  loader: ({ params }) => {
    const c = getCollectionBySlug(params.slug);
    if (!c) throw notFound();
    return { id: c.id };
  },
  head: ({ loaderData }) => {
    const c = loaderData && collections.find((x) => x.id === loaderData.id);
    if (!c) return { meta: [{ title: "Không tìm thấy — BiBi Studio" }, { name: "robots", content: "noindex" }] };
    const title = `${tx(c.name)} — Bộ sưu tập BiBi Studio`;
    return {
      meta: [
        { title },
        { name: "description", content: tx(c.intro) },
        { property: "og:title", content: title },
        { property: "og:description", content: tx(c.intro) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-[1280px] px-6 py-28 lg:px-12">
        <h1 className="font-display text-5xl">Không tìm thấy bộ sưu tập</h1>
        <Link to="/collections" className="mt-8 inline-block underline underline-offset-8">Xem tất cả bộ sưu tập</Link>
      </div>
    </PageShell>
  ),
  component: CollectionPage,
});

function CollectionPage() {
  const { id } = Route.useLoaderData();
  const c = collections.find((x) => x.id === id)!;
  const ch = chapters[c.slug] ?? {};
  const signature = c.id === "explore-vietnam";
  const idx = collections.indexOf(c);
  const next = collections[(idx + 1) % collections.length];

  return (
    <PageShell>
      <section className={signature ? "relative" : "mx-auto max-w-[1280px] px-6 pt-16 lg:px-12"}>
        <div className={signature ? "grid lg:grid-cols-[5fr_7fr]" : "grid gap-12 md:grid-cols-2 md:items-end"}>
          <div className={signature ? "flex flex-col justify-center px-5 py-14 sm:px-6 sm:py-16 lg:px-12" : ""}>
            <p className="eyebrow animate-rise">Bộ sưu tập · {c.name.en}</p>
            <h1 className="mt-5 font-display text-[3.25rem] leading-[0.98] sm:text-6xl md:text-7xl"><SplitWords text={tx(c.name)} delay={150} /></h1>
            <p className="mt-6 max-w-md font-display text-2xl italic leading-snug text-kraft animate-rise">{tx(c.tagline)}</p>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground animate-rise">{tx(c.intro)}</p>
          </div>
          <div className="overflow-hidden">
            {c.image ? (
              <img src={c.image} alt={tx(c.name)} className={`w-full object-cover animate-settle animate-unveil ${signature ? "h-full min-h-[60vh]" : "aspect-[4/5]"}`} />
            ) : (
              <PaperPlaceholder label={tx(c.name)} />
            )}
          </div>
        </div>
      </section>

      {ch.themes && (
        <section className="mx-auto max-w-[1280px] px-6 py-20 lg:px-12">
          <Reveal className="flex flex-wrap gap-x-10 gap-y-4 border-y border-border py-8">
            {ch.themes.map((t, i) => (
              <span key={t} className="font-display text-2xl md:text-3xl">
                <span className="mr-2 text-sm text-kraft">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </span>
            ))}
          </Reveal>
        </section>
      )}

      {ch.quote && (
        <Reveal as="section" className="mx-auto max-w-4xl px-6 py-24 text-center">
          <blockquote className="font-display text-4xl italic leading-tight md:text-6xl">“{ch.quote}”</blockquote>
        </Reveal>
      )}

      {c.id === "greeting-cards" ? (
        <section className="mx-auto max-w-[1280px] px-6 py-20 lg:px-12">
          <h2 className="eyebrow mb-10 border-b border-border pb-6 text-foreground">Thiệp theo dịp</h2>
          <div className="space-y-16">
            {occasions.map((o, i) => {
              const items = productsByOccasion(o.id);
              return (
                <Reveal key={o.id} delay={Math.min(i, 3) * 80}>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h3 className="font-display text-3xl md:text-4xl">
                      <span className="mr-3 text-sm text-kraft">{String(i + 1).padStart(2, "0")}</span>
                      {tx(o.name)}
                    </h3>
                    {items.length === 0 && (
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sắp ra mắt</span>
                    )}
                  </div>
                  <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{tx(o.note)}</p>
                  {items.length > 0 && (
                    <div className="mt-8">
                      <CatalogueGrid items={items} />
                    </div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-[1280px] px-6 py-20 lg:px-12">
          <h2 className="eyebrow mb-10 border-b border-border pb-6 text-foreground">Sản phẩm trong bộ sưu tập</h2>
          <CatalogueGrid items={productsByCollection(c.id)} />
        </section>
      )}

      <section className="mx-auto max-w-[1280px] px-6 pb-24 lg:px-12">
        <Link to="/collections/$slug" params={{ slug: next.slug }} className="group grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-t border-border pt-10">
          <span className="eyebrow">Chương tiếp theo</span>
          <span className="max-w-[12rem] text-right font-display text-3xl leading-tight transition group-hover:-translate-x-2 sm:max-w-none md:text-5xl">{tx(next.name)} →</span>
        </Link>
      </section>
      <ContactBand />
    </PageShell>
  );
}

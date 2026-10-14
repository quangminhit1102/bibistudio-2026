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
  const count = productsByCollection(c.id).length;
  const live = occasions.filter((o) => productsByOccasion(o.id).length > 0);
  const soon = occasions.filter((o) => productsByOccasion(o.id).length === 0);

  return (
    <PageShell>
      <section className={signature ? "relative" : "mx-auto max-w-[1280px] px-6 pt-16 lg:px-12"}>
        <div className={signature ? "grid lg:grid-cols-[5fr_7fr]" : "grid gap-12 md:grid-cols-2 md:items-end"}>
          <div className={signature ? "flex flex-col justify-center px-5 py-14 sm:px-6 sm:py-16 lg:px-12" : ""}>
            <p className="eyebrow animate-rise">Bộ sưu tập · {c.name.en}</p>
            <h1 className="mt-5 font-display text-[3.25rem] leading-[0.98] sm:text-6xl md:text-7xl"><SplitWords text={tx(c.name)} delay={150} /></h1>
            <p className="mt-6 max-w-md font-display text-2xl italic leading-snug text-kraft animate-rise">{tx(c.tagline)}</p>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground animate-rise">{tx(c.intro)}</p>
            <p className="eyebrow mt-8 animate-rise text-foreground">{count ? `${count} mẫu trong bộ sưu tập` : "Sắp ra mắt"}</p>
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
        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-6 lg:px-12">
          <nav aria-label="Chọn dịp" className="sticky top-0 z-30 -mx-5 mb-12 border-y border-border bg-background/95 px-5 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <ul className="no-scrollbar flex gap-6 overflow-x-auto py-4">
              {occasions.map((o) => {
                const n = productsByOccasion(o.id).length;
                return (
                  <li key={o.id} className="shrink-0">
                    <a href={`#${o.id}`} className={`text-[13px] transition hover:text-foreground ${n ? "text-foreground" : "text-muted-foreground/70"}`}>
                      {tx(o.name)}{n ? <sup className="ml-1 text-[10px] text-kraft">{n}</sup> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-20">
            {live.map((o) => {
              const items = productsByOccasion(o.id);
              return (
                <div key={o.id} id={o.id} className="scroll-mt-24">
                  <Reveal>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h2 className="font-display text-4xl md:text-5xl">{tx(o.name)}</h2>
                      <span className="eyebrow">{items.length} mẫu</span>
                    </div>
                    <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{tx(o.note)}</p>
                  </Reveal>
                  <div className="mt-8"><CatalogueGrid items={items} /></div>
                </div>
              );
            })}
          </div>
          {soon.length > 0 && (
            <Reveal className="mt-20 border-t border-border pt-10">
              <p className="eyebrow">Sắp ra mắt</p>
              <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
                {soon.map((o) => (
                  <li key={o.id} id={o.id} className="scroll-mt-24">
                    <span className="font-display text-2xl text-muted-foreground" title={tx(o.note)}>{tx(o.name)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </section>
      ) : (
        <section className="mx-auto max-w-[1280px] px-6 py-20 lg:px-12">
          <h2 className="eyebrow mb-10 border-b border-border pb-6 text-foreground">Sản phẩm trong bộ sưu tập</h2>
          <CatalogueGrid items={productsByCollection(c.id)} />
        </section>
      )}

      <section className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-6 lg:px-12">
        <Link to="/collections/$slug" params={{ slug: next.slug }} className="group grid items-center gap-6 border-t border-border pt-10 md:grid-cols-[1fr_1.2fr] md:gap-12">
          <div>
            <span className="eyebrow">Chương tiếp theo</span>
            <span className="mt-4 block font-display text-4xl leading-tight transition group-hover:translate-x-2 md:text-6xl">{tx(next.name)} →</span>
            <span className="mt-3 block max-w-sm text-[14px] text-muted-foreground">{tx(next.tagline)}</span>
          </div>
          <div className="overflow-hidden">
            {next.image ? (
              <img src={next.image} alt={tx(next.name)} loading="lazy" className="aspect-[16/9] w-full object-cover transition duration-1000 ease-out group-hover:scale-[1.05]" />
            ) : (
              <PaperPlaceholder label={tx(next.name)} ratio="16/9" />
            )}
          </div>
        </Link>
      </section>
      <ContactBand />
    </PageShell>
  );
}

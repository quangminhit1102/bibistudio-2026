import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Reveal } from "@/components/brand/reveal";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { ContactBand } from "@/components/contact-cta";
import { CatalogueCard } from "@/components/catalogue-card";
import { BrandMark } from "@/components/brand-logo";
import { collections, getAllProducts, productTypes, productsByCollection, tx, type Collection } from "@/data/catalogue";
import { FilmStrip, Parallax, ScrollExpand, SplitWords } from "@/components/brand/motion";
import { buildOrganizationSchema } from "@/lib/seo";
import heroImg from "@/assets/hero-desk.jpg";
import { useEffect, useState } from "react";
import { occasions, productsByOccasion } from "@/data/catalogue";
import { prefersReducedMotion } from "@/components/brand/motion";

type Slide = { src: string; alt: string; label?: string; slug?: string };

function HeroSlides({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion() || slides.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);
  const cur = slides[i];
  return (
    <div className="absolute inset-0 animate-unveil">
      {slides.map((s, k) => (
        <img
          key={s.src}
          src={s.src}
          alt={k === i ? s.alt : ""}
          aria-hidden={k !== i}
          loading={k === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1800ms] ease-out ${k === i ? "scale-100 opacity-100" : "scale-[1.05] opacity-0"}`}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-foreground/45 to-transparent p-5 pt-16 sm:p-6">
        {cur.slug ? (
          <Link to="/collections/$slug" params={{ slug: cur.slug }} className="font-display text-xl italic text-background underline-offset-4 hover:underline sm:text-2xl">
            {cur.label} →
          </Link>
        ) : <span className="font-display text-xl italic text-background sm:text-2xl">{cur.label}</span>}
        <div className="flex gap-2">
          {slides.map((s, k) => (
            <button key={s.src} onClick={() => setI(k)} aria-label={`Ảnh ${k + 1}`} className="grid h-6 place-items-center">
              <span className={`block h-0.5 transition-all duration-500 ${k === i ? "w-8 bg-background" : "w-4 bg-background/50"}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

function CollectionTile({ c, className = "", ratio = "4/5", big = false }: { c: Collection; className?: string; ratio?: string; big?: boolean }) {
  return (
    <Link to="/collections/$slug" params={{ slug: c.slug }} className={`group block ${className}`}>
      <div className="overflow-hidden">
        {c.image ? (
          <img src={c.image} alt={tx(c.name)} loading="lazy" style={{ aspectRatio: ratio }} className="w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="transition duration-700 ease-out group-hover:scale-[1.04]">
            <PaperPlaceholder label={tx(c.name)} ratio={ratio} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <h3 className={`font-display leading-tight text-foreground ${big ? "text-4xl md:text-5xl" : "text-2xl"}`}>{tx(c.name)}</h3>
          <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{tx(c.tagline)}</p>
        </div>
        <span className="eyebrow flex shrink-0 items-center gap-2 text-foreground transition group-hover:gap-3">
          Khám phá <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Home() {
  const [ev, food, motivation, aoDai, cards, flowers, spiral] = collections;
  const evProducts = productsByCollection("explore-vietnam").slice(0, 3);
  const heroSlides: Slide[] = [
    { src: heroImg, alt: "Sổ tay, postcard, bao thư và giấy viết thư BiBi Studio trên bàn gỗ", label: "Bàn giấy của BiBi" },
    ...[motivation, cards, flowers, ev].filter((c) => c.image).map((c) => ({ src: c.image!, alt: tx(c.name), label: tx(c.name), slug: c.slug })),
  ];
  const realLife = getAllProducts().filter((p) => p.images.length > 1).slice(0, 8);
  const featured = getAllProducts().filter((p) => p.featured && p.images.length).slice(0, 10);
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid min-h-[calc(100svh-77px)] lg:grid-cols-[5fr_7fr]">
          <div className="flex flex-col justify-center px-5 py-14 sm:px-6 sm:py-16 lg:px-12">
            <BrandMark className="h-12 w-auto self-start text-kraft animate-rise" />
            <p className="eyebrow mt-8 animate-rise [animation-delay:150ms]">BiBi Studio · Touch your heart</p>
            <h1 className="mt-6 font-display text-[3.35rem] font-normal leading-[0.98] text-foreground sm:text-6xl md:text-7xl">
              <SplitWords text="Little things," delay={300} />
              <br />
              <em className="text-kraft"><SplitWords text="made to touch" delay={460} /></em>
              <br />
              <SplitWords text="your heart." delay={680} />
            </h1>
            <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-muted-foreground animate-rise [animation-delay:500ms]">
              Sổ tay, thiệp và giấy viết thư — những món đồ giấy nhỏ, lấy cảm hứng từ Việt Nam.
            </p>
            <div className="mt-10 flex flex-col items-start gap-6 animate-rise [animation-delay:700ms] sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/collections" className="bg-foreground px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent">
                Khám phá bộ sưu tập
              </Link>
              <Link to="/products" className="text-[12px] font-medium uppercase tracking-[0.22em] underline underline-offset-8 hover:text-accent">
                Xem sản phẩm
              </Link>
            </div>
          </div>
          <Parallax strength={90} className="relative min-h-[50vh]">
            <HeroSlides slides={heroSlides} />
          </Parallax>
        </div>
      </section>

      {/* Brand statement */}
      <section className="mx-auto max-w-[1280px] px-6 py-28 md:py-40 lg:px-12">
        <Reveal className="grid gap-12 md:grid-cols-[7fr_5fr] md:items-end">
          <h2 className="font-display text-5xl uppercase leading-[1] tracking-tight text-foreground md:text-7xl">
            Paper can hold
            <br />a memory.
          </h2>
          <div className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
            <p className="font-display text-2xl italic leading-snug text-foreground">
              Một lời nhắn nhỏ. Một nơi ta nhớ. Một cảm xúc ta muốn giữ.
            </p>
            <p>BiBi Studio tạo nên những món đồ giấy cho khoảnh khắc thường ngày, lấy cảm hứng từ Việt Nam, thiên nhiên và những câu chuyện nhỏ.</p>
          </div>
        </Reveal>
      </section>

      {/* Collections */}
      <section className="mx-auto max-w-[1280px] px-6 pb-28 lg:px-12">
        <Reveal className="mb-12 flex items-end justify-between border-b border-border pb-6">
          <h2 className="eyebrow text-foreground">Explore Collections</h2>
          <Link to="/collections" className="eyebrow flex items-center gap-2 hover:text-foreground">Tất cả <ArrowRight className="size-3.5" /></Link>
        </Reveal>
        <ScrollExpand><CollectionTile c={ev} ratio="16/9" big /></ScrollExpand>
        <div className="mt-16 grid gap-x-8 gap-y-16 md:grid-cols-12">
          <Reveal className="md:col-span-7"><CollectionTile c={food} ratio="5/4" /></Reveal>
          <Reveal className="md:col-span-5 md:mt-24" delay={120}><CollectionTile c={aoDai} ratio="4/5" /></Reveal>
          <Reveal className="md:col-span-5"><CollectionTile c={motivation} ratio="4/5" /></Reveal>
          <Reveal className="md:col-span-7 md:mt-16" delay={120}><CollectionTile c={flowers} ratio="5/4" /></Reveal>
          <Reveal className="md:col-span-6"><CollectionTile c={cards} ratio="3/2" /></Reveal>
          <Reveal className="md:col-span-6" delay={120}><CollectionTile c={spiral} ratio="3/2" /></Reveal>
        </div>
      </section>

      {/* Featured film strip */}
      <section className="border-y border-border bg-secondary/40 py-20 lg:py-0">
        <FilmStrip
          header={
            <div className="mx-auto mb-10 flex w-full max-w-[1280px] items-end justify-between gap-6 px-5 sm:px-6 lg:px-12">
              <div>
                <p className="eyebrow">Mẫu nổi bật</p>
                <h2 className="mt-3 font-display text-4xl leading-none md:text-6xl">Trên bàn của BiBi</h2>
              </div>
              <Link to="/products" className="eyebrow flex shrink-0 items-center gap-2 hover:text-foreground">Tất cả <ArrowRight className="size-3.5" /></Link>
            </div>
          }
        >
          {featured.map((p, i) => (
            <div key={p.slug} className="w-[68vw] shrink-0 snap-start sm:w-[42vw] lg:w-[24vw]">
              <CatalogueCard product={p} index={i} />
            </div>
          ))}
        </FilmStrip>
      </section>

      {/* What we make */}
      <section className="bg-secondary/60">
        <div className="mx-auto max-w-[1280px] px-6 py-28 lg:px-12">
          <Reveal className="mb-14 grid gap-6 md:grid-cols-2 md:items-end">
            <h2 className="font-display text-5xl leading-none md:text-6xl">What we make</h2>
            <p className="max-w-md text-[15px] text-muted-foreground">Sáu dòng sản phẩm giấy, mỗi dòng là một cách để lưu giữ khoảnh khắc.</p>
          </Reveal>
          <ol className="divide-y divide-border border-y border-border">
            {productTypes.map((t, i) => (
              <li key={t.id}>
                <Link to="/products/$slug" params={{ slug: t.slug }} className="group grid grid-cols-[3rem_1fr_auto] items-center gap-6 py-7 md:grid-cols-[5rem_1fr_1fr_auto]">
                  <span className="font-display text-xl text-kraft">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display text-3xl transition group-hover:translate-x-2 md:text-4xl">{tx(t.name)}</span>
                  <span className="hidden text-[14px] text-muted-foreground md:block">{tx(t.tagline)}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured story */}
      <section className="mx-auto max-w-[1280px] px-6 py-28 lg:px-12">
        <Reveal className="grid gap-12 md:grid-cols-2 md:items-center">
          <Parallax strength={60} className="aspect-[4/5] w-full"><img src={ev.image} alt={tx(ev.name)} loading="lazy" className="h-full w-full object-cover" /></Parallax>
          <div>
            <p className="eyebrow">Câu chuyện nổi bật</p>
            <h2 className="mt-5 font-display text-5xl leading-[1.02] md:text-6xl">Việt Nam,<br /><em className="text-kraft">qua từng trang giấy.</em></h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">{tx(ev.intro)}</p>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {evProducts.map((p, i) => <CatalogueCard key={p.slug} product={p} index={i} />)}
            </div>
            <Link to="/collections/$slug" params={{ slug: ev.slug }} className="mt-10 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.22em] underline underline-offset-8">
              Khám phá Việt Nam <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Gifts by occasion */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 sm:px-6 lg:px-12">
        <Reveal className="mb-10 grid gap-4 md:grid-cols-2 md:items-end">
          <div>
            <p className="eyebrow">Gợi ý quà</p>
            <h2 className="mt-3 font-display text-4xl leading-none md:text-6xl">Một tấm thiệp cho mỗi dịp</h2>
          </div>
          <p className="max-w-md text-[15px] text-muted-foreground md:justify-self-end">Chọn dịp bạn đang chuẩn bị — BiBi gợi ý những mẫu thiệp hợp nhất.</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {occasions.map((o, i) => {
            const n = productsByOccasion(o.id).length;
            return (
              <Reveal key={o.id} variant="paper" delay={(i % 4) * 80}>
                <Link
                  to="/collections/$slug"
                  params={{ slug: "greeting-cards" }}
                  hash={o.id}
                  className={`group flex h-full min-h-32 flex-col justify-between border border-border p-4 transition duration-500 hover:-translate-y-1 hover:shadow-paper sm:p-5 ${n ? "bg-card" : "bg-transparent"}`}
                >
                  <span className="font-display text-sm text-kraft">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block font-display text-2xl leading-tight">{tx(o.name)}</span>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{n ? `${n} mẫu` : "Sắp ra mắt"}</span>
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Real life photos */}
      {realLife.length > 0 && (
        <section className="bg-foreground py-24 text-background">
          <Reveal className="mx-auto mb-10 max-w-[1280px] px-5 sm:px-6 lg:px-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-background/60">Ngoài đời thật</p>
            <h2 className="mt-3 font-display text-4xl leading-none md:text-6xl">Chụp tay, trên bàn của BiBi.</h2>
          </Reveal>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:px-6 lg:px-12">
            {realLife.map((p, i) => (
              <Reveal key={p.slug} variant="paper" delay={(i % 4) * 90} className="w-[70vw] shrink-0 snap-start sm:w-[38vw] lg:w-[22vw]">
                <Link to="/products/$slug" params={{ slug: p.slug }} className="group block overflow-hidden">
                  <img src={p.images[1]} alt={`${tx(p.name)} — ảnh chụp thật`} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-1000 ease-out group-hover:scale-[1.05]" />
                  <span className="mt-3 block font-display text-xl">{tx(p.name)}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section className="border-t border-border">
        <Reveal className="mx-auto max-w-3xl px-6 py-28 text-center">
          <p className="eyebrow">Về BiBi Studio</p>
          <p className="mt-6 font-display text-3xl leading-snug md:text-4xl">
            Một studio nhỏ làm đồ giấy — nơi mỗi sản phẩm bắt đầu từ một câu chuyện, một nơi chốn, hay một cảm xúc muốn được giữ lại.
          </p>
          <Link to="/about" className="mt-10 inline-block text-[12px] font-medium uppercase tracking-[0.22em] underline underline-offset-8">Đọc thêm</Link>
        </Reveal>
      </section>

      <ContactBand />
    </PageShell>
  );
}

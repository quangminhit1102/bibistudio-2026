import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { CatalogueGrid } from "@/components/catalogue-card";
import { ContactBand } from "@/components/contact-cta";
import { collections, getAllProducts, productTypes, tx, type CollectionId, type ProductTypeId } from "@/data/catalogue";

const title = "Sản phẩm — BiBi Studio";
const description = "Danh mục sản phẩm BiBi Studio: sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet.";
const PAGE = 12;

export const Route = createFileRoute("/products/")({
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
  component: ProductsPage,
});

type Sort = "newest" | "collection" | "name";
const sorts: { id: Sort; label: string }[] = [
  { id: "newest", label: "Mới nhất" },
  { id: "collection", label: "Theo bộ sưu tập" },
  { id: "name", label: "Tên A–Z" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 whitespace-nowrap border-b px-0.5 py-2 text-[13px] transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function ProductsPage() {
  const [type, setType] = useState<ProductTypeId | "all">("all");
  const [col, setCol] = useState<CollectionId | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const all = getAllProducts();
    const list = all.filter(
      (p) =>
        (type === "all" || p.productType === type) &&
        (col === "all" || p.collection === col) &&
        (!q || `${p.name.vi} ${p.name.en}`.toLowerCase().includes(q.toLowerCase())),
    );
    if (sort === "newest") return [...list].reverse();
    if (sort === "name") return [...list].sort((a, b) => tx(a.name).localeCompare(tx(b.name), "vi"));
    const order = collections.map((c) => c.id);
    return [...list].sort((a, b) => order.indexOf(a.collection) - order.indexOf(b.collection));
  }, [type, col, q, sort]);

  useEffect(() => setLimit(PAGE), [type, col, q, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, limit]);

  const activeCount = (type !== "all" ? 1 : 0) + (col !== "all" ? 1 : 0) + (q ? 1 : 0);
  const clear = () => { setType("all"); setCol("all"); setQ(""); };

  const filters = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="eyebrow w-full pb-1 sm:w-28">Loại</span>
        <Pill active={type === "all"} onClick={() => setType("all")}>Tất cả</Pill>
        {productTypes.map((t) => (
          <Pill key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{tx(t.name)}</Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="eyebrow w-full pb-1 sm:w-28">Bộ sưu tập</span>
        <Pill active={col === "all"} onClick={() => setCol("all")}>Tất cả</Pill>
        {collections.map((c) => (
          <Pill key={c.id} active={col === c.id} onClick={() => setCol(c.id)}>{tx(c.name)}</Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="eyebrow w-full pb-1 sm:w-28">Sắp xếp</span>
        {sorts.map((s) => (
          <Pill key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Pill>
        ))}
      </div>
    </div>
  );

  return (
    <PageShell>
      <PageIntro eyebrow="Catalogue" title="Sản phẩm" lead="Khám phá các sản phẩm giấy của BiBi Studio theo loại sản phẩm hoặc theo bộ sưu tập." />
      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-12">
        <div className="border-y border-border py-6">
          <div className="hidden md:block">{filters}</div>
          <div className="flex items-center gap-4">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên sản phẩm…"
              aria-label="Tìm sản phẩm"
              className="min-w-0 flex-1 border-b border-border bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground md:mt-5 md:max-w-sm md:flex-none md:w-full"
            />
            <button
              onClick={() => setSheet(true)}
              className="flex min-h-10 shrink-0 items-center gap-2 border border-border px-4 text-[12px] font-medium uppercase tracking-[0.16em] md:hidden"
            >
              <SlidersHorizontal className="size-4" /> Lọc{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 py-8">
          <p className="eyebrow">
            Đang xem {Math.min(limit, items.length)} / {items.length} sản phẩm
          </p>
          {activeCount > 0 && (
            <button onClick={clear} className="flex items-center gap-1.5 text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
              <X className="size-3.5" /> Xóa lọc
            </button>
          )}
        </div>
        <div className="pb-28">
          <CatalogueGrid items={items.slice(0, limit)} />
          {limit < items.length && <div ref={sentinel} className="h-10" aria-hidden />}
        </div>
      </section>

      {sheet && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Bộ lọc">
          <button className="absolute inset-0 bg-foreground/30 animate-in fade-in" aria-label="Đóng bộ lọc" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="mb-6 flex items-center justify-between">
              <p className="font-display text-2xl">Bộ lọc</p>
              <button onClick={() => setSheet(false)} aria-label="Đóng" className="grid size-10 place-items-center"><X className="size-5" /></button>
            </div>
            {filters}
            <div className="mt-8 flex gap-3">
              <button onClick={clear} className="min-h-12 flex-1 border border-border text-[12px] uppercase tracking-[0.16em]">Xóa lọc</button>
              <button onClick={() => setSheet(false)} className="min-h-12 flex-[2] bg-foreground text-[12px] uppercase tracking-[0.16em] text-background">
                Xem {items.length} sản phẩm
              </button>
            </div>
          </div>
        </div>
      )}
      <ContactBand />
    </PageShell>
  );
}

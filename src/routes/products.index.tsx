import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { CatalogueGrid } from "@/components/catalogue-card";
import { ContactBand } from "@/components/contact-cta";
import { collections, getAllProducts, productTypes, tx, type CollectionId, type ProductTypeId } from "@/data/catalogue";

const title = "Sản phẩm — BiBi Studio";
const description = "Danh mục sản phẩm BiBi Studio: sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet.";

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
  const items = useMemo(
    () =>
      getAllProducts().filter(
        (p) =>
          (type === "all" || p.productType === type) &&
          (col === "all" || p.collection === col) &&
          (!q || `${p.name.vi} ${p.name.en}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [type, col, q],
  );
  return (
    <PageShell>
      <PageIntro eyebrow="Catalogue" title="Sản phẩm" lead="Khám phá các sản phẩm giấy của BiBi Studio theo loại sản phẩm hoặc theo bộ sưu tập." />
      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-12">
        <div className="space-y-5 border-y border-border py-6">
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
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên sản phẩm…"
            aria-label="Tìm sản phẩm"
            className="w-full max-w-sm border-b border-border bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>
        <p className="eyebrow py-8">{items.length} sản phẩm</p>
        <div className="pb-28"><CatalogueGrid items={items} /></div>
      </section>
      <ContactBand />
    </PageShell>
  );
}

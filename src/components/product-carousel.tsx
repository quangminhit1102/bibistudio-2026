import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./product-card";
import type { Section } from "@/data/products";

export function ProductCarousel({ section }: { section: Section }) {
  const track = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-10">
      <div className="mb-6 text-center">
        <h2 className="section-title text-2xl md:text-[28px]">
          <a href={`https://sthm.vn/${section.slug}`} className="transition hover:text-accent">
            {section.title}
          </a>
        </h2>
        {section.blurb && (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{section.blurb}</p>
        )}
        <span className="mx-auto mt-4 block h-px w-16 bg-accent" />
      </div>

      <div className="relative">
        <div
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
        >
          {section.products.map((p) => (
            <div
              key={`${section.slug}-${p.handle}`}
              className="w-[calc(50%-10px)] shrink-0 snap-start sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)]"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll(-1)}
          aria-label="Sản phẩm trước"
          className="absolute -left-3 top-[35%] hidden size-9 items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:bg-accent hover:text-accent-foreground lg:flex"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Sản phẩm sau"
          className="absolute -right-3 top-[35%] hidden size-9 items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:bg-accent hover:text-accent-foreground lg:flex"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}

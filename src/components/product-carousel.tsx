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
    <section className="mx-auto max-w-[1280px] px-4 py-10 lg:px-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground md:text-[22px]">
            {section.title}
          </h2>
          {section.blurb && (
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{section.blurb}</p>
          )}
        </div>
        <a
          href={`https://sthm.vn/${section.slug}`}
          className="shrink-0 text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
        >
          Xem Thêm
        </a>
      </div>

      <div className="relative">
        <div
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
        >
          {section.products.map((p) => (
            <div
              key={`${section.slug}-${p.handle}`}
              className="w-[calc(50%-10px)] shrink-0 snap-start sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)] xl:w-[calc(16.666%-17px)]"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll(-1)}
          aria-label="Sản phẩm trước"
          className="absolute -left-9 top-[32%] hidden size-9 items-center justify-center text-muted-foreground transition hover:text-primary lg:flex"
        >
          <ChevronLeft className="size-7" strokeWidth={1.25} />
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Sản phẩm sau"
          className="absolute -right-9 top-[32%] hidden size-9 items-center justify-center text-muted-foreground transition hover:text-primary lg:flex"
        >
          <ChevronRight className="size-7" strokeWidth={1.25} />
        </button>
      </div>
    </section>
  );
}

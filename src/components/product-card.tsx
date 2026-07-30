import { Eye, Settings2 } from "lucide-react";
import type { Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex h-full flex-col">
      <div className="relative overflow-hidden border border-border bg-background">
        <a href={`https://sthm.vn/${product.handle}`} title={product.name}>
          <img
            src={product.img}
            alt={product.name}
            loading="lazy"
            className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </a>

        {product.badge && (
          <span
            className={`absolute left-0 top-3 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground ${
              product.badge.toLowerCase() === "new" ? "bg-primary" : "bg-accent"
            }`}
          >
            {product.badge}
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-0 transition duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
          <a
            href={`https://sthm.vn/${product.handle}`}
            title="Xem nhanh"
            className="flex size-9 items-center justify-center rounded-full bg-background text-primary shadow-md transition hover:bg-accent hover:text-accent-foreground"
          >
            <Eye className="size-4" />
          </a>
          <a
            href={`https://sthm.vn/${product.handle}`}
            title="Tùy chọn"
            className="flex size-9 items-center justify-center rounded-full bg-background text-primary shadow-md transition hover:bg-accent hover:text-accent-foreground"
          >
            <Settings2 className="size-4" />
          </a>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <h3 className="line-clamp-2 text-sm leading-snug">
          <a
            href={`https://sthm.vn/${product.handle}`}
            className="transition hover:text-accent"
            title={product.name}
          >
            {product.name}
          </a>
        </h3>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-[15px] font-semibold text-accent">{product.price}</span>
          {product.old && (
            <span className="text-xs text-muted-foreground line-through">{product.old}</span>
          )}
        </div>
      </div>
    </article>
  );
}

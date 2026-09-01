import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Product } from "@/data/products";
import { LazyImage } from "@/components/ui/lazy-image";

export function ProductCard({ product }: { product: Product }) {
  const isNew = product.badge?.toLowerCase() === "new";
  const badgeLabel = product.badge ? (isNew ? "MỚI" : product.badge) : null;

  return (
    <article className="group flex h-full flex-col">
      <div className="relative overflow-hidden bg-secondary">
        <Link to="/products/$handle" params={{ handle: product.handle }} title={product.name}>
          <LazyImage
            src={product.img}
            alt={product.name}
            className="transition duration-500 group-hover:scale-[1.04]"
          />
        </Link>

        {badgeLabel && (
          <span
            className={`absolute left-0 top-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground ${
              isNew ? "bg-primary" : "bg-accent"
            }`}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] text-muted-foreground">
          <Link
            to="/products/$handle"
            params={{ handle: product.handle }}
            className="transition hover:text-primary"
            title={product.name}
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-bold text-accent">{product.price}</span>
            {product.old && (
              <span className="text-[11px] text-muted-foreground line-through">{product.old}</span>
            )}
          </div>
          <button
            type="button"
            aria-label="Thêm vào yêu thích"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition hover:bg-accent hover:text-accent-foreground"
          >
            <Heart className="size-4" />
          </button>
        </div>

        <Link
          to="/products/$handle"
          params={{ handle: product.handle }}
          className="mt-3 block border border-border py-2 text-center text-[13px] font-medium text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          Mua Hàng
        </Link>
      </div>
    </article>
  );
}

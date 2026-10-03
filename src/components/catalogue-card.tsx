import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type Product, getCollection, getProductType, tx } from "@/data/catalogue";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";

export function CatalogueCard({ product }: { product: Product }) {
  const type = getProductType(product.productType);
  const col = getCollection(product.collection);
  return (
    <Link
      to="/products/$slug"
      params={{ slug: product.slug }}
      className="group block"
      aria-label={`${tx(product.name)} — ${tx(type.name)}`}
    >
      <div className="overflow-hidden bg-secondary">
        <div className="transition duration-700 ease-out group-hover:scale-[1.04]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.imageAlt ? tx(product.imageAlt) : tx(product.name)}
              loading="lazy"
              className="aspect-[4/5] w-full object-contain"
            />
          ) : (
            <PaperPlaceholder label={tx(type.name)} />
          )}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 pt-3 sm:gap-3 sm:pt-4">
        <div className="min-w-0">
          <p className="eyebrow">{tx(type.name)}</p>
          <h3 className="mt-1.5 font-display text-lg leading-tight text-foreground sm:text-xl">
            {tx(product.name)}
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{tx(col.name)}</p>
        </div>
        <ArrowRight className="mt-6 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

export function CatalogueGrid({ items }: { items: Product[] }) {
  if (items.length === 0)
    return (
      <p className="py-24 text-center font-display text-2xl italic text-muted-foreground">
        Chưa có sản phẩm nào ở đây — sắp ra mắt.
      </p>
    );
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 sm:gap-y-12 md:gap-x-8 lg:grid-cols-3">
      {items.map((p) => (
        <CatalogueCard key={p.slug} product={p} />
      ))}
    </div>
  );
}

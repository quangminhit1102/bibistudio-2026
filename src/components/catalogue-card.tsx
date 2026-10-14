import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type Product, getCollection, getProductType, tx } from "@/data/catalogue";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { Reveal } from "@/components/brand/reveal";
import { Tilt } from "@/components/brand/motion";

export const productTransitionName = (slug: string) => `product-${slug}`;

export function CatalogueCard({ product, index = 0 }: { product: Product; index?: number }) {
  const type = getProductType(product.productType);
  const col = getCollection(product.collection);
  const [main, alt] = product.images;
  return (
    <Reveal variant="paper" delay={(index % 3) * 110}>
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        viewTransition
        className="group block"
        aria-label={`${tx(product.name)} — ${tx(type.name)}`}
      >
        <Tilt>
          <div className="relative overflow-hidden bg-secondary shadow-paper-soft transition-shadow duration-500 group-hover:shadow-paper">
            {main ? (
              <>
                <img
                  src={main}
                  alt={product.imageAlt ? tx(product.imageAlt) : tx(product.name)}
                  loading="lazy"
                  style={{ viewTransitionName: productTransitionName(product.slug) }}
                  className={`aspect-[4/5] w-full object-contain transition duration-700 ease-out group-hover:scale-[1.04] ${alt ? "group-hover:opacity-0" : ""}`}
                />
                {alt && (
                  <img
                    src={alt}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-[1.06] object-cover opacity-0 transition duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
                  />
                )}
              </>
            ) : (
              <PaperPlaceholder label={tx(type.name)} />
            )}
            {product.featured && (
              <span className="absolute left-2.5 top-2.5 bg-background/90 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-foreground backdrop-blur sm:left-3 sm:top-3">
                Nổi bật
              </span>
            )}
            <span aria-hidden className="tilt-glare pointer-events-none absolute inset-0" />
          </div>
        </Tilt>
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
    </Reveal>
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
      {items.map((p, i) => (
        <CatalogueCard key={p.slug} product={p} index={i} />
      ))}
    </div>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell, PageIntro } from "@/components/page-shell";
import { CatalogueCard, CatalogueGrid, productTransitionName } from "@/components/catalogue-card";
import { ProductGallery, Slider } from "@/components/product-gallery";
import { ProductContactBar } from "@/components/product-contact-bar";
import { ContactBand, ContactLinks } from "@/components/contact-cta";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import {
  getCollection,
  getProduct,
  getProductType,
  getProductTypeBySlug,
  productsByType,
  relatedProducts,
  tx,
} from "@/data/catalogue";
import { SITE_URL, buildBreadcrumbSchema } from "@/lib/seo";

// /products/<type-slug> → listing by product type; /products/<product-slug> → product detail.
export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }) => {
    const type = getProductTypeBySlug(params.slug);
    if (type) return { kind: "type" as const, typeId: type.id };
    const product = getProduct(params.slug);
    if (product) return { kind: "product" as const, slug: product.slug };
    throw notFound();
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Không tìm thấy — BiBi Studio" }, { name: "robots", content: "noindex" }] };
    let title: string, description: string;
    const scripts: { type: string; children: string }[] = [];
    if (loaderData.kind === "type") {
      const t = getProductType(loaderData.typeId);
      title = `${tx(t.plural)} — BiBi Studio`;
      description = tx(t.tagline);
    } else {
      const p = getProduct(loaderData.slug)!;
      const t = getProductType(p.productType);
      title = `${tx(p.name)} · ${tx(t.name)} — BiBi Studio`;
      description = `${tx(t.name)} ${tx(p.name)} thuộc bộ sưu tập ${tx(getCollection(p.collection).name)} của BiBi Studio.`;
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(
          buildBreadcrumbSchema([
            { name: "Sản phẩm", url: `${SITE_URL}/products` },
            { name: tx(t.plural), url: `${SITE_URL}/products/${t.slug}` },
            { name: tx(p.name), url: `${SITE_URL}/products/${params.slug}` },
          ]),
        ),
      });
    }
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts,
    };
  },
  notFoundComponent: ProductNotFound,
  component: ProductRoute,
});

function ProductNotFound() {
  return (
    <PageShell>
      <PageIntro eyebrow="404" title="Không tìm thấy sản phẩm" lead="Sản phẩm này không tồn tại hoặc đã được chuyển." />
      <div className="mx-auto max-w-[1280px] px-6 pb-28 lg:px-12">
        <Link to="/products" className="text-[12px] uppercase tracking-[0.22em] underline underline-offset-8">Xem tất cả sản phẩm</Link>
      </div>
    </PageShell>
  );
}

function ProductRoute() {
  const data = Route.useLoaderData();
  return data.kind === "type" ? <TypeListing typeId={data.typeId} /> : <ProductDetail slug={data.slug} />;
}

function TypeListing({ typeId }: { typeId: Parameters<typeof getProductType>[0] }) {
  const t = getProductType(typeId);
  return (
    <PageShell>
      <PageIntro eyebrow="Sản phẩm" title={tx(t.plural)} lead={tx(t.tagline)} />
      <section className="mx-auto max-w-[1280px] px-6 pb-28 lg:px-12">
        <CatalogueGrid items={productsByType(typeId)} />
      </section>
      <ContactBand />
    </PageShell>
  );
}

function ProductDetail({ slug }: { slug: string }) {
  const p = getProduct(slug)!;
  const t = getProductType(p.productType);
  const c = getCollection(p.collection);
  const details = [
    ["Kích thước", p.dimensions],
    ["Chất liệu", p.material && tx(p.material)],
    ["Số trang", p.pages],
    ["Định dạng", p.format && tx(p.format)],
  ].filter(([, v]) => v) as [string, string][];
  const related = relatedProducts(p, 8);

  return (
    <PageShell>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-[1280px] px-6 pt-8 text-[12px] text-muted-foreground lg:px-12">
        <Link to="/" className="hover:text-foreground">Trang chủ</Link> /{" "}
        <Link to="/collections/$slug" params={{ slug: c.slug }} className="hover:text-foreground">{tx(c.name)}</Link> /{" "}
        <Link to="/products/$slug" params={{ slug: t.slug }} className="hover:text-foreground">{tx(t.plural)}</Link> /{" "}
        <span className="text-foreground">{tx(p.name)}</span>
      </nav>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-6 py-10 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:px-12">
        <div>
          {p.images.length ? (
            <ProductGallery images={p.images} alt={tx(p.name)} transitionName={productTransitionName(p.slug)} />
          ) : (
            <PaperPlaceholder label={tx(t.name)} size="1200 × 1500" />
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="eyebrow">{tx(t.name)}</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] md:text-6xl">{tx(p.name)}</h1>
          <Link to="/collections/$slug" params={{ slug: c.slug }} className="mt-3 inline-block text-[14px] text-kraft hover:underline">
            Bộ sưu tập {tx(c.name)}
          </Link>
          <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">{tx(p.description)}</p>

          {details.length > 0 && (
            <dl className="mt-10 divide-y divide-border border-y border-border">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between py-3 text-sm">
                  <dt className="eyebrow">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="paper-texture mt-10 p-7">
            <p className="font-display text-2xl">Bạn quan tâm đến sản phẩm này?</p>
            <p className="mt-2 text-[13px] text-muted-foreground">Liên hệ BiBi Studio để được tư vấn chi tiết.</p>
            <ContactLinks className="mt-5" />
            <Link to="/contact" className="mt-6 block bg-foreground py-3.5 text-center text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent">
              Liên hệ BiBi Studio
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 lg:px-12">
          <Slider label={`Cùng bộ sưu tập ${tx(c.name)}`}>
            {related.map((r, i) => (
              <div key={r.slug} className="w-[62vw] shrink-0 snap-start sm:w-[40vw] md:w-[calc((100%-4rem)/3)]">
                <CatalogueCard product={r} index={i} />
              </div>
            ))}
          </Slider>
        </section>
      )}
      <div className="h-24 md:hidden" />
      <ProductContactBar name={tx(p.name)} />
    </PageShell>
  );
}

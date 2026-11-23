import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell, PageIntro } from "@/components/page-shell";
import { CatalogueCard, CatalogueGrid, productTransitionName } from "@/components/catalogue-card";
import { ProductGallery, Slider } from "@/components/product-gallery";
import { ProductContactBar } from "@/components/product-contact-bar";
import { ContactBand, ContactLinks } from "@/components/contact-cta";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { getProduct, productsByType, relatedProducts, tx, type Product } from "@/data/catalogue";
import {
  getCollection,
  getCollectionBySlug,
  getProductType,
  getProductTypeBySlug,
  loadTaxonomy,
  useTaxonomy,
} from "@/lib/catalogue-taxonomy";
import { findPublicProduct, getPublicProducts, pickSource } from "@/lib/content-api";
import { attributeRows } from "@/lib/catalogue-attributes";
import { toPublicProduct } from "@/lib/content-adapter";
import { resolveSeo } from "@/lib/content-seo";
import { SITE_URL, buildBreadcrumbSchema } from "@/lib/seo";
import { t } from "@/lib/messages";
import { site } from "@/platform/site";

function relatedFromList(product: Product, list: Product[], n = 8): Product[] {
  const sameCollection = list.filter(
    (x) => x.slug !== product.slug && x.collection === product.collection,
  );
  const sameType = list.filter(
    (x) =>
      x.slug !== product.slug &&
      x.collection !== product.collection &&
      x.productType === product.productType,
  );
  return sameCollection.concat(sameType).slice(0, n);
}

// /products/<type-slug> → listing by product type; /products/<product-slug> → product detail.
export const Route = createFileRoute("/products/$slug")({
  loader: async ({ params }) => {
    // The type list decides what this URL is. A slug that is not a type in the list at hand
    // is most likely a product, so its detail is requested alongside the lists.
    const detail = getProductTypeBySlug(params.slug) ? undefined : findPublicProduct(params.slug);
    const [list] = await Promise.all([getPublicProducts(), loadTaxonomy()]);
    const type = getProductTypeBySlug(params.slug);
    if (type)
      return {
        kind: "type" as const,
        typeId: type.id,
        products: list
          ? list.map(toPublicProduct).filter((p) => p.productType === type.id)
          : productsByType(type.id),
      };
    const api = await (detail ?? findPublicProduct(params.slug));
    const source = pickSource(api, () => getProduct(params.slug));
    if (!source) throw notFound();
    if (source.from === "bundle")
      return {
        kind: "product" as const,
        product: source.value,
        related: relatedProducts(source.value, 8),
        seo: null,
      };
    const product = toPublicProduct(source.value);
    const related = list
      ? relatedFromList(product, list.map(toPublicProduct))
      : relatedProducts(product, 8);
    return { kind: "product" as const, product, related, seo: source.value };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData)
      return {
        meta: [{ title: t("notFound.metaTitle") }, { name: "robots", content: "noindex" }],
      };
    let title: string, description: string;
    let image: string | undefined;
    const scripts: { type: string; children: string }[] = [];
    if (loaderData.kind === "type") {
      const type = getProductType(loaderData.typeId);
      title = `${tx(type.plural)}${site.seo.titleSuffix}`;
      description = tx(type.tagline);
    } else {
      const p = loaderData.product;
      const type = getProductType(p.productType);
      const seo = resolveSeo({
        seoTitle: loaderData.seo?.seo_title,
        seoDescription: loaderData.seo?.seo_description,
        title: `${tx(p.name)} · ${tx(type.name)}${site.seo.titleSuffix}`,
        shortDescription: tx(p.description),
      });
      title = seo.title;
      if (p.images[0])
        image = p.images[0].startsWith("http") ? p.images[0] : `${SITE_URL}${p.images[0]}`;
      description = seo.description;
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(
          buildBreadcrumbSchema([
            { name: t("products.heading"), url: `${SITE_URL}/products` },
            ...(getProductTypeBySlug(type.slug)
              ? [{ name: tx(type.plural), url: `${SITE_URL}/products/${type.slug}` }]
              : []),
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
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
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
      <PageIntro
        eyebrow="404"
        title={t("product.notFoundTitle")}
        lead={t("product.notFoundLead")}
      />
      <div className="mx-auto max-w-[1280px] px-6 pb-28 lg:px-12">
        <Link
          to="/products"
          className="text-[12px] uppercase tracking-[0.22em] underline underline-offset-8"
        >
          {t("product.viewAll")}
        </Link>
      </div>
    </PageShell>
  );
}

function ProductRoute() {
  const data = Route.useLoaderData();
  return data.kind === "type" ? (
    <TypeListing typeId={data.typeId} products={data.products} />
  ) : (
    <ProductDetail product={data.product} related={data.related} />
  );
}

function TypeListing({ typeId, products }: { typeId: string; products: Product[] }) {
  useTaxonomy();
  const type = getProductType(typeId);
  return (
    <PageShell>
      <PageIntro eyebrow={t("products.heading")} title={tx(type.plural)} lead={tx(type.tagline)} />
      <section className="mx-auto max-w-[1280px] px-6 pb-28 lg:px-12">
        <CatalogueGrid items={products} />
      </section>
      <ContactBand />
    </PageShell>
  );
}

function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const p = product;
  useTaxonomy();
  const type = getProductType(p.productType);
  const c = getCollection(p.collection);
  // Only a known type or collection has a page of its own to link to.
  const typeHasPage = getProductTypeBySlug(type.slug) !== undefined;
  const collectionHasPage = getCollectionBySlug(c.slug) !== undefined;
  const details = attributeRows(p);

  return (
    <PageShell>
      <nav
        aria-label="Breadcrumb"
        className="mx-auto max-w-[1280px] px-6 pt-8 text-[12px] text-muted-foreground lg:px-12"
      >
        <Link to="/" className="hover:text-foreground">
          {t("nav.home")}
        </Link>{" "}
        /{" "}
        {collectionHasPage ? (
          <Link to="/collections/$slug" params={{ slug: c.slug }} className="hover:text-foreground">
            {tx(c.name)}
          </Link>
        ) : (
          tx(c.name)
        )}{" "}
        /{" "}
        {typeHasPage ? (
          <Link to="/products/$slug" params={{ slug: type.slug }} className="hover:text-foreground">
            {tx(type.plural)}
          </Link>
        ) : (
          tx(type.plural)
        )}{" "}
        / <span className="text-foreground">{tx(p.name)}</span>
      </nav>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-6 py-10 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:px-12">
        <div>
          {p.images.length ? (
            <ProductGallery
              images={p.images}
              alt={tx(p.name)}
              transitionName={productTransitionName(p.slug)}
            />
          ) : (
            <PaperPlaceholder label={tx(type.name)} size="1200 × 1500" />
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="eyebrow">{tx(type.name)}</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] md:text-6xl">{tx(p.name)}</h1>
          {collectionHasPage ? (
            <Link
              to="/collections/$slug"
              params={{ slug: c.slug }}
              className="mt-3 inline-block text-[14px] text-kraft hover:underline"
            >
              {t("product.collection", { name: tx(c.name) })}
            </Link>
          ) : (
            <p className="mt-3 text-[14px] text-kraft">
              {t("product.collection", { name: tx(c.name) })}
            </p>
          )}
          <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
            {tx(p.description)}
          </p>

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
            <p className="font-display text-2xl">{t("product.askTitle")}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">{t("product.askText")}</p>
            <ContactLinks className="mt-5" />
            <Link
              to="/contact"
              className="mt-6 block bg-foreground py-3.5 text-center text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent"
            >
              {t("product.askAction")}
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 lg:px-12">
          <Slider label={t("product.related", { name: tx(c.name) })}>
            {related.map((r, i) => (
              <div
                key={r.slug}
                className="w-[62vw] shrink-0 snap-start sm:w-[40vw] md:w-[calc((100%-4rem)/3)]"
              >
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

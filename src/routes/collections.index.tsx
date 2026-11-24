import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { PaperPlaceholder } from "@/components/brand/paper-placeholder";
import { Reveal } from "@/components/brand/reveal";
import { ContactBand } from "@/components/contact-cta";
import { getAllProducts, tx, type Product } from "@/data/catalogue";
import { loadTaxonomy, useTaxonomy } from "@/lib/catalogue-taxonomy";
import { getPublicProducts } from "@/lib/content-api";
import { toPublicProduct } from "@/lib/content-adapter";
import { t } from "@/lib/messages";

const title = t("collections.metaTitle");
const description = t("collections.metaDescription");

export const Route = createFileRoute("/collections/")({
  loader: async () => {
    const [api] = await Promise.all([getPublicProducts(), loadTaxonomy()]);
    return { products: api ? api.map(toPublicProduct) : getAllProducts() };
  },
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
  component: CollectionsPage,
});

function CollectionsPage() {
  const { products }: { products: Product[] } = Route.useLoaderData();
  const { collections } = useTaxonomy();
  const countByCollection = (id: string) => products.filter((p) => p.collection === id).length;
  return (
    <PageShell>
      <PageIntro
        eyebrow={t("collections.eyebrow")}
        title={t("collections.heading")}
        lead={t("collections.lead")}
      />
      <section className="mx-auto max-w-[1280px] space-y-24 px-6 pb-28 lg:px-12">
        {collections.map((c, i) => (
          <Reveal key={c.id}>
            <Link
              to="/collections/$slug"
              params={{ slug: c.slug }}
              className={`group grid gap-8 md:grid-cols-2 md:items-center ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="overflow-hidden">
                <div className="transition duration-700 ease-out group-hover:scale-[1.04]">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={tx(c.name)}
                      loading="lazy"
                      className="aspect-[5/4] w-full object-cover"
                    />
                  ) : (
                    <PaperPlaceholder label={tx(c.name)} ratio="5/4" />
                  )}
                </div>
              </div>
              <div>
                <span className="font-display text-xl text-kraft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
                  {tx(c.name)}
                </h2>
                <p className="mt-1 text-[13px] uppercase tracking-[0.2em] text-muted-foreground">
                  {c.name.en}
                </p>
                <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                  {tx(c.tagline)}
                </p>
                <p className="eyebrow mt-8 flex items-center gap-2 text-foreground transition group-hover:gap-3">
                  {t("collections.count", { count: countByCollection(c.id) })}{" "}
                  <ArrowRight className="size-3.5" />
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </section>
      <ContactBand />
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { getAllProducts, type Product } from "@/data/catalogue";
import { loadTaxonomy } from "@/lib/catalogue-taxonomy";
import { getPublicProducts } from "@/lib/content-api";
import { toPublicProduct } from "@/lib/content-adapter";
import { t } from "@/lib/messages";
import { buildOrganizationSchema } from "@/lib/seo";
import HomePage from "@/platform/pages/home";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [api] = await Promise.all([getPublicProducts(), loadTaxonomy()]);
    return { products: api ? api.map(toPublicProduct) : getAllProducts() };
  },
  head: () => ({
    meta: [
      { title: t("home.title") },
      { name: "description", content: t("home.description") },
      { property: "og:title", content: t("home.title") },
      { property: "og:description", content: t("home.description") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(buildOrganizationSchema()) }],
  }),
  component: Home,
});

function Home() {
  const { products }: { products: Product[] } = Route.useLoaderData();
  return <HomePage products={products} />;
}

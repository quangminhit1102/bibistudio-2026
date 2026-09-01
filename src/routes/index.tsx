import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { BlogHighlights } from "@/components/blog-highlights";
import { SiteFooter } from "@/components/site-footer";
import { HeroSlider } from "@/components/hero-slider";
import { ProductCarousel } from "@/components/product-carousel";
import { BannerGrid, CollectionTiles } from "@/components/banner-sections";
import { sections } from "@/data/products";
import { DEFAULT_OG_IMAGE, buildOrganizationSchema } from "@/lib/seo";

const title = "BiBi Studio - Sổ tay, thiệp, notebooks";
const description =
  "BiBi Studio cung cấp sổ tay, sketchbook, scrapbook & DIY, bút và phụ kiện journaling: đẹp tinh tế, tiện dụng, thông minh và thân thiện môi trường.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: DEFAULT_OG_IMAGE,
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: DEFAULT_OG_IMAGE,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(buildOrganizationSchema()),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <h1 className="sr-only">BiBi Studio — sổ tay, scrapbook, bút và phụ kiện journaling</h1>
        <HeroSlider />
        {sections.slice(0, 2).map((s) => (
          <ProductCarousel key={s.slug} section={s} />
        ))}
        <BannerGrid />
        {sections.slice(2).map((s) => (
          <ProductCarousel key={s.slug} section={s} />
        ))}
        <CollectionTiles />
        <BlogHighlights />
      </main>
      <SiteFooter />
    </div>
  );
}

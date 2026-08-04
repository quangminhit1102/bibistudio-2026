import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getCategory } from "@/data/catalog";

const SITE = "https://bibistudio-2026.lovable.app";

export const Route = createFileRoute("/collections/$slug")({
  loader: ({ params }) => {
    const category = getCategory(params.slug);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Không tìm thấy danh mục — BiBi Studio" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.category.title} — BiBi Studio`;
    const description =
      loaderData.category.blurb ??
      `Khám phá ${loaderData.category.title.toLowerCase()} tại BiBi Studio: sổ tay, scrapbook, bút và phụ kiện journaling.`;
    const url = `${SITE}/collections/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: loaderData.category.products[0]?.img ?? "" },
        { name: "twitter:image", content: loaderData.category.products[0]?.img ?? "" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: CategoryNotFound,
  component: CategoryPage,
});

function CategoryNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-24 text-center lg:px-12">
        <h1 className="text-2xl font-bold">Không tìm thấy danh mục</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">
          Về trang chủ
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

const sortOptions = [
  { value: "default", label: "Mặc định" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "asc", label: "Giá tăng dần" },
  { value: "desc", label: "Giá giảm dần" },
];

const toNumber = (v: string) => Number(v.replace(/[^\d]/g, ""));

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const [sort, setSort] = useState("default");

  const products = useMemo(() => {
    const list = [...category.products];
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    if (sort === "za") list.sort((a, b) => b.name.localeCompare(a.name, "vi"));
    if (sort === "asc") list.sort((a, b) => toNumber(a.price) - toNumber(b.price));
    if (sort === "desc") list.sort((a, b) => toNumber(b.price) - toNumber(a.price));
    return list;
  }, [category.products, sort]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-8 lg:px-12">
            <nav aria-label="Breadcrumb" className="text-[12px] text-muted-foreground">
              <Link to="/" className="hover:text-accent">
                Trang chủ
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">{category.title}</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
              {category.title}
            </h1>
            {category.blurb && (
              <p className="max-w-2xl text-[13px] text-muted-foreground">{category.blurb}</p>
            )}
          </div>
        </div>

        {category.tiles.length > 0 && (
          <section className="mx-auto max-w-[1280px] px-4 pt-10 lg:px-12">
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {category.tiles.map((t: { title: string; slug: string; img: string }) => (
                <Link
                  key={`${t.slug}-${t.title}`}
                  to="/collections/$slug"
                  params={{ slug: t.slug }}
                  className="group block"
                >
                  <div className="overflow-hidden bg-secondary">
                    <img
                      src={t.img}
                      alt={t.title}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <h2 className="mt-3 text-[14px] font-semibold text-foreground">{t.title}</h2>
                  <span className="text-[12px] text-accent underline-offset-4 group-hover:underline">
                    Xem tất cả
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-[1280px] px-4 py-10 lg:px-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-[13px] text-muted-foreground">{products.length} sản phẩm</p>
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              Sắp xếp theo:
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

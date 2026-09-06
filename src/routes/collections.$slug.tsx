import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getCategory, getCategoryProductsPage } from "@/data/catalog";
import { PRODUCT_SORT_KEYS, PRODUCTS_PER_PAGE, type ProductSortKey } from "@/data/pagination";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { SortSelect } from "@/components/ui/sort-select";
import { Pagination } from "@/components/ui/pagination";
import { useScrollToOnPage } from "@/hooks/use-scroll-to-on-page";
import { SITE_URL, appendPageParam, buildBreadcrumbSchema } from "@/lib/seo";

const categorySearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  sort: z.enum(PRODUCT_SORT_KEYS).catch("default"),
});

export const Route = createFileRoute("/collections/$slug")({
  validateSearch: categorySearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    sort: search.sort,
  }),
  loader: ({ params, deps }) => {
    const category = getCategory(params.slug);
    if (!category) throw notFound();

    const productPage = getCategoryProductsPage(category, deps.page, PRODUCTS_PER_PAGE, deps.sort);

    if (deps.page > productPage.totalPages) {
      throw redirect({
        to: "/collections/$slug",
        params: { slug: params.slug },
        search: { page: productPage.totalPages, sort: deps.sort },
      });
    }

    const { slug, title, blurb, tiles } = category;
    return { categoryMeta: { slug, title, blurb, tiles }, productPage };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Không tìm thấy danh mục — BiBi Studio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.categoryMeta.title} — BiBi Studio`;
    const description =
      loaderData.categoryMeta.blurb ??
      `Khám phá ${loaderData.categoryMeta.title.toLowerCase()} tại BiBi Studio: sổ tay, scrapbook, bút và phụ kiện journaling.`;
    const url = appendPageParam(
      `${SITE_URL}/collections/${params.slug}`,
      loaderData.productPage.page,
    );
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        {
          property: "og:image",
          content: loaderData.productPage.items[0]?.img ?? "",
        },
        { name: "twitter:image", content: loaderData.productPage.items[0]?.img ?? "" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            buildBreadcrumbSchema([
              { name: "Trang chủ", url: SITE_URL },
              { name: loaderData.categoryMeta.title, url },
            ]),
          ),
        },
      ],
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

function CategoryPage() {
  const { categoryMeta, productPage } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  useScrollToOnPage(search.page, "category-listing");

  const handleSort = (sort: ProductSortKey) => {
    if (sort === search.sort) return;
    navigate({ search: { page: 1, sort } });
  };

  const pageSearch = (targetPage: number) => ({
    page: targetPage,
    sort: search.sort,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-8 lg:px-12">
            <SimpleBreadcrumb
              crumbs={[{ label: "Trang chủ", to: "/" }, { label: categoryMeta.title }]}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
              {categoryMeta.title}
            </h1>
            {categoryMeta.blurb && (
              <p className="max-w-2xl text-[13px] text-muted-foreground">{categoryMeta.blurb}</p>
            )}
          </div>
        </div>

        {categoryMeta.tiles.length > 0 && (
          <section className="mx-auto max-w-[1280px] px-4 pt-10 lg:px-12">
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {categoryMeta.tiles.map((t) => (
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

        <section
          id="category-listing"
          className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-10 lg:px-12"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-[13px] text-muted-foreground">{productPage.total} sản phẩm</p>
            <SortSelect value={search.sort} onChange={handleSort} />
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {productPage.items.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>

          <Pagination
            to="/collections/$slug"
            page={productPage.page}
            totalPages={productPage.totalPages}
            search={pageSearch}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

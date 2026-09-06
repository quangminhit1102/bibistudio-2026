import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { LazyImage } from "@/components/ui/lazy-image";
import { Pagination } from "@/components/ui/pagination";
import { useScrollToOnPage } from "@/hooks/use-scroll-to-on-page";
import { getBlogPostsPage } from "@/data/blog";
import { POSTS_PER_PAGE } from "@/data/pagination";
import { SITE_URL, appendPageParam } from "@/lib/seo";

const title = "Nhật ký — BiBi Studio";
const description =
  "Khám phá cảm hứng, hướng dẫn và câu chuyện xoay quanh sổ tay, scrapbook, bút và phụ kiện journaling tại BiBi Studio.";

const blogSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/blog/")({
  validateSearch: blogSearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
  }),
  loader: ({ deps }) => {
    const postPage = getBlogPostsPage(deps.page, POSTS_PER_PAGE);
    if (deps.page > postPage.totalPages) {
      throw redirect({
        to: "/blog",
        search: { page: postPage.totalPages },
      });
    }
    return { postPage };
  },
  head: ({ loaderData }) => {
    const url = appendPageParam(`${SITE_URL}/blog`, loaderData?.postPage.page ?? 1);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogIndexPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function BlogIndexPage() {
  const { postPage } = Route.useLoaderData();
  const search = Route.useSearch();

  useScrollToOnPage(search.page, "blog-listing");

  const pageSearch = (targetPage: number) => ({ page: targetPage });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-10 lg:px-12">
            <SimpleBreadcrumb crumbs={[{ label: "Trang chủ", to: "/" }, { label: "Nhật ký" }]} />
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[32px]">
              Nhật ký BiBi Studio
            </h1>
            <p className="max-w-2xl text-[14px] text-muted-foreground">
              Cảm hứng, mẹo viết tay và những câu chuyện nhỏ xoay quanh sổ tay, scrapbook & phụ kiện
              journaling.
            </p>
          </div>
        </div>

        <section
          id="blog-listing"
          className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-12 lg:px-12"
        >
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {postPage.items.map((post) => (
              <article
                key={post.slug}
                className="group flex flex-col overflow-hidden border border-border bg-card transition hover:shadow-md"
              >
                <Link to="/blog/$slug" params={{ slug: post.slug }}>
                  <LazyImage
                    src={post.coverImage}
                    alt={post.title}
                    className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {post.category}
                  </span>
                  <h2 className="mt-2 text-[17px] font-semibold leading-snug text-foreground">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: post.slug }}
                      className="hover:text-accent"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span>{post.readTime}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            to="/blog"
            page={postPage.page}
            totalPages={postPage.totalPages}
            search={pageSearch}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

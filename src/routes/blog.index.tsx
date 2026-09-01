import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { getAllBlogPosts } from "@/data/blog";
import { LazyImage } from "@/components/ui/lazy-image";

const title = "Nhật ký — BiBi Studio";
const description =
  "Khám phá cảm hứng, hướng dẫn và câu chuyện xoay quanh sổ tay, scrapbook, bút và phụ kiện journaling tại BiBi Studio.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bibistudio-2026.lovable.app/blog" }],
  }),
  loader: () => ({ posts: getAllBlogPosts() }),
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
  const { posts } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-10 lg:px-12">
            <SimpleBreadcrumb
              crumbs={[{ label: "Trang chủ", to: "/" }, { label: "Nhật ký" }]}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[32px]">
              Nhật ký BiBi Studio
            </h1>
            <p className="max-w-2xl text-[14px] text-muted-foreground">
              Cảm hứng, mẹo viết tay và những câu chuyện nhỏ xoay quanh sổ tay,
              scrapbook & phụ kiện journaling.
            </p>
          </div>
        </div>

        <section className="mx-auto max-w-[1280px] px-4 py-12 lg:px-12">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
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
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

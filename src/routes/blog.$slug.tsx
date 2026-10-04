import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { getBlogPost } from "@/data/blog";
import { LazyImage } from "@/components/ui/lazy-image";

const SITE = "https://bibistudio-2026.lovable.app";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return { post, related: [] as never[] };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Không tìm thấy bài viết — BiBi Studio" }, { name: "robots", content: "noindex" }],
      };
    }
    const { post } = loaderData;
    const title = `${post.title} — BiBi Studio`;
    const url = `${SITE}/blog/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "article:published_time", content: post.date },
        { name: "author", content: post.author },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: PostNotFound,
  component: PostPage,
});

function PostNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-24 text-center lg:px-12">
        <h1 className="text-2xl font-bold">Không tìm thấy bài viết</h1>
        <Link to="/blog" className="mt-4 inline-block text-accent underline">
          Xem tất cả bài viết
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function slugifyHeading(text: string, index: number) {
  const base = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "muc"}-${index}`;
}


function PostPage() {
  const { post, related } = Route.useLoaderData();

  const toc = post.content
    .map((block, index) =>
      block.type === "heading"
        ? { id: slugifyHeading(block.text, index), text: block.text, level: block.level ?? 2 }
        : null,
    )
    .filter((item): item is { id: string; text: string; level: 2 | 3 } => item !== null);



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* Cover image full-width */}
        <div className="relative w-full overflow-hidden bg-secondary">
          <div className="mx-auto max-w-[1400px]">
            <LazyImage
              src={post.coverImage}
              alt={post.title}
              aspectRatio="auto"
              priority
              className="aspect-[21/9] w-full object-cover md:aspect-[21/8]"
            />
          </div>
        </div>

        {/* Article header */}
        <section className="mx-auto max-w-[880px] px-4 pt-10 pb-2 md:pt-14">
          <SimpleBreadcrumb
            crumbs={[
              { label: "Trang chủ", to: "/" },
              { label: "Nhật ký", to: "/blog" },
              { label: post.category },
            ]}
          />
          <span className="mt-6 inline-block rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {post.category}
          </span>
          <h1 className="mt-4 text-[26px] font-semibold leading-[1.25] tracking-tight text-foreground md:text-[34px]">
            {post.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{post.author}</span>
            <span>•</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>•</span>
            <span>{post.readTime}</span>
          </div>
        </section>

        {/* Content body */}
        <article className="mx-auto max-w-[880px] px-4 py-10 md:py-14">
          {toc.length > 2 && (
            <nav
              aria-label="Mục lục"
              className="mb-10 rounded-sm border border-border bg-secondary/40 px-5 py-5"
            >
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mục lục
              </h2>
              <ol className="mt-3 space-y-1.5">
                {toc.map((item) => (
                  <li
                    key={item.id}
                    className={item.level === 3 ? "pl-4" : ""}
                  >
                    <a
                      href={`#${item.id}`}
                      className={`text-[14px] leading-snug text-foreground hover:text-accent hover:underline ${
                        item.level === 3 ? "text-muted-foreground" : "font-medium"
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="prose prose-stone max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-[15px] prose-p:leading-[1.8] prose-p:text-foreground prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-accent prose-blockquote:bg-secondary/40 prose-blockquote:py-2 prose-blockquote:pl-5 prose-blockquote:pr-4 prose-blockquote:italic prose-blockquote:text-foreground prose-img:rounded-sm prose-figcaption:text-[13px] prose-figcaption:text-muted-foreground">
            {post.content.map((block, index) => {
              switch (block.type) {
                case "paragraph":
                  return (
                    <p key={index} className="mb-6">
                      {block.text}
                    </p>
                  );
                case "heading": {
                  const HeadingTag = block.level === 3 ? "h3" : "h2";
                  return (
                    <HeadingTag
                      key={index}
                      id={slugifyHeading(block.text, index)}
                      className={
                        block.level === 3
                          ? "mb-2 mt-6 scroll-mt-28 text-[17px] font-semibold tracking-tight text-foreground md:text-[18px]"
                          : "mb-3 mt-8 scroll-mt-28 text-[20px] font-semibold tracking-tight text-foreground md:text-[22px]"
                      }
                    >
                      {block.text}
                    </HeadingTag>
                  );
                }

                case "quote":
                  return (
                    <blockquote
                      key={index}
                      className="my-8 border-l-4 border-accent bg-secondary/40 py-4 pl-5 pr-4 italic text-foreground"
                    >
                      {block.text}
                    </blockquote>
                  );
                case "image":
                  return (
                    <figure key={index} className="my-8">
                      <LazyImage
                        src={block.src}
                        alt={block.alt}
                        className="aspect-[3/2] w-full rounded-sm object-cover"
                      />
                      {block.caption && (
                        <figcaption className="mt-2 text-center text-[13px] text-muted-foreground">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* Tags / share */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span>Chủ đề:</span>
              <span className="rounded-full border border-border px-3 py-1 text-foreground">
                {post.category}
              </span>
            </div>
            <Link
              to="/blog"
              className="text-[13px] font-medium text-accent hover:underline"
            >
              ← Quay lại Nhật ký
            </Link>
          </div>
        </article>

      </main>
      <SiteFooter />
    </div>
  );
}

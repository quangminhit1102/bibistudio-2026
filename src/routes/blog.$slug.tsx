import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { getBlogPost } from "@/data/blog";
import { findPublicPost, pickSource } from "@/lib/content-api";
import { staticPostToView, toPublicPost, type PostView } from "@/lib/content-adapter";
import { renderArticle, slugifyHeading, type TocItem } from "@/lib/content-html";
import { resolveSeo } from "@/lib/content-seo";
import { LazyImage } from "@/components/ui/lazy-image";
import { SITE_URL } from "@/lib/seo";
import { site } from "@/platform/site";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const source = pickSource(await findPublicPost(params.slug), () => getBlogPost(params.slug));
    if (!source) throw notFound();
    return {
      post: source.from === "api" ? toPublicPost(source.value) : staticPostToView(source.value),
    };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: `Không tìm thấy bài viết${site.seo.titleSuffix}` },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { post } = loaderData;
    const seoMeta = resolveSeo({
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      title: `${post.title}${site.seo.titleSuffix}`,
      excerpt: post.excerpt,
    });
    const title = seoMeta.title;
    const description = seoMeta.description;
    const url = `${SITE_URL}/blog/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
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
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const proseClasses = "article-body";

function Toc({ toc }: { toc: TocItem[] }) {
  return (
    <nav
      aria-label="Mục lục"
      className="mb-10 rounded-sm border border-border bg-secondary/40 px-5 py-5"
    >
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        Mục lục
      </h2>
      <ol className="mt-3 space-y-1.5">
        {toc.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
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
  );
}

function PostPage() {
  const { post }: { post: PostView } = Route.useLoaderData();

  const article = useMemo(
    () => (post.content.kind === "html" ? renderArticle(post.content.html) : null),
    [post],
  );

  const blocksToc: TocItem[] =
    post.content.kind === "blocks"
      ? post.content.blocks
          .map((block, index) =>
            block.type === "heading"
              ? {
                  id: slugifyHeading(block.text, index),
                  text: block.text,
                  level: (block.level ?? 2) as 2 | 3,
                }
              : null,
          )
          .filter((item): item is TocItem => item !== null)
      : [];

  const toc = article ? article.toc : blocksToc;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* Cover image full-width */}
        <div className="relative w-full overflow-hidden bg-secondary">
          <div className="mx-auto max-w-[1400px]">
            {post.coverImage ? (
              <LazyImage
                src={post.coverImage}
                alt={post.title}
                aspectRatio="auto"
                priority
                className="aspect-[21/9] w-full object-cover md:aspect-[21/8]"
              />
            ) : (
              <div className="aspect-[21/9] w-full md:aspect-[21/8]" />
            )}
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
          {post.excerpt && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{post.author}</span>
            {post.date && (
              <>
                <span>•</span>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
              </>
            )}
            {post.readTime && (
              <>
                <span>•</span>
                <span>{post.readTime}</span>
              </>
            )}
          </div>
        </section>

        {/* Content body */}
        <article className="mx-auto max-w-[880px] px-4 py-10 md:py-14">
          {toc.length > 2 && <Toc toc={toc} />}
          {article ? (
            <div className={proseClasses} dangerouslySetInnerHTML={{ __html: article.html }} />
          ) : (
            <div className={proseClasses}>
              {(post.content.kind === "blocks" ? post.content.blocks : []).map((block, index) => {
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
          )}

          {/* Tags / share */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span>Chủ đề:</span>
              <span className="rounded-full border border-border px-3 py-1 text-foreground">
                {post.category}
              </span>
            </div>
            <Link to="/blog" className="text-[13px] font-medium text-accent hover:underline">
              ← Quay lại Nhật ký
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

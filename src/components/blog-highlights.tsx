import { Link } from "@tanstack/react-router";
import { getAllBlogPosts } from "@/data/blog";
import { LazyImage } from "@/components/ui/lazy-image";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function BlogHighlights() {
  const posts = getAllBlogPosts().slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-border py-12 md:py-16">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-12">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-foreground md:text-[24px]">
              Nhật ký BiBi
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cảm hứng viết tay, mẹo journaling và những câu chuyện nhỏ.
            </p>
          </div>
          <Link
            to="/blog"
            className="shrink-0 text-[13px] font-medium text-accent hover:underline"
          >
            Xem Thêm
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {posts.map((post) => (
            <article key={post.slug} className="group flex flex-col">
              <Link to="/blog/$slug" params={{ slug: post.slug }} className="overflow-hidden">
                <LazyImage
                  src={post.coverImage}
                  alt={post.title}
                  className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </Link>
              <span className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-accent">
                {post.category}
              </span>
              <h3 className="mt-2 text-[16px] font-semibold leading-snug text-foreground">
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="hover:text-accent"
                >
                  {post.title}
                </Link>
              </h3>
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>•</span>
                <span>{post.readTime}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

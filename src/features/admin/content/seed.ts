import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import { getAllBlogPosts } from "@/data/blog";
import { escapeHtml, writeRichContent } from "./rich-content";
export function seed(): SeedBatch {
  const source = getAllBlogPosts();
  return {
    posts: source.map((p) => ({
      ...seedBase("journal-" + p.slug),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: writeRichContent(
        p.content
          .map((b, i) => {
            if (b.type === "image")
              return `<figure><img data-media-id="journal-inline-${p.slug}-${i}" alt="${escapeHtml(b.alt)}">${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ""}</figure>`;
            const tag =
              b.type === "heading" ? `h${b.level ?? 2}` : b.type === "quote" ? "blockquote" : "p";
            return `<${tag}>${escapeHtml(b.text)}</${tag}>`;
          })
          .join(""),
      ),
      categoryId: "cat-journal",
      tagIds: ["tag-0"],
      authorId: "user-1",
      status: "published" as const,
      publishAt: p.date,
      imageId: "journal-cover-" + p.slug,
      seoTitle: p.title,
      seoDescription: p.excerpt,
    })),
    media: source.flatMap((p) => [
      {
        ...seedBase("journal-cover-" + p.slug),
        name: p.title,
        mime: "image/jpeg",
        size: 0,
        width: 0,
        height: 0,
        blobKey: "",
        url: p.coverImage,
      },
      ...p.content.flatMap((block, index) =>
        block.type === "image"
          ? [
              {
                ...seedBase(`journal-inline-${p.slug}-${index}`),
                name: block.alt,
                mime: "image/jpeg",
                size: 0,
                width: 0,
                height: 0,
                blobKey: "",
                url: block.src,
              },
            ]
          : [],
      ),
    ]),
  };
}

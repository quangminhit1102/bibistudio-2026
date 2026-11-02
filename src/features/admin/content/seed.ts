import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import { getAllBlogPosts } from "@/data/blog";
export function seed(): SeedBatch {
  const source = getAllBlogPosts();
  return {
    posts: source.map((p) => ({
      ...seedBase("journal-" + p.slug),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: JSON.stringify({
        type: "doc",
        content: p.content
          .filter((b) => b.type !== "image")
          .map((b) => ({
            type:
              b.type === "heading" ? "heading" : b.type === "quote" ? "blockquote" : "paragraph",
            ...(b.type === "heading" ? { attrs: { level: b.level ?? 2 } } : {}),
            content:
              b.type === "quote"
                ? [{ type: "paragraph", content: [{ type: "text", text: b.text }] }]
                : [{ type: "text", text: b.text }],
          })),
      }),
      categoryId: "cat-journal",
      tagIds: ["tag-0"],
      authorId: "user-1",
      status: "published" as const,
      publishAt: p.date,
      imageId: "journal-cover-" + p.slug,
      seoTitle: p.title,
      seoDescription: p.excerpt,
    })),
    media: source.map((p) => ({
      ...seedBase("journal-cover-" + p.slug),
      name: p.title,
      mime: "image/jpeg",
      size: 0,
      width: 0,
      height: 0,
      blobKey: "",
      url: p.coverImage,
    })),
  };
}

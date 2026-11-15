import { randomUUID, createHash } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function makePublicAssets() {
  return {
    schemaVersion: 1,
    rendererVersion: "content-doc-v1",
    css: ["/assets/journal-style-a1.css"],
    script: "/assets/blog-client-b2.js",
    assets: [
      "/assets/journal-style-a1.css",
      "/assets/blog-client-b2.js",
      "/assets/transport-c3.js",
      "/assets/inter-d4.woff2",
    ],
    staticRoutes: [
      { path: "/" },
      { path: "/products" },
      { path: "/collections" },
      { path: "/about" },
      { path: "/contact" },
    ],
  };
}
export function makePublicSnapshot({ postCount = 10 } = {}) {
  const category = (name, slug, parentId, position) => ({
      id: randomUUID(),
      revision: 1,
      publicRevision: 1,
      name,
      slug,
      parentId,
      position,
      active: true,
      description: "Giới thiệu " + name,
      seoTitle: "",
      seoDescription: "",
    }),
    one = category("Hướng dẫn", "huong-dan", null, 0),
    two = category("Viết tay", "viet-tay", one.id, 0),
    three = category("Bút và giấy", "but-va-giay", two.id, 0),
    empty = category("Cảm hứng", "cam-hung", null, 1),
    media = {},
    posts = [];
  for (let i = 0; i < postCount; i++) {
    const id = randomUUID(),
      coverMediaId = randomUUID();
    for (const [width, height] of [
      [480, 320],
      [960, 640],
      [1600, 1067],
      [2400, 1600],
    ]) {
      const digest = hash(`photo-${i}-${width}`),
        file = `${coverMediaId}/${digest}.webp`;
      media[file] = { hash: digest, file, mime: "image/webp", width, height, bytes: 1000 + width };
    }
    posts.push({
      id,
      snapshotId: randomUUID(),
      draftRevision: 1,
      title: `Bài viết ${i}`,
      slug: `post-${i}`,
      excerpt: `Giới thiệu bài ${i}`,
      html: `<h2>Một mục</h2><p>Nội dung công khai ${i}</p><figure><img data-media-id="${coverMediaId}" src="bibi-media:${coverMediaId}" alt="Ảnh trong bài ${i}"><figcaption>Chú thích ${i}</figcaption></figure><table><tbody><tr><td>Một ô</td></tr></tbody></table>`,
      categoryId: three.id,
      tags: ["Viết tay"],
      author: { kind: "brand", name: "BiBi Studio" },
      coverMediaId,
      coverAlt: `Ảnh bìa ${i}`,
      seoTitle: "",
      seoDescription: "",
      publishedAt: `2026-11-${String(i + 1).padStart(2, "0")}T02:00:00.000Z`,
      modifiedAt: `2026-11-${String(i + 1).padStart(2, "0")}T02:00:00.000Z`,
      mediaIds: [coverMediaId],
    });
  }
  return {
    schemaVersion: 1,
    generationId: randomUUID(),
    posts,
    categories: [one, two, three, empty],
    redirects: {},
    media,
    routes: [],
    committedAt: "2026-11-14T00:00:00.000Z",
  };
}

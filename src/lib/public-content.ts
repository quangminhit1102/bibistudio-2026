import type { PublicSnapshot } from "../../backend/src/content/contracts";
import type { PublishedCatalogue } from "./blog-navigation";
export type { PublicSnapshot };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    credentials: "omit",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error("Chưa tải được nội dung công khai. Vui lòng thử lại.");
  const bytes = await response.text();
  if (bytes.length > 64 * 1024 ** 2) throw Error("Nội dung công khai vượt giới hạn");
  return JSON.parse(bytes);
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export async function loadPublicContent({
  signal,
}: { signal?: AbortSignal } = {}): Promise<PublicSnapshot> {
  const value = await read("/api/public/content/posts", signal);
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    typeof value.generationId !== "string" ||
    !uuid.test(value.generationId) ||
    !Array.isArray(value.posts) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.routes) ||
    !object(value.media) ||
    !object(value.redirects) ||
    typeof value.committedAt !== "string"
  )
    throw Error("Phiên bản nội dung công khai không hợp lệ");
  if (
    value.posts.some(
      (post) =>
        !object(post) ||
        typeof post.slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) ||
        typeof post.title !== "string" ||
        typeof post.publishedAt !== "string" ||
        typeof post.coverMediaId !== "string" ||
        typeof post.coverAlt !== "string" ||
        typeof post.excerpt !== "string" ||
        typeof post.categoryId !== "string",
    )
  )
    throw Error("Bài viết công khai không hợp lệ");
  return value as unknown as PublicSnapshot;
}
export type PublicReadMode =
  | { schemaVersion: 1; mode: "cms"; generationId: string; routes: PublishedCatalogue["routes"] }
  | { schemaVersion: 1; mode: "legacy"; generationId: null; routes: []; fixture?: true };
export async function loadPublicReadMode({
  signal,
}: { signal?: AbortSignal } = {}): Promise<PublicReadMode> {
  // The Lovable build explicitly opts in. Production/cPanel never infer fixtures from failures.
  if (import.meta.env.VITE_PUBLIC_CONTENT_MODE === "fixture")
    return { schemaVersion: 1, mode: "legacy", generationId: null, routes: [], fixture: true };
  const value = await read("/api/public/content/routes", signal);
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.routes))
    throw Error("Trạng thái Blog không hợp lệ");
  if (value.mode === "legacy" && value.generationId === null && value.routes.length === 0)
    return value as PublicReadMode;
  if (
    value.mode !== "cms" ||
    typeof value.generationId !== "string" ||
    !uuid.test(value.generationId) ||
    value.routes.length > 100000 ||
    value.routes.some(
      (route) =>
        !object(route) ||
        typeof route.path !== "string" ||
        !/^\/blog(?:\/[a-z0-9-]+)*$/.test(route.path) ||
        typeof route.label !== "string",
    )
  )
    throw Error("Danh sách đường dẫn công khai không hợp lệ");
  return value as PublicReadMode;
}
export interface PublicHighlight {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  coverAlt: string;
  category: string;
  date: string;
  readTime?: string;
}
export async function loadPublicHighlights(
  signal?: AbortSignal,
): Promise<{ posts: PublicHighlight[]; fixture: boolean }> {
  const mode = await loadPublicReadMode({ signal });
  if (mode.mode === "legacy") {
    const { getAllBlogPosts } = await import("../data/blog");
    return {
      posts: getAllBlogPosts()
        .slice(0, 3)
        .map((post) => ({ ...post, coverAlt: post.title })),
      fixture: Boolean(mode.fixture),
    };
  }
  const snapshot = await loadPublicContent({ signal }),
    categories = new Map(snapshot.categories.map((item) => [item.id, item.name]));
  return {
    fixture: false,
    posts: [...snapshot.posts]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug))
      .slice(0, 3)
      .map((post) => {
        const image =
          Object.values(snapshot.media)
            .filter(
              (item) =>
                item.file.startsWith(post.coverMediaId + "/") && /^[a-f0-9]{64}$/.test(item.hash),
            )
            .sort((a, b) => a.width - b.width)
            .find((item) => item.width >= 960) ??
          Object.values(snapshot.media).find((item) =>
            item.file.startsWith(post.coverMediaId + "/"),
          );
        return {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          category: categories.get(post.categoryId) ?? "",
          date: post.publishedAt,
          coverAlt: post.coverAlt,
          coverImage:
            image && /^[a-f0-9]{64}$/.test(image.hash)
              ? "/media/content/" +
                image.hash +
                "." +
                (image.mime === "image/jpeg" ? "jpg" : image.mime.split("/")[1])
              : "",
        };
      }),
  };
}

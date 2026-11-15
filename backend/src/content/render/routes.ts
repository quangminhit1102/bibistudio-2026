import { createHash } from "node:crypto";
import type { PublicSnapshot, PublishedPost } from "../contracts";
import { parsePublicSnapshot } from "../public-schema";
import { CONTENT_LIMITS as L } from "../limits";
export type PlannedRoute =
  | {
      kind: "html";
      file: string;
      indexable: boolean;
      contentType: "text/html" | "application/xml";
      page:
        | { kind: "listing"; number: number; categoryId: string | null }
        | { kind: "post"; id: string }
        | { kind: "sitemap" };
    }
  | { kind: "redirect"; location: string; status: 301 };
export const postPath = (slug: string) => "/blog/" + slug;
export const categoryPath = (slug: string) => "/blog/category/" + slug;
const indexes = new WeakMap<
  PublicSnapshot,
  { ancestors: Map<string, string[]>; posts: Map<string, PublishedPost[]> }
>();
function categoryIndex(snapshot: PublicSnapshot) {
  let index = indexes.get(snapshot);
  if (index) return index;
  const categories = new Map(snapshot.categories.map((category) => [category.id, category])),
    ancestors = new Map<string, string[]>(),
    posts = new Map<string, PublishedPost[]>();
  for (const category of snapshot.categories) {
    const result: string[] = [];
    let current: typeof category | undefined = category;
    while (current) {
      if (result.includes(current.id) || result.length >= L.categoryDepth)
        throw Error("Invalid category tree");
      result.push(current.id);
      current = current.parentId ? categories.get(current.parentId) : undefined;
    }
    ancestors.set(category.id, result);
    posts.set(category.id, []);
  }
  for (const post of snapshot.posts)
    for (const id of ancestors.get(post.categoryId) ?? []) posts.get(id)!.push(post);
  index = { ancestors, posts };
  indexes.set(snapshot, index);
  return index;
}
export function ancestorIds(snapshot: PublicSnapshot, id: string): string[] {
  return categoryIndex(snapshot).ancestors.get(id) ?? [];
}
export function categoryPosts(snapshot: PublicSnapshot, id: string) {
  return categoryIndex(snapshot).posts.get(id) ?? [];
}
export function sortedPosts<T extends { id: string; publishedAt: string }>(posts: T[]): T[] {
  return [...posts].sort(
    (a, b) =>
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
export function planPublicRoutes(raw: PublicSnapshot): Record<string, PlannedRoute> {
  const snapshot = parsePublicSnapshot(raw),
    routes: Record<string, PlannedRoute> = {};
  const html = (
    path: string,
    page: Extract<PlannedRoute, { kind: "html" }>["page"],
    indexable: boolean,
    xml = false,
  ) => {
    if (routes[path]) throw Error("Public canonical route collision");
    routes[path] = {
      kind: "html",
      file: xml
        ? "sitemap-blog.xml"
        : `pages/${createHash("sha256").update(path).digest("hex")}.html`,
      contentType: xml ? "application/xml" : "text/html",
      indexable,
      page,
    };
  };
  const aliases: Record<string, string> = { ...snapshot.redirects };
  function listing(path: string, categoryId: string | null, count: number) {
    const pages = Math.max(1, Math.ceil(count / L.pageSize));
    for (let number = 1; number <= pages; number++) {
      const target = number === 1 ? path : path + "/page/" + number;
      html(target, { kind: "listing", number, categoryId }, count > 0);
      aliases[target + "/"] = target;
      aliases[path + "?page=" + number] = target;
    }
    aliases[path + "/page/1"] = path;
    aliases[path + "/page/1/"] = path;
  }
  listing("/blog", null, snapshot.posts.length);
  for (const category of snapshot.categories)
    listing(categoryPath(category.slug), category.id, categoryPosts(snapshot, category.id).length);
  for (const post of snapshot.posts) {
    const path = postPath(post.slug);
    html(path, { kind: "post", id: post.id }, true);
    aliases[path + "/"] = path;
  }
  html("/sitemaps/blog.xml", { kind: "sitemap" }, false, true);
  for (const key of Object.keys(snapshot.redirects)) {
    if (
      !/^\/blog\/[a-z0-9/-]+$/.test(key) ||
      !key.split("/").every((part) => part !== "." && part !== "..")
    )
      throw Error("Invalid public redirect alias");
    if (routes[key]) throw Error("Redirect cannot replace a canonical owner");
    if (!key.endsWith("/")) aliases[key + "/"] = snapshot.redirects[key];
  }
  const resolved = new Map<string, string>();
  for (const source of Object.keys(aliases)) {
    if (routes[source]) throw Error("Public canonical route collision");
    let target = aliases[source];
    const seen = new Set([source]);
    while (aliases[target] !== undefined && !resolved.has(target)) {
      if (seen.has(target)) throw Error("Public redirect cycle");
      seen.add(target);
      target = aliases[target];
    }
    target = resolved.get(target) ?? target;
    if (routes[target]?.kind !== "html") throw Error("Public redirect target missing");
    resolved.set(source, target);
    routes[source] = { kind: "redirect", status: 301, location: target };
  }
  return routes;
}

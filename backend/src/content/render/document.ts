import { createHash } from "node:crypto";
import type {
  PublicSnapshot,
  PublicAssetManifest,
  RenderedGeneration,
  GenerationManifest,
  PublicRoute,
} from "../contracts";
import { parsePublicSnapshot, parsePublicAssets, publicOrigin } from "../public-schema";
import { CONTENT_LIMITS as L } from "../limits";
import { serverMediaId, escapeContentHtml as escape } from "../rich-policy";
import { planPublicRoutes, postPath } from "./routes";
import { createPresentation, header, footer, type PagePresentation } from "./presentation";
import { renderListing } from "./categories";
import { renderPost } from "./posts";
import { jsonScript, seoHead } from "./seo";
import { sitemapXml } from "./sitemap";
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
export function documentHtml(
  page: PagePresentation,
  assets: PublicAssetManifest,
  origin: string,
  path: string,
  indexable: boolean,
  bootstrap?: {
    schemaVersion: 1;
    generationId: string;
    routes: Array<{ path: string; label: string }>;
    path: string;
    canonicalOrigin: string;
  },
): string {
  return `<!doctype html><html lang="vi"><head>${seoHead({ ...page, path, origin, indexable })}${assets.css.map((url) => `<link rel="stylesheet" href="${escape(url)}">`).join("")}</head><body class="bg-background font-sans text-foreground antialiased">${header()}${page.body}${footer()}${bootstrap ? `<script id="bibi-content-bootstrap" type="application/json">${jsonScript(bootstrap)}</script><script type="module" src="${escape(assets.script)}"></script>` : ""}</body></html>`;
}
export async function renderContentGeneration(
  raw: PublicSnapshot,
  rawAssets: PublicAssetManifest,
  canonicalOrigin: string,
  previousId: string | null = null,
): Promise<RenderedGeneration> {
  const snapshot = parsePublicSnapshot(raw),
    assets = parsePublicAssets(rawAssets),
    origin = publicOrigin(canonicalOrigin),
    planned = planPublicRoutes(snapshot),
    p = createPresentation(snapshot, origin),
    postsById = new Map(snapshot.posts.map((post) => [post.id, post])),
    postsByPath = new Map(snapshot.posts.map((post) => [postPath(post.slug), post])),
    files = new Map<string, Uint8Array>(),
    fileHashes: Record<string, string> = {},
    routes: Record<string, PublicRoute> = {};
  let total = 0;
  if (previousId !== null && !serverMediaId(previousId))
    throw Error("Invalid previous generation ID");
  snapshot.routes = Object.entries(planned)
    .filter(([, route]) => route.kind === "html" && route.contentType === "text/html")
    .map(([path, route]) => {
      if (route.kind !== "html") throw Error("Invalid public route");
      const page = route.page;
      return {
        path,
        label:
          page.kind === "post"
            ? snapshot.posts.find((post) => post.id === page.id)!.title
            : page.kind === "listing" && page.categoryId
              ? p.categories.get(page.categoryId)!.name +
                (page.number > 1 ? " — Trang " + page.number : "")
              : "Nhật ký" +
                (page.kind === "listing" && page.number > 1 ? " — Trang " + page.number : ""),
      };
    });
  function add(file: string, body: string) {
    if (files.has(file)) throw Error("Duplicate generation file");
    const bytes = Buffer.from(body, "utf8");
    total += bytes.length;
    if (total > L.maxGenerationBytes) throw Error("Content generation exceeds its size limit");
    files.set(file, bytes);
    fileHashes[file] = hash(bytes);
    return fileHashes[file];
  }
  for (const [path, route] of Object.entries(planned)) {
    if (route.kind === "redirect") {
      routes[path] = route;
      continue;
    }
    if (route.page.kind === "sitemap") continue;
    const page = route.page,
      actual =
        page.kind === "post"
          ? renderPost(postsById.get(page.id)!, p)
          : renderListing(page.categoryId, page.number, p);
    const digest = add(
      route.file,
      documentHtml(actual, assets, origin, path, route.indexable, {
        schemaVersion: 1,
        generationId: snapshot.generationId,
        routes: snapshot.routes,
        path,
        canonicalOrigin: origin,
      }),
    );
    routes[path] = {
      kind: "html",
      file: route.file,
      sha256: digest,
      indexable: route.indexable,
      contentType: route.contentType,
    };
  }
  const blogXml = sitemapXml(
      Object.entries(planned)
        .filter(([, route]) => route.kind === "html" && route.indexable)
        .map(([path]) => {
          const post = postsByPath.get(path);
          return { path, ...(post ? { lastmod: post.modifiedAt } : {}) };
        }),
      origin,
    ),
    xml = planned["/sitemaps/blog.xml"];
  if (xml.kind !== "html") throw Error("Public sitemap route missing");
  routes["/sitemaps/blog.xml"] = {
    kind: "html",
    file: xml.file,
    sha256: add(xml.file, blogXml),
    indexable: false,
    contentType: "application/xml",
  };
  const publicDataFile = "public.json",
    publicDataSha256 = add(publicDataFile, JSON.stringify(snapshot));
  add("route-map.json", JSON.stringify(routes));
  const media: GenerationManifest["media"] = {};
  for (const image of Object.values(snapshot.media)) {
    const key = image.hash + "." + (image.mime === "image/jpeg" ? "jpg" : image.mime.split("/")[1]),
      existing = media[key];
    if (
      existing &&
      (existing.mime !== image.mime ||
        existing.bytes !== image.bytes ||
        existing.width !== image.width ||
        existing.height !== image.height)
    )
      throw Error("Conflicting public media hash");
    if (!existing || image.file < existing.file) media[key] = image;
  }
  return {
    manifest: {
      schemaVersion: 1,
      id: snapshot.generationId,
      previousId,
      rendererVersion: assets.rendererVersion,
      publicDataFile,
      publicDataSha256,
      routes,
      media,
      assets: [...new Set(assets.assets)],
      fileHashes,
    },
    files,
  };
}

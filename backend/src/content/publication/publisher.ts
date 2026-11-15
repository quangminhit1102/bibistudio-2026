import type { Pool } from "mysql2/promise";
import type { Clock } from "../../config";
import type { ContentPaths, PublicAssetManifest } from "../contracts";
import type { ContentMedia } from "../media/service";
import { renderContentGeneration } from "../render/document";
import { readActiveContent, readGeneration, digest } from "./active-read";
import { createGenerationStore } from "./store";
import { createPublicationJobs } from "./jobs";
import { runNextPublication, type PublicationContext, type ActiveGeneration } from "./worker";
export async function publicContentCanary(
  paths: ContentPaths,
  origin: string,
  active: ActiveGeneration | null,
): Promise<void> {
  if (!active) return;
  const previous = active.manifest.previousId
      ? await readGeneration(paths, active.manifest.previousId)
      : null,
    oldPosts = new Map(previous?.snapshot.posts.map((post) => [post.id, post.snapshotId]) ?? []),
    targets = new Set(["/blog", "/sitemaps/blog.xml"]);
  for (const post of active.snapshot.posts)
    if (oldPosts.get(post.id) !== post.snapshotId) targets.add("/blog/" + post.slug);
  for (const path of Object.keys(previous?.manifest.routes ?? {}))
    if (
      previous!.manifest.routes[path].kind === "html" &&
      (!active.manifest.routes[path] || active.manifest.routes[path].kind === "redirect")
    )
      targets.add(path);
  for (const path of targets) {
    const expected = active.manifest.routes[path],
      url = new URL(path, origin);
    url.searchParams.set("utm_bibi_canary", active.manifest.id);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.headers.get("cache-control")?.includes("no-store"))
      throw Error("Public content cache canary failed");
    if (!expected) {
      if (response.status !== 404) throw Error("Public removal canary failed");
      continue;
    }
    if (expected.kind === "redirect") {
      if (
        response.status !== 301 ||
        new URL(response.headers.get("location") ?? "", origin).href !==
          new URL(expected.location, origin).href
      )
        throw Error("Public redirect canary failed");
      continue;
    }
    if (
      response.status !== 200 ||
      !response.headers.get("content-type")?.startsWith(expected.contentType)
    )
      throw Error("Public document status canary failed");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== expected.sha256) throw Error("Public document bytes canary failed");
  }
  if ((await readActiveContent(paths))?.manifest.id !== active.manifest.id)
    throw Error("Public canary pointer changed");
}
export function createContentPublication(deps: {
  pool: Pool;
  clock: Clock;
  paths: ContentPaths;
  media: ContentMedia;
  assets: PublicAssetManifest;
  assetRoot: string;
  origin: string;
  wake?: () => void;
  canary?: PublicationContext["canary"];
  store?: PublicationContext["store"];
  render?: PublicationContext["render"];
  assertWritable?: PublicationContext["assertWritable"];
}) {
  const context: PublicationContext = {
    ...deps,
    store: deps.store ?? createGenerationStore(deps.paths, deps.assetRoot),
    render: deps.render ?? renderContentGeneration,
    canary: deps.canary ?? ((active) => publicContentCanary(deps.paths, deps.origin, active)),
    assertWritable: deps.assertWritable ?? (async () => {}),
  };
  const jobs = createPublicationJobs({ ...deps, wake: deps.wake ?? (() => {}) });
  return {
    ...jobs,
    context,
    reconcile: async () => {
      while (await runNextPublication(context)) {
        /* drain durable queue under one environment lease per job */
      }
    },
  };
}
export type ContentPublication = ReturnType<typeof createContentPublication>;

import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Pool } from "mysql2/promise";
import type { ReleaseInfo } from "../release";
import { permissionDefinitions } from "../authorization/registry";
import type { ContentMode, ContentPaths } from "./contracts";
import { CONTENT_LIMITS } from "./limits";
export function readContentCapabilities(release: ReleaseInfo): {
  mode: ContentMode;
  publicReaderVersion: 1;
  canWrite: boolean;
} {
  const mode =
    release.schemaVersion === 7 &&
    release.content?.mode === "cms" &&
    release.content.publicReaderVersion === 1
      ? "cms"
      : "bridge";
  return { mode, publicReaderVersion: 1, canWrite: mode === "cms" };
}
export async function syncContentPermissions(pool: Pool): Promise<void> {
  for (const permission of permissionDefinitions.filter(
    (item) =>
      item.code.startsWith("content_category.") ||
      ["post.publish", "post.restore"].includes(item.code),
  ))
    await pool.execute("INSERT IGNORE INTO permissions(id,code,description) VALUES(?,?,?)", [
      permission.code,
      permission.code,
      permission.description,
    ]);
}
export function readContentPaths(env: NodeJS.ProcessEnv): ContentPaths | undefined {
  if (!env.BIBI_CONTENT_ROOT) return;
  const root = resolve(env.BIBI_CONTENT_ROOT),
    deployRoot = dirname(root),
    deployLock = join(deployRoot, "deploy.lock");
  if (!isAbsolute(env.BIBI_CONTENT_ROOT)) throw Error("Absolute content root required");
  if (
    env.NODE_ENV === "production" &&
    (!env.BIBI_PRIVATE_ENV_FILE ||
      root !== resolve(dirname(env.BIBI_PRIVATE_ENV_FILE), "../content"))
  )
    throw Error("Fixed private content root required");
  const managedRoots: unknown = env.BIBI_CONTENT_MANAGED_ROOTS
    ? JSON.parse(env.BIBI_CONTENT_MANAGED_ROOTS)
    : [deployRoot];
  if (
    !Array.isArray(managedRoots) ||
    !managedRoots.length ||
    managedRoots.some((value) => typeof value !== "string" || !isAbsolute(value))
  )
    throw Error("Absolute managed roots required");
  return {
    root,
    media: join(root, "media"),
    generations: join(root, "generations"),
    active: join(root, "active"),
    deployLock,
    managedRoots,
    maxManagedBytes: 4 * 1024 ** 3,
    maxContentBytes: CONTENT_LIMITS.maxContentBytes,
    maxGenerationBytes: CONTENT_LIMITS.maxGenerationBytes,
    minHeadroomBytes: CONTENT_LIMITS.minHeadroomBytes,
  };
}

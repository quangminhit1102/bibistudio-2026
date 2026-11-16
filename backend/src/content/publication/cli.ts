import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve, dirname } from "node:path";
import { readPrivateEnvironment } from "../../db/private-env";
import { readDbConfig, systemClock } from "../../config";
import { createDbPool } from "../../db/pool";
import { readRelease } from "../../release";
import { readContentPaths, readContentCapabilities } from "../capabilities";
import { contentEnvironment } from "../cli";
import { createContentMedia } from "../media/service";
import { parsePublicAssets, publicOrigin } from "../public-schema";
import { createContentPublication } from "./publisher";
import { contentNodeArgs } from "../runtime-entry";
export function publicationBuildConfig(env: NodeJS.ProcessEnv) {
  const root = env.BIBI_CONTENT_ASSET_ROOT;
  if (!root || !isAbsolute(root)) throw Error("Absolute public asset root required");
  const local = env.NODE_ENV !== "production" ? env.BIBI_CONTENT_ASSETS_FILE : undefined;
  if (local && !isAbsolute(local)) throw Error("Absolute local content assets file required");
  return {
    assetRoot: root,
    assets: parsePublicAssets(
      JSON.parse(readFileSync(local ?? resolve(__dirname, "../../../content-assets.json"), "utf8")),
    ),
    origin: publicOrigin(
      env.NODE_ENV === "production"
        ? "https://bibistudio.vn"
        : (env.BIBI_CONTENT_ORIGIN ?? "http://127.0.0.1:5173"),
    ),
  };
}
export function publicationAuthority(env: NodeJS.ProcessEnv) {
  return async () => {
    if (env.NODE_ENV !== "production") return;
    const paths = readContentPaths({ ...env, BIBI_PRIVATE_ENV_FILE: env.BIBI_PRIVATE_ENV_FILE });
    if (!paths) throw Error("Content environment unavailable");
    const current = JSON.parse(
      readFileSync(resolve(dirname(paths.root), "current/manifest.json"), "utf8"),
    );
    if (!readContentCapabilities(current).canWrite)
      throw Error("Current application has disabled publication");
  };
}
/** Fixed entry, no job payload or credentials in argv; environment lock fences all instances. */
export function createPublicationWakeup(env: NodeJS.ProcessEnv) {
  const file = env.BIBI_PRIVATE_ENV_FILE;
  let child: ReturnType<typeof spawn> | undefined,
    last = 0;
  return () => {
    if (!file || !isAbsolute(file) || child || Date.now() - last < 1000) return;
    last = Date.now();
    child = spawn(process.execPath, contentNodeArgs(__filename), {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
      env: {
        PATH: env.PATH,
        SystemRoot: env.SystemRoot,
        WINDIR: env.WINDIR,
        NODE_ENV: env.NODE_ENV,
        BIBI_PRIVATE_ENV_FILE: file,
        BIBI_RELEASE_MANIFEST: env.BIBI_RELEASE_MANIFEST,
      },
    });
    const owned = child;
    owned.once("exit", () => {
      if (child === owned) child = undefined;
    });
    owned.once("error", () => {
      if (child === owned) child = undefined;
    });
    owned.unref();
  };
}
async function main() {
  if (process.argv.length !== 2) throw Error("Publication worker takes no arguments");
  const file = process.env.BIBI_PRIVATE_ENV_FILE,
    env = readPrivateEnvironment(file);
  env.NODE_ENV = process.env.NODE_ENV;
  env.BIBI_PRIVATE_ENV_FILE = file;
  contentEnvironment(file, env);
  if (!readContentCapabilities(readRelease()).canWrite)
    throw Error("Publication is disabled for this release");
  const paths = readContentPaths({ ...env, BIBI_PRIVATE_ENV_FILE: file });
  if (!paths) throw Error("Private content paths required");
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 2 });
  try {
    const publication = createContentPublication({
      pool,
      clock: systemClock,
      paths,
      media: createContentMedia({ pool, clock: systemClock, paths }),
      ...publicationBuildConfig(env),
      assertWritable: publicationAuthority(env),
    });
    await publication.reconcile();
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Content worker failed; inspect authenticated publication status",
      }),
    );
    process.exitCode = 1;
  });

import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
  readFile,
  stat,
  symlink,
  unlink,
  mkdir,
  mkdtemp,
  writeFile,
  rmdir,
} from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { validateBundle } from "./build.mjs";
import { isMain, root } from "./runtime.mjs";
import { startLocalAnalyticsRelay, proxyLocalRelay } from "./local-analytics-relay.mjs";
import { startLocalContent } from "./local-content.mjs";
import {
  isLocalContentPath,
  isLocalContentBoundary,
  proxyLocalContent,
  serveLocalContentAsset,
} from "./local-content-proxy.mjs";
import { localEnvironmentText } from "./local-env.mjs";

export async function previewRelease(
  bundleDir,
  { port = 4173, host = "127.0.0.1", runtimeEnv = process.env } = {},
) {
  bundleDir = resolve(bundleDir);
  const manifest = await validateBundle(bundleDir);
  if (
    manifest.database &&
    (runtimeEnv.NODE_ENV === "production" ||
      !["127.0.0.1", "localhost", "::1"].includes(runtimeEnv.DB_HOST) ||
      !/^(?:bibi_local|bibi_test_[a-f0-9]{12,32})$/.test(runtimeEnv.DB_NAME ?? ""))
  )
    throw Error("Preview requires an isolated local database");
  runtimeEnv = { ...runtimeEnv, BIBI_RELEASE_MANIFEST: join(bundleDir, "manifest.json") };
  // Local preview resolves the exact already-installed backend dependency set;
  // the archive was produced before this temporary link and never includes it.
  const dependencyLink = join(bundleDir, "backend/node_modules");
  await symlink(
    join(root, "backend/node_modules"),
    dependencyLink,
    process.platform === "win32" ? "junction" : "dir",
  );
  const require = createRequire(join(bundleDir, "backend/package.json"));
  let runtime, api, relay, previewPrivateDirectory, previewPrivateFile;
  try {
    const { createApp } = require(join(bundleDir, "backend/dist/app.js"));
    if (manifest.database)
      runtime = require(join(bundleDir, "backend/dist/runtime.js")).createRuntime(runtimeEnv);
    if (manifest.profiles && !runtime?.appOptions?.profiles)
      throw new Error("Profile preview requires explicit local setup and private asset directory");
    api = createApp(manifest, runtime?.appOptions);
  } catch (error) {
    await runtime?.close();
    await unlink(dependencyLink);
    throw error;
  }
  const publicRoot = join(bundleDir, "frontend");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".js": "application/javascript",
    ".css": "text/css",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  const server = createServer(async (req, res) => {
    try {
      if (runtimeEnv.BIBI_CONTENT_ROOT && isLocalContentBoundary(req.url ?? "")) {
        if (!isLocalContentPath(req.url ?? "") || !relay) {
          res.writeHead(relay ? 404 : 503, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return res.end(req.method === "HEAD" ? undefined : "Nội dung chưa sẵn sàng");
        }
        return proxyLocalContent(req, res, relay.url);
      }
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname === "/api/analytics/relay/collect.php" && relay)
        return proxyLocalRelay(req, res, relay.url);
      if (pathname === "/api" || pathname.startsWith("/api/")) return api(req, res);
      if (await serveLocalContentAsset(req, res, runtimeEnv.BIBI_CONTENT_ASSET_ROOT)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      let file = resolve(publicRoot, "." + pathname);
      if (
        (file !== publicRoot && !file.startsWith(publicRoot + sep)) ||
        pathname.split("/").some((p) => p.startsWith("."))
      ) {
        res.writeHead(404);
        return res.end();
      }
      let info;
      try {
        info = await stat(file);
      } catch {}
      if (!info?.isFile()) {
        if (extname(pathname)) {
          res.writeHead(404);
          return res.end();
        }
        file = join(publicRoot, "index.html");
      }
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      res.writeHead(500);
      res.end("Preview error");
    }
  });
  try {
    await new Promise((done, reject) => {
      server.once("error", reject);
      server.listen(port, host, done);
    });
  } catch (error) {
    await runtime?.close();
    await unlink(dependencyLink);
    throw error;
  }
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  let closing;
  const close = () =>
    (closing ??= (async () => {
      await new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      });
      await runtime?.close();
      await relay?.close();
      await unlink(dependencyLink);
      if (previewPrivateFile) await unlink(previewPrivateFile);
      if (previewPrivateDirectory) await rmdir(previewPrivateDirectory);
    })());
  try {
    if (runtimeEnv.BIBI_CONTENT_ROOT) {
      await runtime?.close();
      await mkdir(join(root, ".superpowers"), { recursive: true });
      previewPrivateDirectory = await mkdtemp(join(root, ".superpowers/content-preview-"));
      previewPrivateFile = join(previewPrivateDirectory, "runtime.env");
      runtimeEnv = {
        ...runtimeEnv,
        NODE_ENV: "development",
        BIBI_CONTENT_ORIGIN: url,
        BIBI_PRIVATE_ENV_FILE: previewPrivateFile,
        AUTH_ALLOWED_ORIGINS: [
          ...new Set([
            ...(runtimeEnv.AUTH_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
            url,
            `http://localhost:${address.port}`,
          ]),
        ].join(","),
      };
      const privateValues = Object.fromEntries(
        Object.entries(runtimeEnv).filter(
          ([key, value]) =>
            /^(?:DB_|AUTH_|ANALYTICS_|GEOIP_|PROFILE_|BIBI_CONTENT_|BIBI_RELEASE_MANIFEST$|RELEASE_PROBE_SECRET$|NODE_ENV$)/.test(
              key,
            ) && typeof value === "string",
        ),
      );
      await writeFile(previewPrivateFile, localEnvironmentText(privateValues), {
        mode: 0o600,
        flag: "wx",
      });
      runtime = require(join(bundleDir, "backend/dist/runtime.js")).createRuntime(runtimeEnv);
      api = require(join(bundleDir, "backend/dist/app.js")).createApp(manifest, runtime.appOptions);
    }
    if (runtime?.appOptions?.analytics?.relaySecret) {
      const origins = runtime.appOptions.config.allowedOrigins;
      for (const origin of [url, `http://localhost:${address.port}`])
        if (!origins.includes(origin)) origins.push(origin);
      const startPhp = runtimeEnv.BIBI_CONTENT_ROOT ? startLocalContent : startLocalAnalyticsRelay;
      relay = await startPhp({
        env: { ...runtimeEnv, AUTH_ALLOWED_ORIGINS: origins.join(",") },
        backendPort: address.port,
        frontendPort: address.port,
        sourceDirectory: join(bundleDir, "backend/relay"),
      });
    }
    runtime?.start?.();
  } catch (error) {
    await close();
    throw error;
  }
  console.log(`BIBI_PREVIEW ${url}/api-test`);
  return {
    url,
    relayUrl: relay?.url,
    close,
  };
}
if (isMain(import.meta.url)) {
  try {
    process.loadEnvFile(join(root, ".env.local"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.env.BIBI_PRIVATE_ENV_FILE) process.loadEnvFile(process.env.BIBI_PRIVATE_ENV_FILE);
  const app = await previewRelease(process.argv[2], {
    port: Number(process.env.PREVIEW_PORT ?? 4173),
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}

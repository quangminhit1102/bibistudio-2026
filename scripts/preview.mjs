import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, stat, symlink, unlink } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { validateBundle } from "./build.mjs";
import { isMain, root } from "./runtime.mjs";

export async function previewRelease(bundleDir, { port = 4173, host = "127.0.0.1" } = {}) {
  bundleDir = resolve(bundleDir);
  const manifest = await validateBundle(bundleDir);
  // Local preview resolves the exact already-installed backend dependency set;
  // the archive was produced before this temporary link and never includes it.
  const dependencyLink = join(bundleDir, "backend/node_modules");
  await symlink(
    join(root, "backend/node_modules"),
    dependencyLink,
    process.platform === "win32" ? "junction" : "dir",
  );
  const require = createRequire(join(bundleDir, "backend/package.json"));
  const { createApp } = require(join(bundleDir, "backend/dist/app.js"));
  const api = createApp(manifest);
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
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname === "/api" || pathname.startsWith("/api/")) return api(req, res);
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
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, host, done);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`BIBI_PREVIEW ${url}/api-test`);
  return {
    url,
    close: async () => {
      await new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      });
      await unlink(dependencyLink);
    },
  };
}
if (isMain(import.meta.url)) {
  const app = await previewRelease(process.argv[2], {
    port: Number(process.env.PREVIEW_PORT ?? 4173),
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}

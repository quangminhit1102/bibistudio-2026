import { lstat, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { request } from "node:http";
export const isLocalContentPath = (path) =>
  /^\/(?:blog(?:[/?]|$)|sitemap\.xml(?:[/?]|$)|sitemaps\/blog\.xml(?:[/?]|$)|media\/content(?:[/?]|$))/.test(
    path,
  );
export function isLocalContentBoundary(value) {
  const path = value.split("?", 1)[0];
  if (isLocalContentPath(path)) return true;
  try {
    return isLocalContentPath(decodeURIComponent(path));
  } catch {
    return false;
  }
}
export function proxyLocalContent(req, res, url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url) || !isLocalContentPath(req.url ?? ""))
    throw Error("Invalid local content target");
  const target = new URL(url),
    headers = { ...req.headers };
  delete headers.host;
  const outgoing = request(
    { hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers },
    (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
      incoming.on("error", () => res.destroy());
    },
  );
  outgoing.setTimeout(10000, () => outgoing.destroy(new Error("Local content timeout")));
  outgoing.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(503, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end("Nội dung chưa sẵn sàng");
    } else res.destroy();
  });
  req.on("aborted", () => outgoing.destroy());
  res.on("close", () => {
    if (!res.writableFinished) outgoing.destroy();
  });
  req.pipe(outgoing);
}
export async function serveLocalContentAsset(req, res, directory) {
  const path = (req.url ?? "").split("?")[0];
  if (!directory || !/^\/assets\/[A-Za-z0-9_-]+\.(?:js|css|woff2?|webp|png|jpg|svg)$/.test(path))
    return false;
  const file = join(directory, path.slice(1));
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || (await realpath(file)) !== resolve(file))
      return false;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return true;
  }
  res.writeHead(200, {
    "Content-Type": path.endsWith(".js")
      ? "application/javascript"
      : path.endsWith(".css")
        ? "text/css"
        : path.endsWith(".woff2")
          ? "font/woff2"
          : path.endsWith(".svg")
            ? "image/svg+xml"
            : "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") res.end();
  else
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  return true;
}

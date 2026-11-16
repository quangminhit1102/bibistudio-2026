import { mkdtemp, writeFile, unlink, rmdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./runtime.mjs";
import { startPhpRelay } from "./php-relay.mjs";
import { request as httpRequest } from "node:http";
/** Local-only composition; no production env, secrets in arguments, or extra developer command. */
export async function startLocalAnalyticsRelay({
  env = process.env,
  backendPort,
  frontendPort,
  sourceDirectory = join(root, "backend/relay"),
  signal,
  routerFile,
  content,
} = {}) {
  const secret = env.ANALYTICS_RELAY_SECRET;
  if (
    !secret ||
    !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
    Buffer.from(secret, "base64url").toString("base64url") !== secret
  )
    throw new Error("Local relay configuration missing; run npm run db:setup:local");
  if (
    !Number.isInteger(backendPort) ||
    backendPort < 1 ||
    backendPort > 65535 ||
    !Number.isInteger(frontendPort) ||
    frontendPort < 1 ||
    frontendPort > 65535
  )
    throw new Error("Invalid local relay port");
  const hostNetwork = process.platform !== "win32";
  const targetUrl = `http://${hostNetwork ? "127.0.0.1" : "host.docker.internal"}:${backendPort}/api/analytics/collect`;
  const origins = [
    ...new Set([
      ...(env.AUTH_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
      `http://localhost:${frontendPort}`,
      `http://127.0.0.1:${frontendPort}`,
    ]),
  ];
  await mkdir(join(root, ".superpowers"), { recursive: true });
  const directory = await mkdtemp(join(root, ".superpowers/local-php-relay-"));
  const configFile = join(directory, "config.json");
  const contentConfigFile = join(directory, "content-reader.json");
  let relay, closing;
  const close = () =>
    (closing ??= (async () => {
      signal?.removeEventListener("abort", onAbort);
      await relay?.close();
      await unlink(configFile).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      await unlink(contentConfigFile).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      await rmdir(directory);
    })());
  const onAbort = () => {
    void close().catch(() => {});
  };
  try {
    await writeFile(
      configFile,
      JSON.stringify({ environment: "local", secret, targetUrl, origins }),
      { mode: 0o600, flag: "wx" },
    );
    if (content)
      await writeFile(
        contentConfigFile,
        JSON.stringify({
          schemaVersion: 1,
          environment: "local",
          contentRoot: "/content",
          canonicalOrigin: content.origin,
        }),
        { mode: 0o600, flag: "wx" },
      );
    relay = await startPhpRelay({
      port: 0,
      targetUrl,
      configFile,
      sourceDirectory,
      signal,
      routerFile,
      hostNetwork,
      ...(content
        ? {
            content: {
              root: content.root,
              readerFile: content.readerFile,
              configFile: contentConfigFile,
            },
          }
        : {}),
    });
    if (signal?.aborted) {
      await close();
      throw new Error("Local relay start aborted");
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    return { url: relay.url, configFile, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Fixed local collector proxy used by the compiled preview, never a URL from the request. */
export function proxyLocalRelay(req, res, url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error("Invalid local PHP target");
  const headers = { ...req.headers };
  delete headers.host;
  const outgoing = httpRequest(
    new URL("/api/analytics/relay/collect.php", url),
    { method: req.method, headers },
    (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
      incoming.on("error", () => res.destroy());
    },
  );
  outgoing.setTimeout(6000, () => outgoing.destroy(new Error("Local relay timeout")));
  outgoing.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end('{"error":{"code":"LOCAL_RELAY_UNAVAILABLE"}}');
    } else res.destroy();
  });
  req.on("aborted", () => outgoing.destroy());
  res.on("close", () => {
    if (!res.writableFinished) outgoing.destroy();
  });
  req.pipe(outgoing);
}

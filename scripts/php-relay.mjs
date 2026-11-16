import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
const exec = promisify(execFile);
export const PHP_IMAGE =
  "php:8.4-cli@sha256:d63e8b80cd4c6cfd01cfa7c910522e299cdc7ca1a2b6d6563db48df3c17e6c55";
const runDocker = (args, { timeout = 25000 } = {}) =>
  exec(
    "docker",
    [
      ...(process.env.DOCKER_CONTEXT
        ? ["--context", process.env.DOCKER_CONTEXT]
        : process.platform === "win32"
          ? ["--context", "desktop-linux"]
          : []),
      ...args,
    ],
    {
      env: { ...process.env, DOCKER_API_VERSION: process.env.DOCKER_API_VERSION ?? "1.43" },
      windowsHide: true,
      timeout,
      maxBuffer: 1024 * 1024,
    },
  );

export async function ensurePhpImage(run = runDocker) {
  try {
    await run(["image", "inspect", PHP_IMAGE]);
  } catch {
    await run(["pull", PHP_IMAGE], { timeout: 120000 });
  }
}
export async function startPhpRelay({
  port = 0,
  targetUrl,
  configFile,
  sourceDirectory,
  signal,
  routerFile,
  hostNetwork = false,
  content,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid PHP relay port");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  if (config.targetUrl !== targetUrl || config.environment !== "local")
    throw new Error("PHP local config target mismatch");
  await stat(sourceDirectory);
  if (content) {
    for (const path of [content.root, content.configFile, content.readerFile]) {
      const info = await stat(path);
      if (!info.isFile() && !info.isDirectory()) throw new Error("Invalid local content mount");
    }
  }
  if (hostNetwork && !port) {
    const reservation = createServer();
    await new Promise((done, reject) => {
      reservation.once("error", reject);
      reservation.listen(0, "127.0.0.1", done);
    });
    port = reservation.address().port;
    await new Promise((done) => reservation.close(done));
  }
  if (signal?.aborted) throw new Error("PHP relay start aborted");
  const id = randomUUID(),
    name = "bibi-php-relay-" + id;
  const label = "com.bibi.local-relay";
  await ensurePhpImage();
  if (signal?.aborted) throw new Error("PHP relay start aborted");
  const docker = runDocker;
  let stopped = false;
  let closePromise;
  const close = () =>
    (closePromise ??= (async () => {
      stopped = true;
      signal?.removeEventListener("abort", onAbort);
      try {
        const { stdout } = await docker([
          "inspect",
          "--format",
          `{{index .Config.Labels "${label}"}}`,
          name,
        ]);
        // A failed docker start can leave a created (never-running) container;
        // `stop` alone does not remove that state even with --rm.
        if (stdout.trim() === id) await docker(["rm", "--force", name]);
      } catch (error) {
        if (!/No such (object|container)/i.test(error.stderr ?? ""))
          throw new Error("PHP relay cleanup failed");
      }
    })());
  const onAbort = () => {
    void close().catch(() => {});
  };
  try {
    const args = [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--label",
      label + "=" + id,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "--add-host",
      "host.docker.internal:host-gateway",
      ...(hostNetwork ? ["--network", "host"] : ["--publish", `127.0.0.1:${port || ""}:8080`]),
      "--mount",
      `type=bind,source=${resolve(sourceDirectory)},target=/relay,readonly`,
      "--mount",
      `type=bind,source=${resolve(configFile)},target=/private/config.json,readonly`,
      "--mount",
      `type=bind,source=${fileURLToPath(new URL("./php-relay-router.php", import.meta.url))},target=/router/default.php,readonly`,
      "--env",
      "BIBI_RELAY_CONFIG_FILE=/private/config.json",
    ];
    if (routerFile)
      args.push(
        "--mount",
        `type=bind,source=${resolve(routerFile)},target=/router/custom.php,readonly`,
      );
    if (content)
      args.push(
        "--mount",
        `type=bind,source=${resolve(content.root)},target=/content,readonly`,
        "--mount",
        `type=bind,source=${resolve(content.configFile)},target=/private/content-reader.json,readonly`,
        "--mount",
        `type=bind,source=${resolve(content.readerFile)},target=/reader/content-reader.php,readonly`,
      );
    args.push(
      PHP_IMAGE,
      "php",
      "-d",
      "display_errors=0",
      "-d",
      "log_errors=0",
      "-S",
      hostNetwork ? `127.0.0.1:${port}` : "0.0.0.0:8080",
      routerFile ? "/router/custom.php" : "/router/default.php",
    );
    await docker(args);
    if (signal?.aborted) throw new Error("PHP relay start aborted");
    signal?.addEventListener("abort", onAbort, { once: true });
    let hostPort = port;
    if (!hostNetwork) {
      const { stdout } = await docker(["port", name, "8080/tcp"]);
      const match = /127\.0\.0\.1:(\d+)/.exec(stdout);
      if (!match) throw new Error("PHP relay port unavailable");
      hostPort = Number(match[1]);
    }
    const url = "http://127.0.0.1:" + hostPort;
    const deadline = Date.now() + 15000;
    for (;;) {
      if (stopped || signal?.aborted) throw new Error("PHP relay start aborted");
      try {
        const r = await fetch(url + "/__relay-ready", { signal: AbortSignal.timeout(1000) });
        const ready = await r.json();
        if (r.ok && ready.runtime === "php") break;
      } catch {
        /* Retry bounded startup only. */
      }
      if (Date.now() >= deadline) throw new Error("PHP relay readiness timeout");
      await new Promise((r) => setTimeout(r, 100));
    }
    return { url, close };
  } catch (error) {
    await close();
    throw error;
  }
}

import { createServer as createViteServer, createLogger } from "vite";
import { join } from "node:path";
import { root, isMain } from "./runtime.mjs";
import { spawnOwned, stopOwned, assertPortsFree } from "./process-group.mjs";

export async function startDevelopment({
  frontendPort = 5173,
  backendPort = 3001,
  inspectorPort = 9230,
  host = "127.0.0.1",
  signal,
} = {}) {
  await assertPortsFree([frontendPort, backendPort, inspectorPort]);
  process.env.BACKEND_PORT = String(backendPort);
  const logger = createLogger();
  for (const level of ["info", "warn", "error"]) {
    const original = logger[level].bind(logger);
    logger[level] = (msg, options) => original(`[FE] ${msg}`, options);
  }
  let vite;
  let closed = false;
  const child = spawnOwned(
    process.execPath,
    [
      join(root, "backend/node_modules/tsx/dist/cli.mjs"),
      "watch",
      `--inspect=127.0.0.1:${inspectorPort}`,
      "src/server.ts",
    ],
    {
      cwd: join(root, "backend"),
      env: {
        ...process.env,
        PORT: String(backendPort),
        HOST: "127.0.0.1",
        NODE_ENV: "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let closePromise;
  const close = () =>
    (closePromise ??= (async () => {
      closed = true;
      await stopOwned([child]);
      await vite?.close();
    })());
  signal?.addEventListener(
    "abort",
    () => {
      void close();
    },
    { once: true },
  );
  child.stdout.on("data", (data) => process.stdout.write(`[BE] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[BE] ${data}`));
  child.once("error", (error) => {
    console.error(`[BE] ${error.message}`);
    process.exitCode = 1;
    void close();
  });
  child.once("exit", (code) => {
    if (!closed) {
      console.error(`[BE] process exited (${code})`);
      process.exitCode = 1;
      void close();
    }
  });
  try {
    vite = await createViteServer({
      configFile: join(root, "vite.local.config.ts"),
      root,
      customLogger: logger,
      server: { host, port: frontendPort, strictPort: true },
    });
    if (closed || signal?.aborted) {
      await vite.close();
      throw new Error("Development startup cancelled");
    }
    await vite.listen();
    let ready = false;
    const deadline = Date.now() + 30000;
    while (!closed && Date.now() < deadline) {
      try {
        const r = await fetch(`http://127.0.0.1:${backendPort}/api/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (r.ok && (await r.json()).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!ready)
      throw new Error("Backend did not become ready within 30 seconds; inspect [BE] output");
    console.log(
      `[FE] READY http://localhost:${frontendPort}/api-test\n[BE] READY http://127.0.0.1:${backendPort}/api/health\n[BE] Debug: 127.0.0.1:${inspectorPort} (attach, no pause)`,
    );
    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
if (isMain(import.meta.url)) {
  let service;
  const controller = new AbortController();
  const args = process.argv.slice(2);
  const value = (key) => {
    const i = args.indexOf(key);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const startup = startDevelopment({
    frontendPort: Number(value("--port") ?? process.env.FRONTEND_PORT ?? 5173),
    backendPort: Number(process.env.BACKEND_PORT ?? 3001),
    inspectorPort: Number(process.env.INSPECTOR_PORT ?? 9230),
    host: value("--host") ?? "127.0.0.1",
    signal: controller.signal,
  })
    .then((app) => {
      service = app;
    })
    .catch((error) => {
      console.error(error.message);
      if (!controller.signal.aborted) process.exitCode = 1;
    });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      controller.abort();
      await startup;
      await service?.close();
      process.exit(0);
    });
}

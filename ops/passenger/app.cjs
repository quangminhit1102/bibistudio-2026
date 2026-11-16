"use strict";
const path = require("node:path");
const fs = require("node:fs");
const current = fs.realpathSync(path.resolve(__dirname, "../current"));
const manifest = JSON.parse(fs.readFileSync(path.join(current, "manifest.json"), "utf8"));
const http = require("node:http");
if (manifest.isBaseline) {
  http
    .createServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end('{"error":"API not active in baseline release"}');
    })
    .listen();
} else {
  const { createApp } = require(path.join(current, "backend/dist/app.js"));
  let runtime;
  if (manifest.database) {
    const { readPrivateEnvironment } = require(
      path.join(current, "backend/dist/db/private-env.js"),
    );
    const { createRuntime } = require(path.join(current, "backend/dist/runtime.js"));
    const privateFile = path.resolve(__dirname, "../private/runtime.env");
    const env = readPrivateEnvironment(privateFile);
    runtime = createRuntime({
      ...env,
      NODE_ENV: "production",
      BIBI_PRIVATE_ENV_FILE: privateFile,
      BIBI_RELEASE_MANIFEST: path.join(current, "manifest.json"),
    });
  }
  const server = http.createServer(
    createApp(
      {
        releaseId: manifest.releaseId,
        sourceSha: manifest.sourceSha,
        schemaVersion: manifest.schemaVersion,
        ...(manifest.content ? { content: manifest.content } : {}),
        ...(manifest.contentPublic ? { contentPublic: manifest.contentPublic } : {}),
      },
      runtime?.appOptions,
    ),
  );
  server.listen();
  runtime?.start?.();
  let closing;
  const close = () =>
    (closing ??= new Promise((resolve) => {
      server.close(() => Promise.resolve(runtime?.close()).then(resolve));
    }));
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}

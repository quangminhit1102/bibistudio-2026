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
  http
    .createServer(createApp({ releaseId: manifest.releaseId, sourceSha: manifest.sourceSha }))
    .listen();
}

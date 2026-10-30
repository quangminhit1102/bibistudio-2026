import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { startDevelopment } from "./dev.mjs";
import { assertPortsFree } from "./process-group.mjs";
async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function until(fn) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (fn()) return;
    await delay(100);
  }
  throw new Error("Backend state transition did not arrive");
}
test(
  "actual dev watcher reports application failure and recovery, then frees all ports",
  { timeout: 45000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "bibi-dev-"));
    const entry = join(directory, "fixture.cjs");
    const healthy =
      "require('node:http').createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}));}).listen(Number(process.env.PORT),'127.0.0.1');";
    await writeFile(entry, healthy);
    const ports = await Promise.all([freePort(), freePort(), freePort()]);
    const states = [];
    let service;
    try {
      service = await startDevelopment({
        frontendPort: ports[0],
        backendPort: ports[1],
        inspectorPort: ports[2],
        backendEntry: entry,
        onBackendState: (state) => states.push(state),
      });
      assert.equal((await fetch(`http://127.0.0.1:${ports[0]}/api/health`)).status, 200);
      await writeFile(entry, "throw new Error('controlled watcher application failure');");
      await until(() => states.includes("unavailable"));
      assert.equal(
        (await fetch(`http://127.0.0.1:${ports[0]}/api-test`, { headers: { accept: "text/html" } }))
          .status,
        200,
      );
      await writeFile(entry, healthy + "\n");
      await until(() => states.at(-1) === "ready" && states.includes("unavailable"));
    } finally {
      await service?.close();
      await service?.close();
      await rm(directory, { recursive: true, force: true });
    }
    await assertPortsFree(ports);
  },
);

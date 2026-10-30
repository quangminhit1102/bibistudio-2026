import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { once } from "node:events";
import { spawnOwned, stopOwned, assertPortsFree } from "./process-group.mjs";

test("occupied ports are rejected instead of silently choosing another", async (t) => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(assertPortsFree([server.address().port]), /port.*in use/i);
});
test("owned process tree closes and repeated cleanup is safe", async () => {
  const child = spawnOwned(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    stdio: "ignore",
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await stopOwned([child]);
  await stopOwned([child]);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});
test("fatal child exit can clean up its sibling", async () => {
  const sibling = spawnOwned(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    stdio: "ignore",
  });
  const failing = spawnOwned(process.execPath, ["-e", "process.exit(3)"], { stdio: "ignore" });
  await once(failing, "exit");
  await stopOwned([sibling]);
  assert.ok(sibling.exitCode !== null || sibling.signalCode !== null);
});

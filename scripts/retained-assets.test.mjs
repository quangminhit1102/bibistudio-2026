import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { verifyRetainedAssets } from "./browser-smoke.mjs";
test("an already-open release can fetch its uncached old script after promotion", async () => {
  let current = "A";
  const assets = new Map([["/assets/A.js", "old release code"]]);
  const server = createServer((req, res) => {
    if (req.url === "/") return res.end(current);
    const body = assets.get(new URL(req.url, "http://localhost").pathname);
    if (!body) {
      res.writeHead(404);
      return res.end();
    }
    res.end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await (await fetch(base)).text(), "A");
    const retained = [{ url: base + "/assets/A.js", bytes: Buffer.from("old release code") }];
    current = "B";
    assets.set("/assets/B.js", "new release code");
    await verifyRetainedAssets(retained, fetch);
    assert.equal(await (await fetch(base)).text(), "B");
    assets.delete("/assets/A.js");
    await assert.rejects(verifyRetainedAssets(retained, fetch), /retained|old asset/i);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

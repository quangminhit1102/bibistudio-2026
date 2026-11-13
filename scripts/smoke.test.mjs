import { test } from "node:test";
import assert from "node:assert/strict";
import { smoke } from "./smoke.mjs";
test("ordinary HTTP smoke sends DNT so acceptance does not create visitor traffic", async () => {
  let seen;
  await assert.rejects(
    smoke({
      baseUrl: "https://example.invalid",
      expectedRelease: "x",
      expectedSha: "y",
      request: async (_url, options) => {
        seen = options;
        return Response.json({ releaseId: "wrong", sourceSha: "y" });
      },
    }),
  );
  assert.equal(seen?.headers?.DNT, "1");
});
test("smoke rejects HTML API fallback and mismatched versions", async () => {
  await assert.rejects(
    smoke({
      baseUrl: "https://example.invalid",
      expectedRelease: "x",
      expectedSha: "y",
      request: async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    }),
    /JSON/,
  );
  await assert.rejects(
    smoke({
      baseUrl: "https://example.invalid",
      expectedRelease: "x",
      expectedSha: "y",
      request: async () => Response.json({ releaseId: "wrong", sourceSha: "y" }),
    }),
    /mismatch/,
  );
});
test("context release smoke requires actual PHP execution instead of source or old 404", async () => {
  const request = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/analytics/relay/collect.php")
      return Response.json({ error: { code: "ANALYTICS_RELAY_REJECTED" } }, { status: 405 });
    if (path === "/api/unknown") return Response.json({ error: "Not found" }, { status: 404 });
    if (path.startsWith("/products/"))
      return new Response("<html>", { headers: { "content-type": "text/html" } });
    if (path.startsWith("/catalogue/"))
      return new Response("image", { headers: { "content-type": "image/jpeg" } });
    if (path === "/api/health") return Response.json({ ok: true });
    return Response.json({ releaseId: "x", sourceSha: "y" });
  };
  const options = {
    baseUrl: "https://example.invalid",
    expectedRelease: "x",
    expectedSha: "y",
    expectedRelay: true,
  };
  await smoke({ ...options, request });
  for (const status of [200, 404])
    await assert.rejects(
      smoke({
        ...options,
        request: async (url, init) =>
          new URL(url).pathname === "/api/analytics/relay/collect.php"
            ? new Response("<?php source", { status, headers: { "content-type": "text/plain" } })
            : request(url, init),
      }),
      /PHP|relay/i,
    );
});

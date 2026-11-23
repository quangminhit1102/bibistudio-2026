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
const secure = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};
test("context release smoke requires actual PHP execution instead of source or old 404", async () => {
  const request = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/analytics/relay/collect.php")
      return Response.json({ error: { code: "ANALYTICS_RELAY_REJECTED" } }, { status: 405 });
    if (path === "/api/unknown") return Response.json({ error: "Not found" }, { status: 404 });
    if (path.startsWith("/products/"))
      return new Response("<html>", { headers: { "content-type": "text/html", ...secure } });
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
  const paths = [];
  await smoke({
    ...options,
    request: async (url, init) => {
      paths.push(new URL(url).pathname);
      return request(url, init);
    },
  });
  assert.ok(paths.includes("/api/health") && paths.includes("/api/version"));
  assert.ok(!paths.includes("/api/demo"), "the sample endpoint no longer exists");
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
test("smoke warns, without failing, when a page lacks the static security headers", async () => {
  const request = (headers) => async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/unknown") return Response.json({ error: "Not found" }, { status: 404 });
    if (path.startsWith("/products/"))
      return new Response("<html>", { headers: { "content-type": "text/html", ...headers } });
    if (path.startsWith("/catalogue/"))
      return new Response("image", { headers: { "content-type": "image/jpeg" } });
    if (path === "/api/health") return Response.json({ ok: true });
    return Response.json({ releaseId: "x", sourceSha: "y" });
  };
  const options = { baseUrl: "https://example.invalid", expectedRelease: "x", expectedSha: "y" };
  const warnings = [];
  const warn = (message) => warnings.push(message);
  await smoke({ ...options, warn, request: request(secure) });
  assert.deepEqual(warnings, []);
  // A release from before these headers must still pass, e.g. when a rollback restores it.
  await smoke({ ...options, warn, request: request({}) });
  assert.deepEqual(
    warnings,
    Object.keys(secure).map((name) => `::warning::Page is served without ${name}`),
  );
});
test("smoke warns, without failing, when the page's hashed script is not cached as immutable", async () => {
  const request = (cacheControl) => async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/unknown") return Response.json({ error: "Not found" }, { status: 404 });
    if (path.startsWith("/products/"))
      return new Response('<html><script type="module" src="/assets/app-1a2b3c4d.js"></script>', {
        headers: { "content-type": "text/html", ...secure },
      });
    if (path === "/assets/app-1a2b3c4d.js")
      return new Response("js", {
        headers: { "content-type": "text/javascript", "cache-control": cacheControl },
      });
    if (path.startsWith("/catalogue/"))
      return new Response("image", { headers: { "content-type": "image/jpeg" } });
    if (path === "/api/health") return Response.json({ ok: true });
    return Response.json({ releaseId: "x", sourceSha: "y" });
  };
  const options = { baseUrl: "https://example.invalid", expectedRelease: "x", expectedSha: "y" };
  const warnings = [];
  const warn = (message) => warnings.push(message);
  await smoke({
    ...options,
    warn,
    request: request("public, max-age=31536000, immutable"),
  });
  assert.deepEqual(warnings, []);
  // The host's default until the deploy tools on the server are updated.
  await smoke({ ...options, warn, request: request("public, max-age=604800") });
  assert.deepEqual(warnings, [
    "::warning::/assets/app-1a2b3c4d.js is not cached as immutable (public, max-age=604800)",
  ]);
});

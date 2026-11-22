import assert from "node:assert/strict";
import { test } from "node:test";
import { loadApiDemo } from "./api-demo.ts";
test("API check reads the backend release through a relative API path", async () => {
  const paths: string[] = [];
  const result = await loadApiDemo(undefined, async (input) => {
    paths.push(String(input));
    return new Response(JSON.stringify({ releaseId: "local", sourceSha: "local" }), {
      headers: { "content-type": "application/json" },
    });
  });
  assert.deepEqual(paths, ["/api/version"]);
  assert.deepEqual(result, { backend: { releaseId: "local", sourceSha: "local" } });
});
test("API demo clearly rejects HTTP errors and HTML fallback", async () => {
  await assert.rejects(
    loadApiDemo(undefined, async () => new Response("unavailable", { status: 503 })),
    /503/,
  );
  await assert.rejects(
    loadApiDemo(
      undefined,
      async () => new Response("<html>SPA</html>", { headers: { "content-type": "text/html" } }),
    ),
    /JSON/,
  );
});
test("API demo forwards cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadApiDemo(controller.signal, async (_url, init) => {
      init?.signal?.throwIfAborted();
      return new Response();
    }),
    { name: "AbortError" },
  );
});

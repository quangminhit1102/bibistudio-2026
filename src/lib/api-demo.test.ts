import assert from "node:assert/strict";
import { test } from "node:test";
import { loadApiDemo } from "./api-demo.ts";
test("API demo reads release and payload through relative API paths", async () => {
  const paths: string[] = [];
  const result = await loadApiDemo(undefined, async (input) => {
    paths.push(String(input));
    return new Response(
      JSON.stringify(
        String(input).endsWith("version")
          ? { releaseId: "local", sourceSha: "local" }
          : { message: "hello" },
      ),
      { headers: { "content-type": "application/json" } },
    );
  });
  assert.deepEqual(paths.sort(), ["/api/demo", "/api/version"]);
  assert.equal(result.backend.releaseId, "local");
  assert.deepEqual(result.demo, { message: "hello" });
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

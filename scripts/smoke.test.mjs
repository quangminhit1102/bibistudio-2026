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

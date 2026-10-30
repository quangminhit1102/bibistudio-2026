import { test } from "node:test";
import assert from "node:assert/strict";
import { smoke } from "./smoke.mjs";
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

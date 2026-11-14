import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePostContent } from "../dist/content/sanitize.js";
const stored = (html) => JSON.stringify({ format: "html-v1", html });
const media = "11111111-1111-4111-8111-111111111111";

test("sanitizes stored HTML in Node and demotes the body H1", async () => {
  assert.equal(typeof globalThis.document, "undefined");
  const value = await sanitizePostContent(
    stored(
      '<h1>A</h1><img src=x onerror="alert(1)"><script>alert(1)</script><svg onload=alert(1)></svg><a href="javascript:alert(1)">link</a>',
    ),
  );
  assert.match(value.html, /<h2>A<\/h2>/);
  assert.doesNotMatch(value.html, /onerror|onload|<script|<svg|javascript:|src="x"/);
  assert.equal(value.plainText, "A link");
});

test("keeps editor tables and safe formatting, removes CSS resource loading", async () => {
  const value = await sanitizePostContent(
    stored(
      '<table style="width: 80%; background-image:url(https://evil.test/x)"><tbody><tr><td colspan="2" style="color:#f00;text-align:center;position:fixed;">A</td></tr></tbody></table>',
    ),
  );
  assert.match(value.html, /<table style="width: 80%;">/);
  assert.match(value.html, /colspan="2"/);
  assert.match(value.html, /color: (?:#f00|rgb\(255, 0, 0\));/);
  assert.match(value.html, /text-align: center;/);
  assert.doesNotMatch(value.html, /evil|url\(|position|fixed/);
  assert.deepEqual(await sanitizePostContent(value.content), value);
});

test("persists only media references and extracts unique inline IDs", async () => {
  const value = await sanitizePostContent(
    stored(
      `<p><img src="https://evil.test/tracker"><img data-media-id="${media}" src="blob:unsafe" alt="A"><img data-media-id="${media}" src="data:evil"></p>`,
    ),
  );
  assert.deepEqual(value.mediaIds, [media]);
  assert.match(value.html, new RegExp(`src="bibi-media:${media}"`));
  assert.doesNotMatch(value.html, /https:|blob:|data:evil|tracker/);
});

test("normalizes legacy JSON and treats plain text as text", async () => {
  const plain = await sanitizePostContent("<script>x</script>\nChữ Việt");
  assert.match(plain.html, /&lt;script&gt;/);
  assert.match(plain.html, /<br>/);
  const legacy = await sanitizePostContent(
    JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Tiêu đề", marks: [{ type: "bold" }] }],
        },
      ],
    }),
  );
  assert.equal(legacy.html, "<h2><strong>Tiêu đề</strong></h2>");
});

test("enforces the sanitized UTF-8 boundary, not JavaScript string length", async () => {
  const exact = await sanitizePostContent(stored(`<p>${"é".repeat(131068)}x</p>`));
  assert.equal(Buffer.byteLength(exact.html), 262144);
  await assert.rejects(
    sanitizePostContent(stored(`<p>${"é".repeat(131069)}</p>`)),
    (error) => error.code === "CONTENT_TOO_LARGE",
  );
  await assert.rejects(
    sanitizePostContent("a".repeat(524289)),
    (error) => error.code === "CONTENT_TOO_LARGE",
  );
});

test("rejects excessive legacy/DOM node count and nesting", async () => {
  await assert.rejects(
    sanitizePostContent(
      JSON.stringify({
        type: "doc",
        content: Array.from({ length: 1001 }, () => ({ type: "paragraph" })),
      }),
    ),
    (error) => error.code === "CONTENT_COMPLEXITY",
  );
  await assert.rejects(
    sanitizePostContent(stored("<span>".repeat(33) + "x" + "</span>".repeat(33))),
    (error) => error.code === "CONTENT_COMPLEXITY",
  );
  await assert.rejects(
    sanitizePostContent(stored("<p>x</p>".repeat(1001))),
    (error) => error.code === "CONTENT_COMPLEXITY",
  );
});

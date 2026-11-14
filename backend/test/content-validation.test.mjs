import test from "node:test";
import assert from "node:assert/strict";
import { validatePostDraft, validateCategory } from "../dist/content/validation.js";
import { CONTENT_LIMITS } from "../dist/content/limits.js";
import { validDraft, validCategory } from "./helpers/content.mjs";

test("accepts bounded drafts and normalizes Vietnamese slugs and tags", () => {
  const value = validatePostDraft(
    validDraft({ slug: "Đồ Gỗ Bền Vững", tags: [" Thiết kế ", "thiết kế", "Nhà"] }),
  );
  assert.equal(value.slug, "do-go-ben-vung");
  assert.deepEqual(value.tags, ["Thiết kế", "Nhà"]);
  assert.equal(
    validatePostDraft(validDraft({ title: "x".repeat(300), excerpt: "x".repeat(1000) })).title
      .length,
    300,
  );
  assert.equal(
    validateCategory(validCategory({ name: " Mẫu đẹp ", slug: "Mẫu Đẹp" })).slug,
    "mau-dep",
  );
});

test("rejects unbounded fields, forged identifiers and route fragments", () => {
  for (const patch of [
    { title: "x".repeat(301) },
    { seoTitle: "x".repeat(301) },
    { excerpt: "x".repeat(1001) },
    { seoDescription: "x".repeat(1001) },
    { tags: Array.from({ length: 11 }, (_, n) => `tag${n}`) },
    { author: { kind: "account", id: "../admin" } },
    { categoryId: "x" },
    { coverMediaId: "https://evil.test/x.jpg" },
    { slug: "../x" },
    { slug: "page" },
    { slug: "%2fsecret" },
    { unexpected: true },
  ]) {
    assert.throws(
      () => validatePostDraft(validDraft(patch)),
      (error) => error.status === 400 && error.code === "INVALID_CONTENT_INPUT",
    );
  }
  assert.throws(() => validateCategory(validCategory({ parentId: "../../" })));
  assert.throws(() => validateCategory(validCategory({ position: -1 })));
});

test("request and sanitized-body byte budgets remain distinct", () => {
  assert.equal(CONTENT_LIMITS.bodyBytes, 262144);
  assert.equal(CONTENT_LIMITS.inputBytes, 524288);
  assert.equal(CONTENT_LIMITS.requestBytes, 524288);
  assert.equal(CONTENT_LIMITS.mediaJsonBytes, 6991532);
  assert.throws(() => validatePostDraft(validDraft({ content: "é".repeat(262145) })));
});

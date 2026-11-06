import { expect, it } from "vitest";
import {
  hasFormChanges,
  formFingerprint,
} from "../../src/features/admin/shared/forms/form-baseline";
import { writeRichContent } from "../../src/features/admin/content/rich-content";
it("ignores TinyMCE inter-block indentation without hiding inline or preformatted whitespace changes", () => {
  const base = { content: writeRichContent("<p>Đoạn một</p><p>Đoạn hai</p>") };
  expect(
    hasFormChanges("post", base, { content: writeRichContent("<p>Đoạn một</p>\n<p>Đoạn hai</p>") }),
  ).toBe(false);
  expect(
    hasFormChanges(
      "post",
      { content: writeRichContent("<p><strong>A</strong> <em>B</em></p>") },
      { content: writeRichContent("<p><strong>A</strong><em>B</em></p>") },
    ),
  ).toBe(true);
  expect(
    hasFormChanges(
      "post",
      { content: writeRichContent("<pre>A\n B</pre>") },
      { content: writeRichContent("<pre>A\nB</pre>") },
    ),
  ).toBe(true);
});
it("compares publication dates using the same Vietnamese calendar day shown by the date input", () => {
  const base = { publishAt: "2026-08-25", content: "" };
  expect(hasFormChanges("post", base, { ...base, publishAt: "2026-08-24T17:00:00.000Z" })).toBe(
    false,
  );
  expect(hasFormChanges("post", base, { ...base, publishAt: "2026-08-25T17:00:00.000Z" })).toBe(
    true,
  );
});
it("ignores serialized attribute order while keeping image descriptions and durable media changes", () => {
  const base = {
    content: writeRichContent('<figure><img data-media-id="photo-a" alt="Sổ tay"></figure>'),
  };
  expect(
    hasFormChanges("post", base, {
      content: writeRichContent('<figure><img alt="Sổ tay" data-media-id="photo-a"></figure>'),
    }),
  ).toBe(false);
  expect(
    hasFormChanges("post", base, {
      content: writeRichContent('<figure><img data-media-id="photo-a" alt="Mô tả mới"></figure>'),
    }),
  ).toBe(true);
  expect(
    hasFormChanges("post", base, {
      content: writeRichContent('<figure><img data-media-id="photo-b" alt="Sổ tay"></figure>'),
    }),
  ).toBe(true);
});
it("keeps gallery order and rich formatting while treating empty editor initialization as unchanged", () => {
  const base = { name: "Sổ", slug: "so", description: "", imageIds: ["a", "b"] };
  expect(hasFormChanges("product", base, structuredClone(base))).toBe(false);
  expect(
    hasFormChanges("product", base, { ...base, description: writeRichContent("<p><br></p>") }),
  ).toBe(false);
  expect(hasFormChanges("product", base, { ...base, imageIds: ["b", "a"] })).toBe(true);
  expect(
    hasFormChanges("product", base, {
      ...base,
      description: writeRichContent("<p><strong>Sổ</strong></p>"),
    }),
  ).toBe(true);
  const body = { content: writeRichContent("<p><b>Xin chào</b></p>") };
  expect(formFingerprint("post", body)).toBe(
    formFingerprint("post", { content: writeRichContent("<p><strong>Xin chào</strong></p>") }),
  );
  expect(hasFormChanges("post", body, { content: writeRichContent("<p>Xin chào</p>") })).toBe(true);
  expect(
    hasFormChanges(
      "post",
      { content: writeRichContent('<p><a href="https://example.com/a">Link</a></p>') },
      { content: writeRichContent('<p><a href="https://example.com/b">Link</a></p>') },
    ),
  ).toBe(true);
  expect(hasFormChanges("product", base, { ...base, name: "Sổ " })).toBe(true);
});

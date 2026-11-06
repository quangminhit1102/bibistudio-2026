import { expect, it } from "vitest";
import {
  hasFormChanges,
  formFingerprint,
} from "../../src/features/admin/shared/forms/form-baseline";
import { writeRichContent } from "../../src/features/admin/content/rich-content";
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

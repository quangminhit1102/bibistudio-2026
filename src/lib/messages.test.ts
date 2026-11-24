import { describe, expect, it } from "vitest";
import { fill } from "./messages";

describe("fill", () => {
  it("returns a text without placeholders unchanged", () => {
    expect(fill("Liên hệ")).toBe("Liên hệ");
  });

  it("replaces every occurrence of a placeholder with its value", () => {
    expect(fill("{count} kết quả, trang {page} / {count}", { count: 3, page: 1 })).toBe(
      "3 kết quả, trang 1 / 3",
    );
  });

  it("keeps a placeholder that has no value", () => {
    expect(fill("Về {brand}", {})).toBe("Về {brand}");
  });

  it("does not expand a placeholder that arrives inside a value", () => {
    expect(fill("Mẫu {name}", { name: "{brand}", brand: "X" })).toBe("Mẫu {brand}");
  });
});

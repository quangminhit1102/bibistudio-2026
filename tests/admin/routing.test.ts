import { describe, expect, it } from "vitest";
import { isAdminPath } from "../../src/lib/admin-boundary";
describe("admin boundary", () => {
  it("recognizes admin under both configured basepaths without capturing public routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/products/a/edit")).toBe(true);
    expect(isAdminPath("/~vhplasti/admin/products", "/~vhplasti")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/products/admin")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});

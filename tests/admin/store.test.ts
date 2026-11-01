import { afterEach, describe, expect, it } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
const stores: ReturnType<typeof createAdminStore>[] = [];
const make = () => {
  const s = createAdminStore(`bibi-admin-test-${crypto.randomUUID()}`);
  stores.push(s);
  return s;
};
afterEach(async () => {
  for (const s of stores.splice(0)) await s.destroy();
});
describe("admin persistent store", () => {
  it("commits records and survives reopening", async () => {
    const s = make();
    const r = {
      id: "a",
      name: "Việt Nam",
      createdAt: "2026-11-01",
      updatedAt: "2026-11-01",
      revision: 1,
    };
    await s.transaction(["authors"], (tx) => tx.put("authors", r));
    await s.close();
    expect((await s.get("authors", "a"))?.name).toBe("Việt Nam");
  });
  it("aborts all writes if work fails", async () => {
    const s = make();
    await expect(
      s.transaction(["authors"], async (tx) => {
        await tx.put("authors", {
          id: "a",
          name: "A",
          createdAt: "x",
          updatedAt: "x",
          revision: 1,
        });
        throw new Error("quota fixture");
      }),
    ).rejects.toThrow("quota fixture");
    expect(await s.get("authors", "a")).toBeUndefined();
  });
  it("reset preserves other application preferences and clears admin rows", async () => {
    const s = make();
    localStorage.setItem("public-language", "vi");
    await s.transaction(["authors"], (tx) =>
      tx.put("authors", { id: "a", name: "A", createdAt: "x", updatedAt: "x", revision: 1 }),
    );
    await s.reset();
    expect(await s.list("authors")).toEqual([]);
    expect(localStorage.getItem("public-language")).toBe("vi");
  });
  it("persists blobs without base64 serialization", async () => {
    const s = make();
    await s.putBlob("photo", new Blob(["bytes"], { type: "image/png" }));
    await s.close();
    expect((await s.getBlob("photo"))?.size).toBe(5);
  });
});

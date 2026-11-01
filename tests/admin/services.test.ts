import { describe, it, expect, afterEach } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import { seedBase } from "../../src/features/admin/demo/clock";
const store = createAdminStore("admin-services-test");
afterEach(() => store.reset());
const session = () => ({ userId: "u", roleId: "super-admin" });
const service = () => createEntityService(store, "authors", session);
describe("typed demo services", () => {
  it("validates before create, persists mutations with revision and audit", async () => {
    const s = service();
    await expect(s.create({ name: "" })).rejects.toMatchObject({ code: "validation" });
    const a = await s.create({ name: "Nguyễn An" });
    expect(a.revision).toBe(1);
    const b = await s.update(a.id, { name: "Nguyễn Bình" }, 1);
    expect(b.revision).toBe(2);
    await expect(s.update(a.id, { name: "Cũ" }, 1)).rejects.toMatchObject({ code: "conflict" });
    expect((await store.list("audit")).length).toBe(2);
  });
  it("filters unicode, sorts and pages without mutating results", async () => {
    const s = service();
    await s.create({ name: "Đà Nẵng" });
    await s.create({ name: "Đà Lạt" });
    const r = await s.list({
      page: 1,
      pageSize: 1,
      search: "da",
      sort: { field: "name", direction: "asc" },
    });
    expect(r.total).toBe(2);
    expect(r.items[0].name).toBe("Đà Lạt");
  });
  it("rejects mutations for viewer and aborted requests", async () => {
    const s = createEntityService(store, "authors", () => ({ userId: "v", roleId: "viewer" }));
    await expect(s.create({ name: "Forbidden" })).rejects.toMatchObject({ code: "forbidden" });
    const signal = AbortSignal.abort();
    await expect(s.list({ page: 1, pageSize: 10, signal })).rejects.toMatchObject({
      code: "aborted",
    });
  });
  it("blocks deleting authors referenced by a book", async () => {
    const a = await service().create({ name: "Author" });
    await store.transaction(["books"], (tx) =>
      tx.put("books", {
        ...seedBase("b"),
        name: "Book",
        slug: "b",
        price: 1,
        stock: 2,
        reserved: 0,
        status: "draft",
        imageIds: [],
        tags: [],
        seoTitle: "",
        seoDescription: "",
        isbn: "123",
        authorIds: [a.id],
        publisherId: "",
        genreIds: [],
        year: 2026,
        language: "vi",
      }),
    );
    await expect(service().remove(a.id, 1)).rejects.toMatchObject({ code: "validation" });
  });
});

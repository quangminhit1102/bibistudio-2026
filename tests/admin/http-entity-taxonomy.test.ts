import { expect, it, vi } from "vitest";
import { createHttpEntityService } from "../../src/features/admin/services/http-entity-service";
import type { AdminHttpClient } from "../../src/lib/admin-http";

function mockClient() {
  const request = vi.fn();
  return { request, client: { request, requestBlob: vi.fn() } as unknown as AdminHttpClient };
}

it("reads and writes product types under /api/product-types, one form field per text", async () => {
  const { client, request } = mockClient();
  request.mockResolvedValue({
    id: "t1",
    code: "notebook",
    name: "Sổ tay",
    description: "Giấy nhỏ",
    translations: {
      vi: { name: "Sổ tay", plural: "Sổ tay", tagline: "Giấy nhỏ" },
      en: { name: "Notebook", plural: "Notebooks" },
      fr: { name: "Carnet" },
    },
    revision: 2,
  });
  const service = createHttpEntityService(client, "productTypes");

  expect(await service.get("t1")).toMatchObject({
    plural: "Sổ tay",
    nameEn: "Notebook",
    pluralEn: "Notebooks",
    taglineEn: "",
  });
  expect(request).toHaveBeenLastCalledWith("/api/product-types/t1", { signal: undefined });

  await service.update(
    "t1",
    { name: "Sổ", code: "renamed", plural: "", nameEn: "Notebook", pluralEn: "Books" },
    2,
  );
  // The code is never sent; texts the form does not show (fr) are kept.
  expect(request).toHaveBeenLastCalledWith("/api/product-types/t1", {
    method: "PUT",
    ifMatch: 2,
    body: {
      name: "Sổ",
      revision: 2,
      translations: {
        vi: { name: "Sổ", tagline: "Giấy nhỏ" },
        en: { name: "Notebook", plural: "Books" },
        fr: { name: "Carnet" },
      },
    },
  });
});

it("a change that touches no text leaves the translations alone", async () => {
  const { client, request } = mockClient();
  request.mockResolvedValue({ id: "t1" });
  await createHttpEntityService(client, "productTypes").update("t1", { active: false }, 3);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/api/product-types/t1", {
    method: "PUT",
    ifMatch: 3,
    body: { active: false, revision: 3 },
  });
});

it("creates a collection with its texts and without the form's kind", async () => {
  const { client, request } = mockClient();
  request.mockResolvedValue({ id: "c1" });
  await createHttpEntityService(client, "categories", "products").create({
    name: "Tết",
    slug: "tet",
    kind: "product",
    description: "Xuân về",
    tagline: "Quà Tết",
    nameEn: "Lunar New Year",
    taglineEn: "",
    introEn: "",
    parentId: null,
    position: 0,
    active: true,
  });
  expect(request).toHaveBeenCalledWith("/api/product-categories", {
    method: "POST",
    body: {
      name: "Tết",
      slug: "tet",
      description: "Xuân về",
      parentId: null,
      position: 0,
      active: true,
      translations: {
        vi: { name: "Tết", tagline: "Quà Tết", intro: "Xuân về" },
        en: { name: "Lunar New Year" },
      },
    },
  });
});

it("content categories are sent without texts", async () => {
  const { client, request } = mockClient();
  request.mockResolvedValue({ id: "c1" });
  await createHttpEntityService(client, "categories", "content").update(
    "c1",
    { name: "Du lịch" },
    1,
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/api/content-categories/c1", {
    method: "PUT",
    ifMatch: 1,
    body: { name: "Du lịch", revision: 1 },
  });
});

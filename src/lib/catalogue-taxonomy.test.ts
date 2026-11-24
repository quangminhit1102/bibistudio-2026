import { afterEach, describe, expect, it, vi } from "vitest";
import { collections, productTypes } from "@/data/catalogue";
import {
  getCollection,
  getCollectionBySlug,
  getProductType,
  getProductTypeBySlug,
  loadTaxonomy,
  resetTaxonomy,
  taxonomy,
} from "./catalogue-taxonomy";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function api(lists: { types?: unknown; collections?: unknown }) {
  const fetchMock = vi.fn(async (path: string) => {
    const body = path.endsWith("/product-types") ? lists.types : lists.collections;
    return body === undefined ? new Response("down", { status: 503 }) : json(body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  resetTaxonomy();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("catalogue taxonomy", () => {
  it("starts from the lists bundled with the site", () => {
    expect(taxonomy().productTypes).toBe(productTypes);
    expect(taxonomy().collections).toBe(collections);
    expect(getProductTypeBySlug("notebooks")?.id).toBe("notebook");
  });

  it("shows the types and collections the API lists, in its order", async () => {
    api({
      types: [
        {
          code: "sticker",
          slug: "stickers",
          name: "Sticker",
          tagline: "Dán ở đâu cũng vui",
          translations: {
            // The name column is what an admin edits, so it wins over the copy kept here.
            vi: { name: "Tên cũ", plural: "Bộ sticker" },
            en: { name: "Sticker", plural: "Stickers" },
          },
          image: "/api/media/abc",
        },
        {
          code: "notebook",
          slug: "so-tay",
          name: "Sổ",
          tagline: "",
          translations: {},
          image: null,
        },
      ],
      collections: [
        {
          slug: "tet",
          name: "Tết",
          tagline: "Mô tả cũ",
          translations: { vi: { tagline: "Xuân về" }, en: { name: "Lunar New Year" } },
          image: null,
        },
      ],
    });
    await loadTaxonomy();

    expect(taxonomy().productTypes.map((t) => t.id)).toEqual(["sticker", "notebook"]);
    expect(getProductType("sticker")).toEqual({
      id: "sticker",
      slug: "stickers",
      name: { vi: "Sticker", en: "Sticker" },
      plural: { vi: "Bộ sticker", en: "Stickers" },
      tagline: { vi: "Dán ở đâu cũng vui", en: "Dán ở đâu cũng vui" },
      image: "/api/media/abc",
    });
    // Renamed in the admin: the new slug has the page, the old one does not.
    expect(getProductTypeBySlug("so-tay")?.id).toBe("notebook");
    expect(getProductTypeBySlug("notebooks")).toBeUndefined();
    // No image of its own: the picture bundled for the same type stays.
    expect(getProductType("notebook").image).toBe(productTypes[0].image);
    // A type the API no longer lists is shown by its own id.
    expect(getProductType("magnet").name).toEqual({ vi: "magnet", en: "magnet" });

    expect(getCollectionBySlug("tet")).toEqual({
      id: "tet",
      slug: "tet",
      name: { vi: "Tết", en: "Lunar New Year" },
      tagline: { vi: "Xuân về", en: "Xuân về" },
      intro: { vi: "Mô tả cũ", en: "Mô tả cũ" },
      image: undefined,
    });
    expect(getCollection("motivation").name.vi).toBe("motivation");
  });

  it("keeps the bundled lists when the API is down, and asks again next time", async () => {
    const down = api({});
    await loadTaxonomy();
    expect(taxonomy().productTypes).toBe(productTypes);
    expect(down).toHaveBeenCalledTimes(2);

    api({ types: [{ code: "sticker", slug: "stickers", name: "Sticker", tagline: "" }] });
    await loadTaxonomy();
    expect(taxonomy().productTypes.map((t) => t.id)).toEqual(["sticker"]);
    // The collections call failed, so the bundled collections stay.
    expect(taxonomy().collections).toBe(collections);
  });

  it("keeps a bundled list the API returns empty", async () => {
    api({ types: [], collections: [] });
    await loadTaxonomy();
    expect(taxonomy().productTypes).toBe(productTypes);
    expect(taxonomy().collections).toBe(collections);
  });

  it("reads the API once for calls within a minute, then again", async () => {
    vi.useFakeTimers();
    const fetchMock = api({ types: [], collections: [] });
    await Promise.all([loadTaxonomy(), loadTaxonomy()]);
    await loadTaxonomy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(61_000);
    await loadTaxonomy();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

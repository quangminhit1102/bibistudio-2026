import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getPublicPost,
  getPublicProduct,
  getPublicPosts,
  getPublicProducts,
  getPublicCategories,
  getPublicCollections,
} from "./content-api";

describe("content-api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null when fetch is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    expect(await getPublicPost("hello-world")).toBeNull();
    expect(await getPublicPosts()).toBeNull();
  });

  it("returns null when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await getPublicProduct("hello-world")).toBeNull();
    expect(await getPublicProducts()).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await getPublicPost("missing")).toBeNull();
    expect(await getPublicCollections()).toBeNull();
  });

  it("returns the parsed payload on success", async () => {
    const payload = {
      slug: "hello-world",
      title: "Hello",
      seo_title: "SEO",
      seo_description: "Desc",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    expect(await getPublicPost("hello-world")).toEqual(payload);
  });

  it("requests the list endpoints and returns parsed arrays", async () => {
    const posts = [{ slug: "a", title: "A" }];
    const products = [{ slug: "p", name: { vi: "Sản phẩm", en: "Product" } }];
    const categories = [{ name: "Sổ tay", slug: "notebooks", parent_id: null, position: 0 }];
    const collections = [{ slug: "motivation", name: "Motivation", tagline: "Tagline" }];
    const fetchMock = vi.fn((url: string) => {
      let json: unknown;
      if (url === "/api/public/posts") json = posts;
      else if (url === "/api/public/products") json = products;
      else if (url === "/api/public/categories?scope=product") json = categories;
      else if (url === "/api/public/categories?scope=content") json = categories;
      else if (url === "/api/public/collections") json = collections;
      else json = [];
      return Promise.resolve({ ok: true, json: async () => json });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPublicPosts()).toEqual(posts);
    expect(await getPublicProducts()).toEqual(products);
    expect(await getPublicCategories()).toEqual(categories);
    expect(await getPublicCategories("content")).toEqual(categories);
    expect(await getPublicCollections()).toEqual(collections);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/public/posts",
      "/api/public/products",
      "/api/public/categories?scope=product",
      "/api/public/categories?scope=content",
      "/api/public/collections",
    ]);
  });
});

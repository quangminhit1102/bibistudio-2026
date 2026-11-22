import { describe, it, expect, vi, afterEach } from "vitest";
import {
  findPublicPost,
  findPublicProduct,
  pickSource,
  getPublicPosts,
  getPublicProducts,
  getPublicCategories,
  getPublicCollections,
} from "./content-api";

describe("content-api", () => {
  afterEach(() => vi.unstubAllGlobals());

  const reply = (status: number, contentType: string, body: unknown = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": contentType }),
    json: async () => body,
  });

  it("reports the API as unavailable when fetch is missing", async () => {
    vi.stubGlobal("fetch", undefined);
    expect(await findPublicPost("hello-world")).toEqual({ status: "unavailable" });
    expect(await getPublicPosts()).toBeNull();
  });

  it("reports the API as unavailable when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await findPublicProduct("hello-world")).toEqual({ status: "unavailable" });
    expect(await getPublicProducts()).toBeNull();
  });

  it("treats the API's own 404 as removed content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(404, "application/json; charset=utf-8")),
    );
    expect(await findPublicPost("missing")).toEqual({ status: "missing" });
    expect(await findPublicProduct("missing")).toEqual({ status: "missing" });
    expect(await getPublicCollections()).toBeNull();
  });

  it("does not read a host error page or a server error as removed content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(404, "text/html")));
    expect(await findPublicPost("hello-world")).toEqual({ status: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, "application/json")));
    expect(await findPublicProduct("hello-world")).toEqual({ status: "unavailable" });
  });

  it("returns the parsed payload on success and lets the browser cache it", async () => {
    const payload = {
      slug: "hello-world",
      title: "Hello",
      seo_title: "SEO",
      seo_description: "Desc",
    };
    const fetchMock = vi.fn().mockResolvedValue(reply(200, "application/json", payload));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findPublicPost("hello-world")).toEqual({ status: "found", value: payload });
    expect(fetchMock.mock.calls).toEqual([["/api/public/posts/hello-world"]]);
  });

  it("never brings removed content back from the bundled copy", () => {
    const bundled = vi.fn(() => "bundled");
    expect(pickSource({ status: "missing" }, bundled)).toBeNull();
    expect(bundled).not.toHaveBeenCalled();
  });

  it("prefers the API and uses the bundled copy only while the API is unavailable", () => {
    const bundled = vi.fn(() => "bundled");
    expect(pickSource({ status: "found", value: "live" }, bundled)).toEqual({
      from: "api",
      value: "live",
    });
    expect(bundled).not.toHaveBeenCalled();
    expect(pickSource({ status: "unavailable" }, bundled)).toEqual({
      from: "bundle",
      value: "bundled",
    });
    expect(pickSource({ status: "unavailable" }, () => undefined)).toBeNull();
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
      return Promise.resolve(reply(200, "application/json", json));
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

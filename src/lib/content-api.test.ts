import { describe, it, expect, vi, afterEach } from "vitest";
import { getPublicPost, getPublicProduct } from "./content-api";

describe("content-api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null when fetch is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    expect(await getPublicPost("hello-world")).toBeNull();
  });

  it("returns null when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await getPublicProduct("hello-world")).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await getPublicPost("missing")).toBeNull();
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
});

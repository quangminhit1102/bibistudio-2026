import { describe, it, expect, vi } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { createContentHttp } from "../../src/features/admin/content/http-api";
const id = "bd7f29fa-c7e3-47af-a63d-2b79c5b949da",
  category = "bd7f29fa-c7e3-47af-a63d-2b79c5b949db";
describe("content HTTP adapter", () => {
  it("sends explicit draft revisions and durable publication keys with cancellation", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [],
      fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return Response.json(
          String(url).endsWith("/api/auth/login")
            ? {
                accessToken: "access-in-memory",
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                profile: {
                  id,
                  username: "editor",
                  displayName: "Editor",
                  email: null,
                  roleIds: [],
                  roles: [],
                  permissions: ["post.view", "post.update", "post.publish"],
                  fullAccess: false,
                  isMaster: false,
                  revision: 1,
                },
              }
            : { id, revision: 4 },
        );
      });
    const client = createAdminHttp({
      fetch: fetcher,
      origin: "https://bibistudio.vn",
      refreshLock: null,
    });
    await client.login({ username: "editor", password: "only-local-test" });
    const api = createContentHttp(client),
      controller = new AbortController(),
      input = {
        title: "Title",
        slug: "title",
        excerpt: "",
        content: '{"format":"html-v1","html":"<p>Body</p>"}',
        categoryId: category,
        tags: [],
        author: { kind: "brand" as const },
        coverMediaId: null,
        coverAlt: "",
        seoTitle: "",
        seoDescription: "",
      };
    await api.posts.saveDraft(id, input, 3, controller.signal);
    expect(JSON.parse(String(calls.at(-1)!.init!.body))).toEqual({ input, expectedRevision: 3 });
    expect(calls.at(-1)!.init!.method).toBe("PUT");
    expect(calls.at(-1)!.init!.signal).toBe(controller.signal);
    const request = {
      action: "publish" as const,
      targetId: id,
      expectedRevision: 4,
      idempotencyKey: crypto.randomUUID(),
    };
    await api.publications.request(request, controller.signal);
    expect(JSON.parse(String(calls.at(-1)!.init!.body))).toEqual(request);
    expect(calls.at(-1)!.url).toBe("https://bibistudio.vn/api/content/publications");
  });
  it("accepts authenticated WebP only for content media while preserving profile MIME policy", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/auth/login")
        ? Response.json({
            accessToken: "memory",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            profile: { id },
          })
        : new Response(new Blob(["image"], { type: "image/webp" }), {
            headers: { "Content-Type": "image/webp" },
          }),
    );
    const client = createAdminHttp({
      fetch: fetcher,
      origin: "https://bibistudio.vn",
      refreshLock: null,
    });
    await client.login({ username: "test", password: "only-test" });
    const api = createContentHttp(client);
    expect((await api.media.read(id, "a".repeat(64))).type).toBe("image/webp");
    await expect(client.requestBlob("/api/profile/avatar/test")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});

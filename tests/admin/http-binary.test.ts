import { it, expect, vi } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { json, grant, immediateLock, profile } from "./helpers/http-client";
it("binary reads and bounded JSON uploads reuse one refresh and preserve blob/headers on retry", async () => {
  const blob = new Blob(["pixels"], { type: "image/png" }),
    seen: RequestInit[] = [];
  let refreshed = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, init) => {
      const path = String(input);
      if (path.endsWith("/login")) return json(grant("first"));
      if (path.endsWith("/refresh")) {
        refreshed++;
        return json(grant("second"));
      }
      seen.push(init!);
      if ((init!.headers as Record<string, string>).Authorization === "Bearer first")
        return json({ error: { code: "EXPIRED" } }, 401);
      return init?.method === "PUT"
        ? json({ saved: true })
        : new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "image/png" } });
    },
  });
  await client.login({ username: "user", password: "secret" });
  const [image, saved] = await Promise.all([
    client.requestBlob("/api/profile/avatar/id"),
    client.upload("/api/profile/avatar", blob, { revision: 7 }),
  ]);
  expect(refreshed).toBe(1);
  expect(image.type).toBe("image/png");
  expect(saved).toEqual({ saved: true });
  for (const request of seen.filter((r) => r.method === "PUT")) {
    expect(JSON.parse(request.body as string)).toEqual({ mimeType: "image/png", data: "cGl4ZWxz" });
    expect(request.credentials).toBe("include");
    expect((request.headers as Record<string, string>)["If-Match"]).toBe('"7"');
    expect((request.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  }
});
it("late binary response after logout/login is discarded instead of crossing account identity", async () => {
  let release!: (value: Response) => void;
  let login = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      if (String(input).endsWith("/login"))
        return json({
          ...grant("token"),
          profile: { ...profile, id: ++login === 1 ? "one" : "two" },
        });
      if (String(input).endsWith("/logout")) return new Response(null, { status: 204 });
      return new Promise((resolve) => (release = resolve));
    },
  });
  await client.login({ username: "one", password: "secret" });
  const pending = client.requestBlob("/api/profile/avatar/old");
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await client.logout();
  await client.login({ username: "two", password: "secret" });
  release(new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/png" } }));
  await rejected;
});
it("abort does not refresh or replay an upload", async () => {
  let refreshes = 0;
  const controller = new AbortController();
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      if (String(input).endsWith("/login")) return json(grant("first"));
      if (String(input).endsWith("/refresh")) refreshes++;
      controller.abort();
      return json({ error: { code: "EXPIRED" } }, 401);
    },
  });
  await client.login({ username: "one", password: "secret" });
  await expect(
    client.upload("/api/profile/avatar", new Blob(["a"]), {
      revision: 1,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(refreshes).toBe(0);
});
it("late unauthorized upload cannot refresh or replay after identity switches", async () => {
  let release!: (value: Response) => void;
  let logins = 0,
    writes = 0,
    refreshes = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      if (String(input).endsWith("/login"))
        return json({ ...grant("token"), profile: { ...profile, id: String(++logins) } });
      if (String(input).endsWith("/logout")) return new Response(null, { status: 204 });
      if (String(input).endsWith("/refresh")) {
        refreshes++;
        return json(grant("new"));
      }
      writes++;
      return new Promise((resolve) => (release = resolve));
    },
  });
  await client.login({ username: "one", password: "secret" });
  const pending = client.upload("/api/profile/avatar", new Blob(["a"]), { revision: 1 });
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(writes).toBe(1));
  await client.logout();
  await client.login({ username: "two", password: "secret" });
  release(json({ error: { code: "EXPIRED" } }, 401));
  await rejected;
  expect(writes).toBe(1);
  expect(refreshes).toBe(0);
});

it("encoding cannot send an old image after the account changes", async () => {
  let resolveRead!: (v: ArrayBuffer) => void,
    writes = 0;
  const blob = new Blob(["a"], { type: "image/png" });
  vi.spyOn(blob, "arrayBuffer").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
  );
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      if (String(input).endsWith("/login")) return json(grant("token"));
      if (String(input).endsWith("/logout")) return new Response(null, { status: 204 });
      writes++;
      return json({});
    },
  });
  await client.login({ username: "one", password: "secret" });
  const pending = client.upload("/api/profile/avatar", blob, { revision: 1 });
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await client.logout();
  await client.login({ username: "two", password: "secret" });
  resolveRead(new ArrayBuffer(1));
  await rejected;
  expect(writes).toBe(0);
});

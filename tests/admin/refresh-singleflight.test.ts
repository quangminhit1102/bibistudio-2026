import { expect, test } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { grant, json, immediateLock } from "./helpers/http-client";

test("twenty simultaneous401 responses trigger exactly one refresh and retry each request once", async () => {
  let refreshes = 0;
  let protectedCalls = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("login")) return json(grant("old"));
      if (path.endsWith("refresh")) {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json(grant("new"));
      }
      protectedCalls++;
      return new Headers(options?.headers).get("Authorization") === "Bearer new"
        ? json({ ok: true })
        : json({ error: { code: "UNAUTHENTICATED", message: "Expired" } }, 401);
    },
  });
  await client.login({ username: "user01", password: "test-only" });
  const results = await Promise.all(
    Array.from({ length: 20 }, () => client.request("/api/accounts")),
  );
  expect(results).toEqual(Array.from({ length: 20 }, () => ({ ok: true })));
  expect(refreshes).toBe(1);
  expect(protectedCalls).toBe(40);
});

test("a failed refresh clears identity once and never retries auth endpoints recursively", async () => {
  let refreshes = 0;
  let unauthorized = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    onUnauthorized: () => {
      unauthorized++;
    },
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("login")) return json(grant("old"));
      if (path.endsWith("refresh")) refreshes++;
      return json({ error: { code: "UNAUTHENTICATED", message: "Expired" } }, 401);
    },
  });
  await client.login({ username: "user01", password: "test-only" });
  const result = await Promise.allSettled(
    Array.from({ length: 20 }, () => client.request("/api/accounts")),
  );
  expect(result.every((value) => value.status === "rejected")).toBe(true);
  expect(refreshes).toBe(1);
  expect(unauthorized).toBe(1);
});

test("two clients issue cookie refresh only after acquiring their shared lock", async () => {
  let tail = Promise.resolve();
  const sharedLock = async <T>(work: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
  let cookie = 0;
  let inflight = 0;
  const consumed: number[] = [];
  const fetcher: typeof fetch = async (input) => {
    if (new URL(String(input)).pathname.endsWith("profile")) return json(grant("profile").profile);
    expect(inflight).toBe(0);
    inflight++;
    consumed.push(cookie);
    await new Promise((resolve) => setTimeout(resolve, 10));
    cookie++;
    inflight--;
    return json(grant(`token-${cookie}`));
  };
  const first = createAdminHttp({
    origin: "http://localhost",
    refreshLock: sharedLock,
    fetch: fetcher,
  });
  const second = createAdminHttp({
    origin: "http://localhost",
    refreshLock: sharedLock,
    fetch: fetcher,
  });
  const restored = await Promise.all([first.restore(), second.restore()]);
  expect(restored.every((principal) => principal?.username === "user01")).toBe(true);
  expect(consumed).toEqual([0, 1]);
});

test("a delayed401 from an old access token retries the new token without another refresh", async () => {
  let complete!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  let oldCalls = 0;
  let refreshes = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("login")) return json(grant("old"));
      if (path.endsWith("refresh")) {
        refreshes++;
        return json(grant("new"));
      }
      if (new Headers(options?.headers).get("Authorization") === "Bearer new")
        return json({ ok: true });
      oldCalls++;
      return oldCalls === 1
        ? delayed
        : json({ error: { code: "UNAUTHENTICATED", message: "Expired" } }, 401);
    },
  });
  await client.login({ username: "user01", password: "test-only" });
  const first = client.request("/api/accounts");
  expect(await client.request("/api/accounts")).toEqual({ ok: true });
  complete(json({ error: { code: "UNAUTHENTICATED", message: "Expired" } }, 401));
  expect(await first).toEqual({ ok: true });
  expect(refreshes).toBe(1);
});

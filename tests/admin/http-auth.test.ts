import { expect, test } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";

import { profile, grant, json, immediateLock } from "./helpers/http-client";

test("login, boot refresh/profile and protected calls keep tokens in memory and use credentials include", async () => {
  const calls: { path: string; options: RequestInit }[] = [];
  const before = {
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
    cookie: document.cookie,
  };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options = {}) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, options });
      return json(
        path === "/api/auth/profile"
          ? profile
          : path === "/api/accounts"
            ? { items: [] }
            : grant("memory-secret-token"),
      );
    },
  });
  expect(await client.restore()).toEqual(profile);
  expect(calls.map((call) => call.path)).toEqual(["/api/auth/refresh", "/api/auth/profile"]);
  await client.request("/api/accounts");
  expect(new Headers(calls.at(-1)!.options.headers).get("Authorization")).toBe(
    "Bearer memory-secret-token",
  );
  expect(calls.every((call) => call.options.credentials === "include")).toBe(true);
  expect({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
    cookie: document.cookie,
  }).toEqual(before);
  expect(calls.every((call) => !call.path.includes("memory-secret-token"))).toBe(true);
  client.dispose();
});

test("403 does not refresh and external destinations cannot receive Bearer tokens", async () => {
  let refreshes = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("login")) return json(grant("only-memory"));
      if (path.endsWith("refresh")) refreshes++;
      return json({ error: { code: "FORBIDDEN", message: "Không có quyền" } }, 403);
    },
  });
  await client.login({ username: "user01", password: "test-only" });
  await expect(client.request("/api/accounts")).rejects.toMatchObject({ status: 403 });
  await expect(client.request("https://evil.example/api/accounts")).rejects.toThrow();
  expect(refreshes).toBe(0);
});

test("without Web Locks restore returns login and access expiry requires a fresh login", async () => {
  let now = 0;
  let refreshes = 0;
  let unauthorized = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: null,
    clock: () => now,
    onUnauthorized: () => {
      unauthorized++;
    },
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("refresh")) refreshes++;
      return json({ ...grant("memory"), expiresAt: new Date(900000).toISOString() });
    },
  });
  expect(await client.restore()).toBeNull();
  await client.login({ username: "user01", password: "test-only" });
  now = 900001;
  await expect(client.request("/api/accounts")).rejects.toMatchObject({ status: 401 });
  expect(refreshes).toBe(0);
  expect(unauthorized).toBe(1);
});

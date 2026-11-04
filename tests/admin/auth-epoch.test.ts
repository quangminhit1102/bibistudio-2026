import { expect, test } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { grant, json, immediateLock } from "./helpers/http-client";

test("a delayed login cannot restore identity after logout", async () => {
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      new URL(String(input)).pathname.endsWith("login")
        ? pending
        : new Response(null, { status: 204 }),
  });
  const login = client.login({ username: "user01", password: "test-only" });
  const rejected = expect(login).rejects.toMatchObject({ name: "AbortError" });
  await client.logout();
  complete(json(grant("must-not-resurrect")));
  await rejected;
  await expect(client.request("/api/accounts")).rejects.toMatchObject({ status: 401 });
});

test("a delayed protected response cannot be delivered to another identity", async () => {
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      new URL(String(input)).pathname.endsWith("login") ? json(grant("user-token")) : pending,
  });
  await client.login({ username: "user01", password: "test-only" });
  const request = client.request("/api/accounts");
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  client.dispose();
  complete(json({ private: "previous-user-data" }));
  await rejected;
});

test("a cookie belonging to another tab's account cannot silently switch the current identity", async () => {
  let unauthorized = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    onUnauthorized: () => {
      unauthorized++;
    },
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("login")) return json(grant("first-user"));
      if (path.endsWith("refresh"))
        return json({
          ...grant("other-user"),
          profile: { ...grant("other-user").profile, id: "another-account" },
        });
      if (new Headers(options?.headers).get("Authorization") === "Bearer other-user")
        return json({ private: "other-account-data" });
      return json({ error: { code: "UNAUTHENTICATED", message: "Expired" } }, 401);
    },
  });
  await client.login({ username: "user01", password: "test-only" });
  await expect(client.request("/api/accounts")).rejects.toMatchObject({ status: 401 });
  expect(unauthorized).toBe(1);
});

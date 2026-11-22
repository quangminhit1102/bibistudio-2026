import { it, expect } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { json, grant, immediateLock } from "./helpers/http-client";
it("uploads media as a bounded base64 POST to /api/media", async () => {
  const seen: RequestInit[] = [];
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, init) => {
      const path = String(input);
      if (path.endsWith("/login")) return json(grant("token"));
      seen.push(init!);
      return json({ id: "media-1", width: 40, height: 60, size: 6 });
    },
  });
  await client.login({ username: "user", password: "secret" });
  const result = await client.uploadMedia<{
    id: string;
    width: number;
    height: number;
    size: number;
  }>(new Blob(["pixels"], { type: "image/png" }));
  expect(result).toEqual({ id: "media-1", width: 40, height: 60, size: 6 });
  expect(seen).toHaveLength(1);
  expect(seen[0].method).toBe("POST");
  expect(JSON.parse(seen[0].body as string)).toEqual({ mimeType: "image/png", data: "cGl4ZWxz" });
  expect((seen[0].headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  expect((seen[0].headers as Record<string, string>).Authorization).toBe("Bearer token");
});
it("rejects media over 2 MiB before sending", async () => {
  let sent = 0;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      if (String(input).endsWith("/login")) return json(grant("token"));
      sent++;
      return json({});
    },
  });
  await client.login({ username: "user", password: "secret" });
  await expect(
    client.uploadMedia(new Blob([new Uint8Array(2097153)], { type: "image/png" })),
  ).rejects.toMatchObject({ status: 413 });
  expect(sent).toBe(0);
});

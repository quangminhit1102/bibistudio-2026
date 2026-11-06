import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAuthFixture } from "./auth.mjs";
import { serve } from "./http.mjs";
import { migrateProfiles } from "../../dist/profile/schema.js";
import { createAvatarStore } from "../../dist/profile/avatar-store.js";
import { createApp } from "../../dist/app.js";
export async function createProfileFixture(
  t,
  { wrapStore = (store) => store, observe = () => {} } = {},
) {
  const f = await createAuthFixture(t),
    assetDirectory = await mkdtemp(join(tmpdir(), "bibi-profile-images-"));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  const schemaDirectory = resolve("backend/profile-migrations");
  await migrateProfiles(f.pool, schemaDirectory);
  const assets = wrapStore(createAvatarStore({ root: assetDirectory }));
  const app = createApp(
    { releaseId: "profile-avatar-test", sourceSha: "test" },
    {
      db: f.pool,
      config: f.config,
      clock: f.clock,
      profiles: { schemaDirectory, assetDirectory, assets },
    },
  );
  const base = await serve(t, (req, res) => {
    observe(req, res);
    app(req, res);
  });
  const master = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const request = (path, method = "GET", body, token = master.accessToken) =>
    fetch(base + path, {
      method,
      headers: {
        Origin: f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const upload = (bytes, revision, options = {}) =>
    fetch(base + (options.path ?? "/api/profile/avatar"), {
      method: "PUT",
      signal: options.signal,
      headers: {
        Origin: options.origin ?? f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": options.mime ?? "image/png",
        Authorization: "Bearer " + (options.token ?? user.accessToken),
        ...(revision === undefined ? {} : { "If-Match": '"' + revision + '"' }),
      },
      body: bytes,
    });
  return { ...f, base, master, user, assets, assetDirectory, request, upload };
}

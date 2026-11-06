import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createProfileFixture } from "../backend/test/helpers/profiles.mjs";
import { pngImage } from "../backend/test/helpers/avatar-images.mjs";
import { legacyProfileBackend } from "../backend/test/helpers/legacy-profile-backend.mjs";
import { serve } from "../backend/test/helpers/http.mjs";
const require = createRequire(import.meta.url);
test("actual old backend rollback preserves phone/image through account edit, new backend reads unchanged image", async (t) => {
  const f = await createProfileFixture(t);
  const a = await (await f.upload(pngImage(), 1)).json();
  await f.request(
    "/api/profile",
    "PATCH",
    { revision: a.revision, displayName: "Before rollback", email: null, phone: "0392969000" },
    f.user.accessToken,
  );
  const { createApp } = await legacyProfileBackend(t);
  const old = await serve(
    t,
    createApp(
      { releaseId: "old", sourceSha: "old" },
      { db: f.pool, config: f.config, clock: f.clock },
    ),
  );
  assert.equal((await fetch(old + "/api/ready")).status, 200);
  const headers = {
    Origin: f.config.allowedOrigins[0],
    "X-Bibi-Request": "1",
    "Content-Type": "application/json",
  };
  const login = await fetch(old + "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "admin", password: f.secrets.masterPassword }),
  });
  assert.equal(login.status, 200);
  const grant = await login.json();
  headers.Authorization = "Bearer " + grant.accessToken;
  const read = await fetch(old + "/api/accounts/" + f.user.profile.id, { headers });
  const account = await read.json();
  const edit = await fetch(old + "/api/accounts/" + account.id, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      revision: account.revision,
      username: account.username,
      displayName: "Edited by old backend",
      email: null,
    }),
  });
  assert.equal(edit.status, 200);
  const current = await (
    await f.request("/api/profile", "GET", undefined, f.user.accessToken)
  ).json();
  assert.equal(current.phone, "0392969000");
  assert.equal(current.avatarId, a.avatarId);
  assert.equal(current.displayName, "Edited by old backend");
  assert.equal(
    (
      await fetch(f.base + "/api/profile/avatar/" + a.avatarId, {
        headers: { Authorization: "Bearer " + f.user.accessToken },
      })
    ).status,
    200,
  );
});
test("receiver chooses profile-aware tools for legacy rollback and refuses DB-only fallback", async (t) => {
  const { prepareProfileLifecycle } = require("../ops/profile-lifecycle.cjs"),
    { createProfileMetadata } = require("../ops/profile-metadata.cjs");
  const root = await mkdtemp(join(tmpdir(), "bibi-profile-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "capable");
  await cp(resolve("backend/profile-migrations"), join(dir, "backend/profile-migrations"), {
    recursive: true,
  });
  await cp(resolve("backend/dist/profile"), join(dir, "backend/dist/profile"), { recursive: true });
  await writeFile(
    join(dir, "backend/profile-runtime.json"),
    JSON.stringify(
      await require("../ops/profile-metadata.cjs").createProfileRuntimeMetadata(
        join(dir, "backend"),
      ),
    ),
  );
  const profiles = await createProfileMetadata(join(dir, "backend")),
    capable = { dir, manifest: { profiles, releaseId: "a".repeat(40) + "-1" } },
    legacy = { dir: join(root, "old"), manifest: { releaseId: "b".repeat(40) + "-2" } };
  await mkdir(join(root, "private"), { mode: 0o700 });
  for (const name of ["runtime.env", "maintenance.env"])
    await writeFile(
      join(root, "private", name),
      "PROFILE_ASSET_DIR=" + JSON.stringify(join(root, "private/profile-assets")) + "\n",
      { mode: 0o600 },
    );
  const calls = [],
    receipt = {
      verified: true,
      profiles: true,
      assetCount: 1,
      manifestSha256: "a".repeat(64),
      sha256: "b".repeat(64),
      bytes: 100,
    };
  const run = async (_c, tool, command) => {
    calls.push([tool, command]);
    return command === "profile-status"
      ? { state: "complete", version: 1, migrationChecksums: profiles.migrationChecksums }
      : receipt;
  };
  await prepareProfileLifecycle({ root }, capable, legacy, { run });
  assert.deepEqual(
    calls.map((c) => c[1]),
    ["profile-status", "profile-backup"],
  );
  assert.ok(calls.every((c) => c[0] === dir));
  await assert.rejects(
    prepareProfileLifecycle({ root }, legacy, legacy, { run }),
    /no profile-aware/i,
  );
  await assert.rejects(
    prepareProfileLifecycle({ root }, capable, legacy, {
      run: async (...args) =>
        args[2] === "profile-status"
          ? { state: "complete", version: 1, migrationChecksums: profiles.migrationChecksums }
          : { verified: true },
    }),
    /paired/i,
  );
});

test("receiver compatibility consumes actual migrated schema status and rejects checksum drift", async (t) => {
  const f = await createProfileFixture(t);
  const { profileSchemaStatus } = await import("../backend/dist/profile/schema.js");
  const {
    createProfileMetadata,
    checkProfileCompatibility,
  } = require("../ops/profile-metadata.cjs");
  const metadata = await createProfileMetadata(resolve("backend")),
    status = await profileSchemaStatus(f.pool, resolve("backend/profile-migrations"));
  assert.equal(status.state, "complete");
  assert.doesNotThrow(() => checkProfileCompatibility(metadata, status));
  assert.throws(
    () =>
      checkProfileCompatibility(metadata, {
        ...status,
        migrationChecksums: { "001_profiles.sql": "f".repeat(64) },
      }),
    /checksum/i,
  );
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createAuthFixture } from "../../../backend/test/helpers/auth.mjs";
import { migrateProfiles } from "../../../backend/dist/profile/schema.js";
export async function createProfileAuthFixture(t) {
  const fixture = await createAuthFixture(t),
    assetDirectory = await mkdtemp(join(tmpdir(), "bibi-profile-browser-"));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  await migrateProfiles(fixture.pool, resolve("backend/profile-migrations"));
  return { ...fixture, assetDirectory, profileEnv: { PROFILE_ASSET_DIR: assetDirectory } };
}

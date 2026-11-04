import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, cp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import metadata from "../ops/database-metadata.cjs";
import { createAuthFixture } from "../backend/test/helpers/auth.mjs";
import { previewRelease } from "./preview.mjs";
import { makeManifest } from "./release-manifest.mjs";
import { root } from "./runtime.mjs";
import { randomBytes } from "node:crypto";

test("auth release preview uses supplied private runtime env and closes pools/dependency link", async (t) => {
  const f = await createAuthFixture(t);
  const directory = await mkdtemp(join(tmpdir(), "bibi-auth-preview-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "frontend/assets"), { recursive: true });
  await mkdir(join(directory, "backend"));
  await writeFile(join(directory, "frontend/index.html"), "<html>Preview</html>");
  const manifest = makeManifest(
    "a".repeat(40),
    null,
    await metadata.createDatabaseMetadata(join(root, "backend")),
  );
  for (const name of ["manifest.json", "frontend/version.json"])
    await writeFile(join(directory, name), JSON.stringify(manifest));
  for (const name of ["dist", "migrations"])
    await cp(join(root, "backend", name), join(directory, "backend", name), { recursive: true });
  for (const name of ["package.json", "package-lock.json", "analytics-catalogue.json"])
    await cp(join(root, "backend", name), join(directory, "backend", name));
  let unexpected;
  try {
    await assert.rejects(
      previewRelease(directory, { port: 0, runtimeEnv: {} }).then((app) => {
        unexpected = app;
        return app;
      }),
      /configuration/i,
    );
  } finally {
    await unexpected?.close();
  }
  await assert.rejects(lstat(join(directory, "backend/node_modules")), { code: "ENOENT" });
  const env = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_NAME: f.dbConfig.database,
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
    AUTH_JWT_SECRET: f.config.jwtSecret,
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
  };
  const preview = await previewRelease(directory, { port: 0, runtimeEnv: env });
  try {
    const response = await fetch(preview.url + "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
      },
      body: JSON.stringify({ username: "user01", password: f.secrets.userPassword }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.username, "user01");
    assert.equal((await fetch(preview.url + "/api/ready")).status, 200);
  } finally {
    await preview.close();
  }
  await assert.rejects(lstat(join(directory, "backend/node_modules")), { code: "ENOENT" });
});

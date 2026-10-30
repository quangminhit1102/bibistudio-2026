import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateBundle } from "./build.mjs";
test("bundle validation rejects missing output, secrets and mismatched releases", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-build-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(validateBundle(dir), /missing/i);
  for (const name of ["frontend/assets", "backend/dist"])
    await mkdir(join(dir, name), { recursive: true });
  const m = {
    schemaVersion: 1,
    releaseId: "a".repeat(40) + "-1",
    sourceSha: "a".repeat(40),
    ciRunId: "1",
  };
  for (const name of ["manifest.json", "frontend/version.json"])
    await writeFile(join(dir, name), JSON.stringify(m));
  await writeFile(join(dir, "frontend/index.html"), "<html>test</html>");
  await writeFile(join(dir, "backend/dist/server.js"), "// compiled");
  for (const name of ["backend/package.json", "backend/package-lock.json"])
    await writeFile(join(dir, name), "{}");
  await validateBundle(dir);
  await writeFile(join(dir, "frontend/.env"), "secret");
  await assert.rejects(validateBundle(dir), /forbidden/i);
  await rm(join(dir, "frontend/.env"));
  await writeFile(join(dir, "frontend/version.json"), JSON.stringify({ ...m, releaseId: "other" }));
  await assert.rejects(validateBundle(dir), /mismatch/i);
});

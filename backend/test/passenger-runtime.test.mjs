import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";
test("stable Passenger boots actual createApp with database-backed readiness and authentication", async (t) => {
  const f = await createAuthFixture(t);
  const root = path.resolve("passenger-integration-fixture"), current = path.join(root, "releases/auth");
  let handler;
  const deps = {
    "node:path": path,
    "node:fs": { realpathSync: () => current, readFileSync: () => JSON.stringify({ database: {}, releaseId: "auth", sourceSha: "test" }) },
    "node:http": { createServer: (app) => { handler = app; return { listen: () => {}, close: (fn) => fn() }; } },
    [path.join(current, "backend/dist/app.js")]: { createApp },
    [path.join(current, "backend/dist/db/private-env.js")]: { readPrivateEnvironment: () => ({}) },
    [path.join(current, "backend/dist/runtime.js")]: { createRuntime: () => ({ appOptions: { db: f.pool, config: f.config, clock: f.clock }, close: async () => {} }) },
  };
  vm.runInNewContext(await readFile("ops/passenger/app.cjs", "utf8"), {
    __dirname: path.join(root, "app"), process: { once: () => {} },
    require: (name) => { if (!(name in deps)) throw new Error("Unexpected module"); return deps[name]; },
  });
  const base = await serve(t, handler);
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  assert.equal((await fetch(base + "/api/accounts")).status, 401);
});

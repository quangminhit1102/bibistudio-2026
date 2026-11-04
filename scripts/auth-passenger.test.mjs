import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
test("Passenger loads auth runtime from fixed private file and drains pools on shutdown", async () => {
  const code = await readFile("ops/passenger/app.cjs", "utf8");
  const root = path.resolve("passenger-fixture");
  const current = path.join(root, "releases", "auth-release");
  let runtime = 0,
    closed = 0,
    listened = 0;
  const events = {};
  const deps = {
    "node:path": path,
    "node:fs": {
      realpathSync: () => current,
      readFileSync: () =>
        JSON.stringify({ schemaVersion: 2, database: {}, releaseId: "release", sourceSha: "sha" }),
    },
    "node:http": {
      createServer: () => ({
        listen: () => {
          listened++;
        },
        close: (fn) => fn(),
      }),
    },
    [path.join(current, "backend/dist/app.js")]: {
      createApp: (release, options) => {
        assert.equal(release.releaseId, "release");
        assert.equal(release.db, undefined);
        assert.equal(options.db, "test-pool");
        return () => {};
      },
    },
    [path.join(current, "backend/dist/db/private-env.js")]: {
      readPrivateEnvironment: (file) => {
        assert.equal(file, path.join(root, "private/runtime.env"));
        return { DB_PASSWORD: "test-only", NODE_ENV: "development" };
      },
    },
    [path.join(current, "backend/dist/runtime.js")]: {
      createRuntime: (env) => {
        assert.equal(env.DB_PASSWORD, "test-only");
        assert.equal(env.NODE_ENV, "production");
        assert.equal(env.AMBIENT_SECRET, undefined);
        runtime++;
        return {
          appOptions: { db: "test-pool" },
          close: async () => {
            closed++;
          },
        };
      },
    },
  };
  vm.runInNewContext(code, {
    __dirname: path.join(root, "app"),
    require: (name) => {
      if (!(name in deps)) throw new Error("unexpected module " + name);
      return deps[name];
    },
    process: {
      env: { AMBIENT_SECRET: "never-inherit" },
      once: (name, fn) => {
        events[name] = fn;
      },
      exit: () => {},
    },
  });
  assert.equal(runtime, 1);
  assert.equal(listened, 1);
  await events.SIGTERM();
  await events.SIGINT();
  assert.equal(closed, 1);
});

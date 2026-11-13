import test from "node:test";
import assert from "node:assert/strict";
import { assertLocalDevelopmentTarget } from "./local-database.mjs";
import { prepareLocalAccessLogs } from "./local-database.mjs";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
test("local setup creates synthetic access archives without hosting data or extra daily commands", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-local-logs-"));
  t.after(() => rm(root, { recursive: true }));
  const env = await prepareLocalAccessLogs(root);
  assert.ok(env.ACCESS_LOG_ARCHIVE_DIR.startsWith(root));
  assert.ok(env.ACCESS_LOG_WORK_DIR.startsWith(root));
  assert.ok(env.ACCESS_LOG_CURRENT_DIR.startsWith(root));
  assert.equal((await readdir(env.ACCESS_LOG_CURRENT_DIR)).length, 2);
  assert.ok(
    (
      await readFile(
        join(env.ACCESS_LOG_CURRENT_DIR, env.ACCESS_LOG_DOMAIN_ALIAS + "-ssl_log"),
        "utf8",
      )
    ).includes("local-example"),
  );
  const names = await readdir(env.ACCESS_LOG_ARCHIVE_DIR);
  assert.equal(names.length, 1);
  assert.ok(
    gunzipSync(await readFile(join(env.ACCESS_LOG_ARCHIVE_DIR, names[0])))
      .toString()
      .includes("local-example"),
  );
  await prepareLocalAccessLogs(root);
  assert.equal((await readdir(env.ACCESS_LOG_ARCHIVE_DIR)).length, 1);
});
test("local setup/dev refuses production targets and root runtime users", () => {
  assert.doesNotThrow(() =>
    assertLocalDevelopmentTarget({
      DB_HOST: "127.0.0.1",
      DB_PORT: "33385",
      DB_NAME: "bibi_local",
      DB_USER: "bibi_local_runtime",
    }),
  );
  for (const patch of [
    { DB_HOST: "hosting.example" },
    { DB_NAME: "production" },
    { DB_PORT: "3306" },
    { DB_USER: "root" },
  ])
    assert.throws(
      () =>
        assertLocalDevelopmentTarget({
          DB_HOST: "127.0.0.1",
          DB_PORT: "33385",
          DB_NAME: "bibi_local",
          DB_USER: "bibi_local_runtime",
          ...patch,
        }),
      /local/i,
    );
});

test("local visitor context setup keeps its own stable key and pinned dataset file", async () => {
  const { prepareLocalVisitorContext } = await import("./local-database.mjs");
  assert.equal(typeof prepareLocalVisitorContext, "function");
  const first = await prepareLocalVisitorContext({ ANALYTICS_ID_SECRET: "separate-identity-key" });
  assert.equal(Buffer.from(first.ANALYTICS_RELAY_SECRET, "base64url").length, 32);
  assert.notEqual(first.ANALYTICS_RELAY_SECRET, "separate-identity-key");
  const again = await prepareLocalVisitorContext(first);
  assert.equal(again.ANALYTICS_RELAY_SECRET, first.ANALYTICS_RELAY_SECRET);
  assert.match(again.GEOIP_COUNTRY_FILE, /country\.mmdb$/);
  assert.ok((await readFile(again.GEOIP_COUNTRY_FILE)).length > 0);
});

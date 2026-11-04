import test from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabaseTarget, testDatabaseConfiguration } from "./test-database.mjs";

test("test DB lifecycle rejects production, non-owned names and remote addresses", () => {
  for (const target of [
    { host: "bibistudio.vn", database: "bibi_test_abc123" },
    { host: "127.0.0.1", database: "bibistudio" },
    { host: "localhost", database: "bibi_test_x`; DROP DATABASE mysql;" },
    { host: "10.0.0.1", database: "bibi_test_abc123" },
  ])
    assert.throws(() => assertTestDatabaseTarget(target), /isolated test database/);
  assert.doesNotThrow(() =>
    assertTestDatabaseTarget({ host: "127.0.0.1", database: "bibi_test_abcdef012345" }),
  );
});

test("test DB settings never consume production DB variables and require complete explicit CI settings", () => {
  const production = {
    DB_HOST: "hosting.example",
    DB_USER: "hosting",
    DB_PASSWORD: "production-secret",
    DB_NAME: "production",
  };
  assert.equal(testDatabaseConfiguration(production, "test-only").host, "127.0.0.1");
  assert.equal(testDatabaseConfiguration(production, "test-only").password, "test-only");
  assert.throws(() =>
    testDatabaseConfiguration({ ...production, BIBI_TEST_DB_HOST: "hosting.example" }, "test-only"),
  );
  assert.throws(() => testDatabaseConfiguration({ BIBI_TEST_DB_PASSWORD: "test-only" }));
  assert.deepEqual(
    testDatabaseConfiguration({
      BIBI_TEST_DB_HOST: "127.0.0.1",
      BIBI_TEST_DB_PORT: "3306",
      BIBI_TEST_DB_PASSWORD: "ci-only",
    }),
    { host: "127.0.0.1", port: 3306, user: "root", password: "ci-only" },
  );
});

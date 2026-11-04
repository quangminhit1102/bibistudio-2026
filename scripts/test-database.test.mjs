import test from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabaseTarget } from "./test-database.mjs";

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

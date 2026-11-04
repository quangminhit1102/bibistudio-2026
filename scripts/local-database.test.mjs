import test from "node:test";
import assert from "node:assert/strict";
import { assertLocalDevelopmentTarget } from "./local-database.mjs";
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

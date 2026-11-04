/** Never load the application's DB_* variables in the test lifecycle. */
export function assertTestDatabaseTarget({ host, database }) {
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) ||
    !/^bibi_test_[a-f0-9]{12,32}$/.test(database)
  ) {
    throw new Error("Refusing target: an isolated test database on loopback is required");
  }
}

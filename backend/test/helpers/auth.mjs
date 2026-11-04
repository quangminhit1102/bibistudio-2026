import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDatabaseFixture } from "./database.mjs";

export async function createAuthFixture(t) {
  const fixture = await createDatabaseFixture(t);
  const { migrate } = await import("../../dist/db/migrate.js");
  const { seedIdentity } = await import("../../dist/db/seed.js");
  const { createAuthService } = await import("../../dist/auth/service.js");
  await migrate(fixture.pool, fileURLToPath(new URL("../../migrations", import.meta.url)));
  const secrets = { masterPassword: "Only-test-Auth!99", userPassword: "Only-test-Auth!88" };
  await seedIdentity(fixture.pool, secrets);
  const config = {
    jwtSecret: randomBytes(32).toString("hex"),
    jwtIssuer: "bibi-test",
    jwtAudience: "bibi-admin-test",
    cookieSecure: false,
    allowedOrigins: ["http://localhost:5173"],
    trustProxy: false,
  };
  return {
    ...fixture,
    secrets,
    config,
    auth: createAuthService({ pool: fixture.pool, clock: fixture.clock, config }),
  };
}

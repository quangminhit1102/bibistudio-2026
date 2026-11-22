import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDatabaseFixture } from "./database.mjs";

export async function createAuthFixture(
  t,
  { visitorHistory = true, visitorControls = false, content = false } = {},
) {
  const fixture = await createDatabaseFixture(t);
  const { migrate } = await import("../../dist/db/migrate.js");
  const { seedIdentity } = await import("../../dist/db/seed.js");
  const { createAuthService } = await import("../../dist/auth/service.js");
  await migrate(fixture.pool, fileURLToPath(new URL("../../migrations", import.meta.url)));
  if (visitorHistory) {
    const { migrateVisitorHistory } = await import("../../dist/visitors/schema.js");
    await migrateVisitorHistory(
      fixture.pool,
      fileURLToPath(new URL("../../visitor-migrations", import.meta.url)),
    );
  }
  const secrets = { masterPassword: "Only-test-Auth!99", userPassword: "Only-test-Auth!88" };
  await seedIdentity(fixture.pool, secrets);
  if (visitorControls) {
    const { migrateVisitorControls } = await import("../../dist/visitors/controls-schema.js");
    await migrateVisitorControls(
      fixture.pool,
      fileURLToPath(new URL("../../visitor-controls-migrations", import.meta.url)),
    );
  }
  if (content) {
    const { migrateContent } = await import("../../dist/content/schema.js");
    await migrateContent(
      fixture.pool,
      fileURLToPath(new URL("../../content-migrations", import.meta.url)),
    );
    const { readFileSync } = await import("node:fs");
    const { seedContent } = await import("../../dist/content/seed.js");
    const seedData = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../content-seed.json", import.meta.url)), "utf8"),
    );
    await seedContent(fixture.pool, seedData);
  }
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
    dbConfig: fixture.config,
    secrets,
    config,
    auth: createAuthService({ pool: fixture.pool, clock: fixture.clock, config }),
  };
}

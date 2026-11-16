import test from "node:test";
import { resolve } from "node:path";
import { createContentE2eFixture } from "./helpers/content-fixture.mjs";
import { verifyCmsBrowser } from "./helpers/content-scenarios.mjs";
test(
  "a source draft becomes crawlable only after successful real publication",
  { timeout: 300000 },
  async (t) => {
    const fixture = await createContentE2eFixture(t, { mode: "dev", browser: true });
    await verifyCmsBrowser(t, fixture, {
      mode: "source",
      evidenceDir: resolve(".superpowers/e2e/content-source"),
    });
  },
);

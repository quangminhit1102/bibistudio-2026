import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readDbConfig } from "../config";
import { createCatalogue } from "../visitors/catalogue";
import { createDbPool } from "./pool";
import { readPrivateEnvironment } from "./private-env";
import { verifyReleaseProbe } from "./release-probe";
async function main() {
  const env = readPrivateEnvironment(process.env.BIBI_MAINTENANCE_ENV_FILE);
  const [releaseId, sourceSha, baseUrl] = process.argv.slice(2);
  if (
    !/^[a-f0-9]{40}-[1-9][0-9]*$/.test(releaseId ?? "") ||
    !/^[a-f0-9]{40}$/.test(sourceSha ?? "") ||
    !releaseId.startsWith(sourceSha + "-")
  )
    throw new Error("Invalid release probe identity");
  const pool = createDbPool(readDbConfig(env));
  try {
    const receipt = await verifyReleaseProbe({
      pool,
      baseUrl,
      origin: baseUrl,
      release: { releaseId, sourceSha },
      secret: env.RELEASE_PROBE_SECRET ?? "",
      password: env.RELEASE_PROBE_PASSWORD ?? "",
      catalogue: createCatalogue(
        JSON.parse(readFileSync(resolve(__dirname, "../../analytics-catalogue.json"), "utf8")),
      ),
    });
    console.log(JSON.stringify(receipt));
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(JSON.stringify({ ok: false, error: "Release DB/auth/analytics probe failed" }));
  process.exitCode = 1;
});

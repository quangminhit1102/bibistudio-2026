import { resolve } from "node:path";
import { readDbConfig, systemClock } from "../config";
import { createDbPool } from "../db/pool";
import { readPrivateEnvironment } from "../db/private-env";
import { assertProbeIdentity, PROBE_USERNAME } from "../db/probe-identity";
import { requireAccessLogSchema, createAccessLogReadService } from "./read-service";
import { readAccessLogConfig } from "./config";
async function main() {
  const env = readPrivateEnvironment(process.env.BIBI_MAINTENANCE_ENV_FILE);
  if (!readAccessLogConfig(env).currentDirectory)
    throw new Error("Current source configuration required");
  const args = process.argv.slice(2),
    [releaseId, sourceSha, baseUrl] = args;
  if (
    args.length !== 3 ||
    !/^[a-f0-9]{40}-[1-9][0-9]*$/.test(releaseId ?? "") ||
    !/^[a-f0-9]{40}$/.test(sourceSha ?? "") ||
    !releaseId.startsWith(sourceSha + "-")
  )
    throw new Error("Invalid release identity");
  const url = new URL(baseUrl);
  if (url.origin !== baseUrl || url.protocol !== "https:")
    throw new Error("Exact HTTPS origin required");
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 1 });
  let cookie: string | undefined;
  const request = (path: string, init: RequestInit = {}) =>
    fetch(baseUrl + path, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
  const headers = { Origin: baseUrl, "Content-Type": "application/json", "X-Bibi-Request": "1" };
  const assert = (ok: unknown) => {
    if (!ok) throw new Error("Access log probe failed");
  };
  try {
    await assertProbeIdentity(pool);
    await requireAccessLogSchema(pool, resolve(__dirname, "../../access-log-migrations"));
    const status = await createAccessLogReadService(pool, systemClock).status();
    const current = await createAccessLogReadService(pool, systemClock, "current").status();
    // Bootstrap freshness is gated before activation; rollback must still work if log sources go stale.
    assert(
      Number.isSafeInteger(status.total) &&
        Number.isSafeInteger(current.total) &&
        current.sources.length === 2,
    );
    const version = await request("/api/version");
    assert(
      version.status === 200 &&
        ((await version.json()) as { releaseId: string }).releaseId === releaseId,
    );
    assert((await request("/api/customer-access/access-logs/status")).status === 401);
    const login = await request("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ username: PROBE_USERNAME, password: env.RELEASE_PROBE_PASSWORD }),
    });
    assert(login.status === 200);
    cookie = login.headers
      .getSetCookie()
      .find((value) => value.startsWith("bibi_refresh="))
      ?.split(";")[0];
    const grant = (await login.json()) as {
      accessToken: string;
      profile: { permissions: string[]; fullAccess: boolean; isMaster: boolean };
    };
    assert(
      cookie &&
        grant.profile.permissions.length === 0 &&
        !grant.profile.fullAccess &&
        !grant.profile.isMaster,
    );
    for (const scope of ["current", "archive"])
      assert(
        (
          await request("/api/customer-access/access-logs/status?scope=" + scope, {
            headers: { Authorization: "Bearer " + grant.accessToken },
          })
        ).status === 403,
      );
    console.log(
      JSON.stringify({
        ok: true,
        accessLogs: true,
        releaseId,
        archiveRecords: status.total,
        currentRecords: current.total,
        archiveState: status.state,
        currentState: current.state,
        sourceFresh: !status.stale && !current.stale,
        parseErrors: status.parseErrors,
      }),
    );
  } finally {
    try {
      if (cookie)
        assert(
          (
            await request("/api/auth/logout", {
              method: "POST",
              headers: { ...headers, Cookie: cookie },
              body: "{}",
            })
          ).status === 204,
        );
    } finally {
      await pool.end();
    }
  }
}
void main().catch(() => {
  console.error(JSON.stringify({ ok: false, error: "Access log release probe failed" }));
  process.exitCode = 1;
});

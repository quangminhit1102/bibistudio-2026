import type { Pool, RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";
import type { Catalogue } from "../visitors/catalogue";
import type { ReleaseInfo } from "../release";
import type { PrincipalDto } from "../http/contracts";
import { createProbeMarker } from "../visitors/probe";
import { PROBE_USERNAME, assertProbeIdentity } from "./probe-identity";

interface ProbeOptions {
  pool: Pool;
  baseUrl: string;
  origin: string;
  secret: string;
  password: string;
  release: ReleaseInfo;
  catalogue: Catalogue;
  allowLocal?: boolean;
}
/** Which step of the probe failed and how. Both fields are built from fixed words, an error
 * class name, an error code and an HTTP status only, so the deploy log can repeat them. */
export class ReleaseProbeError extends Error {
  constructor(
    readonly step: string,
    readonly reason: string,
  ) {
    super(`Release probe failed at step "${step}": ${reason}`);
  }
}
/** An error's class name and code, never its message (a message can carry a host or a query). */
export function errorKind(error: unknown) {
  if (!(error instanceof Error)) return "unknown error";
  const own = (error as { code?: unknown }).code;
  const cause = (error.cause as { code?: unknown } | undefined)?.code;
  const code = [own, cause].find(
    (value): value is string => typeof value === "string" && /^[A-Z0-9_]{1,60}$/.test(value),
  );
  const name = /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : "Error";
  return code ? `${name} ${code}` : name;
}
class AssertionFailure extends Error {}
export async function verifyReleaseProbe(options: ProbeOptions) {
  const { pool, baseUrl, origin, secret, password, release, catalogue } = options;
  const url = new URL(baseUrl);
  if (
    url.origin !== baseUrl ||
    (url.protocol !== "https:" &&
      !(
        options.allowLocal &&
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      ))
  )
    throw new Error("Release probe requires an exact HTTPS origin");
  let step = "probe account";
  let last = "no request sent";
  const failure = (error: unknown) =>
    new ReleaseProbeError(
      step,
      (error instanceof AssertionFailure ? "unexpected result" : errorKind(error)) + ", " + last,
    );
  const id = await assertProbeIdentity(pool).catch((error: unknown) => {
    throw failure(error);
  });
  const request = async (path: string, init: RequestInit = {}) => {
    const call = `${init.method ?? "GET"} ${path}`;
    last = `${call} got no response`;
    const response = await fetch(baseUrl + path, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    last = `after ${call} HTTP ${response.status}`;
    return response;
  };
  function expect(condition: unknown): asserts condition {
    if (!condition) throw new AssertionFailure("Release acceptance assertion failed");
  }
  const headers = { Origin: origin, "Content-Type": "application/json", "X-Bibi-Request": "1" };
  const post = (path: string, body: unknown, extra: Record<string, string> = {}) =>
    request(path, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  const cookie = (response: Response, name: string) => {
    const value = response.headers.getSetCookie().find((value) => value.startsWith(name + "="));
    expect(value && /;\s*HttpOnly/i.test(value));
    if (url.protocol === "https:") expect(/;\s*Secure/i.test(value));
    return value.split(";", 1)[0];
  };
  const restricted = (profile: PrincipalDto) =>
    expect(
      profile.id === id &&
        profile.username === PROBE_USERNAME &&
        profile.isMaster === false &&
        profile.fullAccess === false &&
        profile.roleIds.length === 0 &&
        profile.permissions.length === 0,
    );
  let refreshCookie: string | undefined;
  try {
    step = "version";
    const version = await request("/api/version");
    const identity = (await version.json()) as ReleaseInfo;
    expect(
      version.ok &&
        identity.releaseId === release.releaseId &&
        identity.sourceSha === release.sourceSha,
    );
    step = "ready";
    expect((await request("/api/ready")).status === 200);
    step = "accounts without login";
    expect((await request("/api/accounts")).status === 401);
    step = "login";
    const login = await post("/api/auth/login", { username: PROBE_USERNAME, password });
    expect(login.status === 200);
    refreshCookie = cookie(login, "bibi_refresh");
    const grant = (await login.json()) as { accessToken: string; profile: PrincipalDto };
    restricted(grant.profile);
    step = "profile";
    const authHeaders = { Authorization: "Bearer " + grant.accessToken };
    const profile = await request("/api/auth/profile", { headers: authHeaders });
    expect(profile.status === 200);
    restricted((await profile.json()) as PrincipalDto);
    step = "refused admin routes";
    for (const path of ["/api/accounts", "/api/roles", "/api/customer-access"])
      expect((await request(path, { headers: authHeaders })).status === 403);
    step = "refresh";
    const refreshed = await post("/api/auth/refresh", {}, { Cookie: refreshCookie });
    expect(refreshed.status === 200);
    const nextCookie = cookie(refreshed, "bibi_refresh");
    expect(nextCookie !== refreshCookie);
    refreshCookie = nextCookie;
    restricted(((await refreshed.json()) as { profile: PrincipalDto }).profile);
    step = "analytics catalogue";
    const slug = catalogue.products.keys().next().value;
    expect(slug);
    const path = "/products/" + slug;
    expect(catalogue.routes.has(path));
    const marker = createProbeMarker(secret, release.releaseId, new Date());
    const batch = { paths: [path], products: [slug], lastPath: path };
    const probeHeaders = { "X-Bibi-Probe": marker };
    step = "analytics collect";
    const bootstrap = await post("/api/analytics/collect", batch, probeHeaders);
    expect(bootstrap.status === 202);
    const visitorCookie = cookie(bootstrap, "bibi_visitor");
    for (let i = 0; i < 2; i++)
      expect(
        (await post("/api/analytics/collect", batch, { ...probeHeaders, Cookie: visitorCookie }))
          .status === 204,
      );
    step = "analytics record";
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT v.is_probe,s.page_count,s.product_count,s.truncated,(SELECT COUNT(*) FROM visitor_session_pages p WHERE p.session_id=s.id AND p.path=?) pages,(SELECT COUNT(*) FROM visitor_viewed_products p WHERE p.session_id=s.id AND p.product_slug=?) products FROM release_probes r JOIN visitors v ON v.id=r.visitor_id JOIN visitor_sessions s ON s.visitor_id=v.id WHERE r.release_id=? AND r.marker_hash=?",
      [path, slug, release.releaseId, createHash("sha256").update(marker).digest("hex")],
    );
    expect(
      rows.length === 1 &&
        Number(rows[0].is_probe) === 1 &&
        Number(rows[0].page_count) === 1 &&
        Number(rows[0].product_count) === 1 &&
        !rows[0].truncated &&
        Number(rows[0].pages) === 1 &&
        Number(rows[0].products) === 1,
    );
    step = "logout";
    const logout = await post("/api/auth/logout", {}, { Cookie: refreshCookie });
    expect(logout.status === 204);
    step = "refresh after logout";
    expect((await post("/api/auth/refresh", {}, { Cookie: refreshCookie })).status === 401);
    refreshCookie = undefined;
    return { ok: true, releaseId: release.releaseId, auth: true, rbac: true, analytics: true };
  } catch (error) {
    throw failure(error);
  } finally {
    if (refreshCookie)
      await post("/api/auth/logout", {}, { Cookie: refreshCookie }).catch(() => undefined);
  }
}

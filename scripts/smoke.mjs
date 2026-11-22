import { isMain } from "./runtime.mjs";
export async function smoke({
  baseUrl,
  expectedRelease,
  expectedSha,
  expectedRelay = false,
  request = fetch,
  warn = console.warn,
}) {
  const get = async (path, type) => {
    const response = await request(new URL(path, baseUrl), {
      cache: "no-store",
      headers: { DNT: "1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes(type))
      throw new Error(
        `${path}: expected ${type === "application/json" ? "JSON" : type}, HTTP ${response.status}`,
      );
    return response;
  };
  for (const path of ["/api/version", "/version.json"]) {
    const v = await (await get(path, "application/json")).json();
    if (v.releaseId !== expectedRelease || v.sourceSha !== expectedSha)
      throw new Error(`${path}: release mismatch`);
  }
  if ((await (await get("/api/health", "application/json")).json()).ok !== true)
    throw new Error("API unhealthy");
  const unknown = await request(new URL("/api/unknown", baseUrl), { headers: { DNT: "1" } });
  if (unknown.status !== 404 || !unknown.headers.get("content-type")?.includes("application/json"))
    throw new Error("API 404 must be JSON");
  const page = await get("/products/ca-phe-voi-nguoi-thuong-notebook", "text/html");
  // A warning, not a failure: releases built before these headers existed must still pass
  // when they are redeployed or restored by a rollback.
  for (const name of ["strict-transport-security", "x-content-type-options", "referrer-policy"])
    if (!page.headers.get(name)) warn(`::warning::Page is served without ${name}`);
  // Also a warning: the rule is written by the deploy tools on the server, which a release
  // does not update.
  const script = (await page.text()).match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  if (script) {
    const cacheControl = (await get(script, "javascript")).headers.get("cache-control");
    if (!cacheControl?.includes("immutable"))
      warn(
        `::warning::${script} is not cached as immutable (${cacheControl ?? "no Cache-Control"})`,
      );
  }
  await get("/catalogue/motivation-ca-phe-nguoi-thuong.jpeg", "image/");
  if (expectedRelay) {
    const relay = await request(new URL("/api/analytics/relay/collect.php", baseUrl), {
      cache: "no-store",
      redirect: "error",
      headers: { DNT: "1" },
      signal: AbortSignal.timeout(6000),
    });
    if (
      relay.status !== 405 ||
      !relay.headers.get("content-type")?.includes("application/json") ||
      (await relay.json())?.error?.code !== "ANALYTICS_RELAY_REJECTED"
    )
      throw new Error("PHP relay routing smoke failed");
  }
  console.log(`HTTP smoke passed: ${expectedRelease}`);
}
if (isMain(import.meta.url))
  smoke({
    baseUrl: process.env.BASE_URL,
    expectedRelease: process.env.RELEASE_ID,
    expectedSha: process.env.SOURCE_SHA,
  }).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

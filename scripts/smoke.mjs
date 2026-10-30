import { isMain } from "./runtime.mjs";
export async function smoke({ baseUrl, expectedRelease, expectedSha, request = fetch }) {
  const get = async (path, type) => {
    const response = await request(new URL(path, baseUrl), {
      cache: "no-store",
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
  await get("/api/demo", "application/json");
  const unknown = await request(new URL("/api/unknown", baseUrl));
  if (unknown.status !== 404 || !unknown.headers.get("content-type")?.includes("application/json"))
    throw new Error("API 404 must be JSON");
  await get("/products/ca-phe-voi-nguoi-thuong-notebook", "text/html");
  await get("/catalogue/motivation-ca-phe-nguoi-thuong.jpeg", "image/");
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

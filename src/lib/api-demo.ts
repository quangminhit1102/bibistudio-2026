export interface ApiRelease {
  releaseId: string;
  sourceSha: string;
}
export async function loadApiDemo(
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<{ backend: ApiRelease }> {
  async function json(path: string) {
    const response = await request(path, { signal, cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error(`${path}: Expected JSON; check API routing`);
    return response.json();
  }
  const backend = await json("/api/version");
  if (typeof backend?.releaseId !== "string" || typeof backend?.sourceSha !== "string")
    throw new Error("Invalid API release metadata");
  return { backend };
}

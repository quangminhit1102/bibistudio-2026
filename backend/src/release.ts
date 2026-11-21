import { readFileSync } from "node:fs";

export interface ReleaseInfo {
  releaseId: string;
  sourceSha: string;
  schemaVersion?: number;
}
export function readRelease(): ReleaseInfo {
  const file = process.env.BIBI_RELEASE_MANIFEST;
  if (!file) return { releaseId: "local", sourceSha: "local" };
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (typeof data.releaseId !== "string" || typeof data.sourceSha !== "string") {
    throw new Error("Invalid release manifest");
  }
  return {
    releaseId: data.releaseId,
    sourceSha: data.sourceSha,
    ...([4, 5, 6, 7].includes(data.schemaVersion) ? { schemaVersion: data.schemaVersion } : {}),
  };
}

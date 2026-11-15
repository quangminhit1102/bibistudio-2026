import { readFileSync } from "node:fs";

export interface ReleaseInfo {
  releaseId: string;
  sourceSha: string;
  schemaVersion?: number;
  content?: { mode: "bridge" | "cms"; publicReaderVersion: 1 };
}
export function readRelease(env: NodeJS.ProcessEnv = process.env): ReleaseInfo {
  const file = env.BIBI_RELEASE_MANIFEST;
  if (!file) return { releaseId: "local", sourceSha: "local" };
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (typeof data.releaseId !== "string" || typeof data.sourceSha !== "string") {
    throw new Error("Invalid release manifest");
  }
  return {
    releaseId: data.releaseId,
    sourceSha: data.sourceSha,
    ...([4, 5, 6, 7].includes(data.schemaVersion) ? { schemaVersion: data.schemaVersion } : {}),
    ...(data.content &&
    ["bridge", "cms"].includes(data.content.mode) &&
    data.content.publicReaderVersion === 1
      ? { content: { mode: data.content.mode, publicReaderVersion: 1 as const } }
      : {}),
  };
}

import { readFile, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const compressedLimit = 32 * 1024 * 1024,
  expandedLimit = 64 * 1024 * 1024;
const digest = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
export function verifyCountryArchive(bytes, lock, limits = {}) {
  if (bytes.length > (limits.compressedLimit ?? compressedLimit))
    throw new Error("Country archive size limit");
  if (digest(bytes) !== lock.archiveSha256) throw new Error("Country archive checksum mismatch");
  const data = gunzipSync(bytes, { maxOutputLength: limits.expandedLimit ?? expandedLimit });
  if (digest(data) !== lock.mmdbSha256) throw new Error("Country MMDB checksum mismatch");
  if (!["archive", "mmdb"].includes(lock.vendorDigestTarget))
    throw new Error("Unknown vendor digest target");
  if (digest(lock.vendorDigestTarget === "archive" ? bytes : data, "sha1") !== lock.vendorSha1)
    throw new Error("Country vendor checksum mismatch");
  return data;
}
export async function downloadCountryArchive(
  url,
  { fetcher = fetch, limit = compressedLimit, timeoutMs = 30000 } = {},
) {
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("Country download HTTP " + response.status);
  if (!response.body) throw new Error("Empty country download");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Country download size limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function prepareCountryDataset({
  file = fileURLToPath(new URL("../backend/geoip/country.mmdb", import.meta.url)),
  lockFile = new URL("./geoip-country.lock.json", import.meta.url),
} = {}) {
  const lock = JSON.parse(await readFile(lockFile, "utf8"));
  try {
    const existing = await readFile(file);
    if (digest(existing) === lock.mmdbSha256) return { file, ...lock };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const bytes = verifyCountryArchive(await downloadCountryArchive(lock.url), lock);
  await mkdir(dirname(file), { recursive: true });
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return { file, ...lock };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  prepareCountryDataset()
    .then(({ version, mmdbBytes }) =>
      console.log(`Country dataset ready: ${version} (${mmdbBytes} bytes)`),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });

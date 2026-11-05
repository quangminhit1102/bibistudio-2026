export function accessLogLine(options = {}) {
  const value = {
    ip: "203.0.113.42",
    time: "05/Nov/2026:14:00:01 +0700",
    request: "GET /products/a?token=secret#fragment HTTP/1.1",
    status: "200",
    bytes: "123",
    referrer: "https://example.com/story?token=secret",
    agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0",
    ...options,
  };
  return Buffer.from(
    `${value.ip} - - [${value.time}] ${JSON.stringify(value.request)} ${value.status} ${value.bytes} ${JSON.stringify(value.referrer)} ${JSON.stringify(value.agent)}`,
  );
}
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";

export async function archiveFixture(t, limits = {}) {
  const root = await mkdtemp(join(tmpdir(), "bibi-log-test-"));
  t.after(() => {
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + "/") &&
      !resolve(root).startsWith(resolve(tmpdir()) + "\\")
    )
      throw Error("Unsafe fixture cleanup");
    return rm(root, { recursive: true });
  });
  const archiveDirectory = join(root, "archives"),
    workDirectory = join(root, "private-work");
  await mkdir(archiveDirectory);
  const domainAlias = "bibistudio.vn.vhplastic.com";
  const config = {
    archiveDirectory,
    workDirectory,
    domainAlias,
    limits: {
      compressedBytes: 64 * 1024 * 1024,
      expandedBytes: 256 * 1024 * 1024,
      workBytes: 512 * 1024 * 1024,
      lineBytes: 65536,
      batchRows: 2,
      runMs: 120000,
      ...limits,
    },
  };
  const basename = domainAlias + "-Nov-2026.gz",
    file = join(archiveDirectory, basename);
  const write = async (lines, suffix = "\n") => {
    const content = Buffer.concat(
      lines.flatMap((line, index) => [
        Buffer.from(line),
        Buffer.from(index === lines.length - 1 ? suffix : "\n"),
      ]),
    );
    await writeFile(file, gzipSync(content));
    return content;
  };
  return { config, basename, file, root, write };
}

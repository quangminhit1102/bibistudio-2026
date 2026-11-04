import { readFile, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const container = process.env.BIBI_TEST_DB_CONTAINER || "bibi-auth-test-mariadb-20261104";
export async function bridge(kind, args, io, runNativeTool) {
  const docker =
    process.platform === "win32"
      ? "C:/Program Files/Docker/Docker/resources/bin/docker.exe"
      : "docker";
  const prefix = process.platform === "win32" ? ["--context", "desktop-linux"] : [];
  const remote = "/tmp/bibi-backup-" + randomUUID() + ".cnf";
  const source = args[0].slice("--defaults-file=".length);
  const local = source + ".container";
  await writeFile(local, (await readFile(source, "utf8")).replace(/^port=.*$/m, "port=3306"), {
    mode: 0o600,
    flag: "wx",
  });
  try {
    await runNativeTool(
      docker,
      [...prefix, "exec", "-i", container, "sh", "-c", `umask 077; cat > ${remote}`],
      { inputFile: local },
    );
    await runNativeTool(
      docker,
      [
        ...prefix,
        "exec",
        "-i",
        container,
        kind === "dump" ? "mariadb-dump" : "mariadb",
        "--defaults-file=" + remote,
        ...args.slice(1),
      ],
      io,
    );
  } finally {
    await unlink(local);
    await execute(docker, [...prefix, "exec", container, "rm", "-f", remote], {
      windowsHide: true,
      env: { ...process.env, DOCKER_API_VERSION: "1.43" },
    });
  }
}



import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, rmdir, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
const [platform, file] = process.argv.slice(2),
  nonce = randomBytes(16).toString("hex"),
  directory = file + ".content-lock",
  owner = join(directory, `owner-${nonce}.json`),
  parentPid = process.ppid;
let closing = false,
  owned = false,
  waiting: ChildProcess | undefined;
const message = (event: string) =>
  process.stdout.write(JSON.stringify({ event, pid: process.pid, nonce }) + "\n");
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
async function reclaimDeadOwner() {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error("Unsafe lock directory");
  const names = await readdir(directory);
  if (names.length !== 1 || !/^owner-[a-f0-9]{32}\.json$/.test(names[0])) return;
  const oldFile = join(directory, names[0]),
    record = JSON.parse(await readFile(oldFile, "utf8"));
  if (
    !Number.isInteger(record.pid) ||
    record.pid <= 0 ||
    !Number.isInteger(record.parentPid) ||
    record.parentPid <= 0 ||
    names[0] !== `owner-${record.nonce}.json` ||
    alive(record.pid) ||
    alive(record.parentPid)
  )
    return;
  // Only the winner that removes this exact nonce may remove the directory.
  // A loser cannot unlink a later owner's different marker or remove its directory.
  try {
    await unlink(oldFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await rmdir(directory);
}
async function close() {
  if (closing) return;
  closing = true;
  waiting?.kill();
  if (platform === "win32" && owned) {
    try {
      const record = JSON.parse(await readFile(owner, "utf8"));
      if (record.pid === process.pid && record.nonce === nonce) {
        await unlink(owner);
        await rmdir(directory);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        await rmdir(directory).catch(() => {});
    }
  }
  process.exit(0);
}
process.stdin.on("end", () => void close());
process.stdin.resume();
process.on("SIGTERM", () => void close());
process.stdin.on("error", () => void close());
process.stdout.on("error", () => void close());
message("starting");
async function main() {
  if (platform === "linux") {
    // FD3 shares the parent's open file description: a killed holder cannot release
    // the kernel lock while the parent is still unwinding the protected work.
    await new Promise<void>((resolve, reject) => {
      waiting = spawn("flock", ["-x", "-w", "120", "3"], {
        stdio: ["ignore", "ignore", "ignore", 3],
      });
      waiting.once("error", reject);
      waiting.once("exit", (code) => (code === 0 ? resolve() : reject(Error("Lock unavailable"))));
    });
    waiting = undefined;
  } else if (platform === "win32") {
    const deadline = Date.now() + 120000;
    while (!closing) {
      try {
        await mkdir(directory, { mode: 0o700 });
        owned = true;
        await writeFile(owner, JSON.stringify({ pid: process.pid, parentPid, nonce }), {
          flag: "wx",
          mode: 0o600,
        });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() > deadline) throw Error("Lock unavailable");
        try {
          await reclaimDeadOwner();
        } catch (reclaimError) {
          if (!["ENOENT", "ENOTEMPTY"].includes((reclaimError as NodeJS.ErrnoException).code ?? ""))
            throw reclaimError;
        }
        await new Promise((done) => setTimeout(done, 50));
      }
    }
  } else throw Error("Unsupported content-lock platform");
  if (!closing) message("acquired");
}
void main().catch(() => {
  console.error("Content lock unavailable");
  process.exitCode = 1;
  void close();
});

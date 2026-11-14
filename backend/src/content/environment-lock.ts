import { spawn } from "node:child_process";
import { constants, readFileSync } from "node:fs";
import { open, realpath, stat, readFile, unlink, rmdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { ApiError } from "../http/errors";
import type { ContentPaths } from "./contracts";
export interface ContentEnvironmentLease {
  readonly signal: AbortSignal;
  readonly holderPid: number;
  assertActive(): void;
}
const seals = new WeakMap<object, { path: string; active: boolean }>();
const lost = () =>
  new ApiError(503, "CONTENT_LOCK_LOST", "Khóa môi trường đã mất, vui lòng thử lại");
export async function underContentEnvironmentLease<T>(
  paths: ContentPaths,
  lease: ContentEnvironmentLease,
  work: (lease: ContentEnvironmentLease) => Promise<T>,
): Promise<T> {
  const seal = seals.get(lease);
  if (!seal?.active || seal.path !== resolve(paths.deployLock)) throw lost();
  lease.assertActive();
  return work(lease);
}
export async function withContentEnvironmentLock<T>(
  paths: ContentPaths,
  work: (lease: ContentEnvironmentLease) => Promise<T>,
): Promise<T> {
  const file = paths.deployLock;
  if (!isAbsolute(file) || (await realpath(dirname(file))) !== dirname(resolve(file)))
    throw new ApiError(503, "CONTENT_LOCK_CONFIG", "Cấu hình khóa nội dung không hợp lệ");
  const handle =
    process.platform === "linux"
      ? await open(file, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW, 0o600)
      : undefined;
  if (handle) {
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== process.getuid?.()) {
      await handle.close();
      throw lost();
    }
    await handle.chmod(0o600);
  }
  const child = spawn(
    process.execPath,
    [join(__dirname, "lock-holder.js"), process.platform, file],
    {
      stdio: ["pipe", "pipe", "pipe", ...(handle ? [handle.fd] : [])],
      windowsHide: true,
      env: {
        PATH: process.env.PATH,
        LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
      },
    },
  );
  child.stderr!.resume();
  const lines = createInterface({ input: child.stdout! }),
    controller = new AbortController();
  let nonce = "",
    finished = false,
    lease: ContentEnvironmentLease | undefined;
  child.stdin!.on("error", () => {
    if (!finished) controller.abort(lost());
  });
  child.once("exit", () => {
    if (!finished) controller.abort(lost());
  });
  child.once("error", () => controller.abort(lost()));
  try {
    await new Promise<void>((done, fail) => {
      const timer = setTimeout(
        () => fail(new ApiError(503, "CONTENT_LOCK_BUSY", "Môi trường đang bận, vui lòng thử lại")),
        121000,
      );
      const aborted = () => {
        clearTimeout(timer);
        fail(lost());
      };
      controller.signal.addEventListener("abort", aborted, { once: true });
      lines.on("line", (line) => {
        try {
          const value = JSON.parse(line);
          if (value.pid !== child.pid || !/^[a-f0-9]{32}$/.test(value.nonce)) throw lost();
          nonce = value.nonce;
          if (value.event === "acquired") {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", aborted);
            done();
          }
        } catch {
          clearTimeout(timer);
          fail(lost());
        }
      });
    });
    lease = {
      holderPid: child.pid!,
      signal: controller.signal,
      assertActive() {
        if (controller.signal.aborted || child.exitCode !== null || child.signalCode !== null)
          throw lost();
        try {
          process.kill(child.pid!, 0);
        } catch {
          throw lost();
        }
        if (process.platform === "win32") {
          try {
            const owner = JSON.parse(
              readFileSync(join(file + ".content-lock", `owner-${nonce}.json`), "utf8"),
            );
            if (owner.pid !== child.pid || owner.parentPid !== process.pid || owner.nonce !== nonce)
              throw lost();
          } catch {
            throw lost();
          }
        }
      },
    };
    seals.set(lease, { path: resolve(file), active: true });
    lease.assertActive();
    return await work(lease);
  } finally {
    if (lease) seals.get(lease)!.active = false;
    finished = true;
    lines.close();
    child.stdin!.end();
    if (child.exitCode === null && child.signalCode === null)
      await new Promise<void>((done) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          done();
        }, 2000);
        child.once("close", () => {
          clearTimeout(timer);
          done();
        });
      });
    // Windows cleanup only ever removes this known dead holder's matching nonce.
    // Other contenders can reclaim only when BOTH the holder and parent are dead.
    if (process.platform === "win32" && nonce) {
      const directory = file + ".content-lock",
        owner = join(directory, `owner-${nonce}.json`);
      try {
        const record = JSON.parse(await readFile(owner, "utf8"));
        if (record.pid === child.pid && record.nonce === nonce) {
          await unlink(owner);
          await rmdir(directory);
        }
      } catch (error) {
        if (!["ENOENT", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? ""))
          console.error(JSON.stringify({ event: "content_lock_cleanup_failed" }));
      }
    }
    await handle?.close();
  }
}

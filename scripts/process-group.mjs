import { spawn, execFile } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { promisify } from "node:util";
export function spawnOwned(command, args, options = {}) {
  return spawn(command, args, {
    windowsHide: true,
    detached: process.platform !== "win32",
    ...options,
  });
}
export async function stopOwned(children) {
  await Promise.all(
    children.map(async (child) => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit").catch(() => {});
      try {
        if (process.platform === "win32")
          await promisify(execFile)("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true,
          });
        else process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (child.exitCode === null && child.signalCode === null && error.code !== "ESRCH")
          throw error;
      }
      let timer;
      await Promise.race([
        exited,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 5000);
        }),
      ]);
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null)
        throw new Error(`Could not stop owned process ${child.pid}`);
    }),
  );
}
export async function assertPortsFree(ports) {
  if (new Set(ports).size !== ports.length)
    throw new Error("FE, BE and inspector ports must differ");
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(`Invalid port ${port}`);
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", () => reject(new Error(`Port ${port} is in use or unavailable`)));
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
}

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const isMain = (url) =>
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;
export function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolveRun() : reject(new Error(`${command} failed (${code ?? signal})`)),
    );
  });
}
export function runNpm(args, cwd = root) {
  if (process.env.npm_execpath?.endsWith(".js"))
    return run(process.execPath, [process.env.npm_execpath, ...args], { cwd });
  return run(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd,
    shell: process.platform === "win32",
  });
}

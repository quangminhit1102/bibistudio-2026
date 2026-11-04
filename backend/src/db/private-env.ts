import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseEnv } from "node:util";

export function readPrivateEnvironment(file: string | undefined): NodeJS.ProcessEnv {
  if (!file || !isAbsolute(file)) throw new Error("Absolute private configuration file required");
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error("Private configuration must be a regular file");
  if (
    process.platform !== "win32" &&
    ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
  )
    throw new Error("Private configuration must be owned and mode0600");
  const actual = realpathSync(file),
    expected = resolve(file);
  if (
    (process.platform === "win32" ? actual.toLowerCase() : actual) !==
    (process.platform === "win32" ? expected.toLowerCase() : expected)
  )
    throw new Error("Private configuration cannot use symbolic parents");
  return parseEnv(readFileSync(file, "utf8"));
}

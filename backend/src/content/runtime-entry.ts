import { dirname, join, extname } from "node:path";
export function siblingContentEntry(moduleFile: string, name: string): string {
  return join(dirname(moduleFile), name + (extname(moduleFile) === ".ts" ? ".ts" : ".js"));
}
/** Source dev keeps TSX's loader, while each child leaves the API inspector port alone. */
export function contentNodeArgs(entry: string, args: string[] = []): string[] {
  return [
    ...(entry.endsWith(".ts")
      ? process.execArgv.filter((arg) => !arg.startsWith("--inspect"))
      : []),
    entry,
    ...args,
  ];
}

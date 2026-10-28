#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const artifactEntries = [
  "assets",
  "catalogue",
  "Images",
  ".htaccess",
  "bibi-logo.svg",
  "bibi-mark.svg",
  "favicon.svg",
  "index.html",
  "robots.txt",
  "zalo.png",
];

const modeConfigs = {
  temp: {
    buildScript: "build:cpanel:temp",
    branch: "deploy/cpanel-temp",
    deployPath: "/home/vhplasti/public_html/",
  },
  prod: {
    buildScript: "build:cpanel",
    branch: "deploy/cpanel-prod",
    deployPath: "/home/vhplasti/bibistudio.vn/",
  },
};

export function getModeConfig(mode) {
  const config = modeConfigs[mode];
  if (!config) {
    throw new Error(`Unknown mode "${mode}". Use "temp" or "prod".`);
  }
  return { ...config };
}

export function toSafeWorkdirName(branch) {
  return branch.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function renderCpanelYml(deployPath) {
  return [
    "---",
    "deployment:",
    "  tasks:",
    `    - export DEPLOYPATH=${deployPath}`,
    '    - /bin/cp -R assets catalogue Images "$DEPLOYPATH"',
    '    - /bin/cp .htaccess index.html favicon.svg robots.txt zalo.png bibi-logo.svg bibi-mark.svg "$DEPLOYPATH"',
    "",
  ].join("\n");
}

function run(command, args, options = {}) {
  const commandName = process.platform === "win32" && command === "npm" ? "cmd.exe" : command;
  const commandArgs =
    process.platform === "win32" && command === "npm" ? ["/d", "/s", "/c", command, ...args] : args;

  const result = spawnSync(commandName, commandArgs, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    const output = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`Command failed: ${command} ${args.join(" ")}${output ? `\n${output}` : ""}`);
  }

  return result.stdout?.trim() ?? "";
}

function copyArtifacts(sourceDir, targetDir) {
  for (const entry of artifactEntries) {
    const source = join(sourceDir, entry);
    if (!existsSync(source)) {
      throw new Error(`Missing build artifact: ${source}`);
    }
    cpSync(source, join(targetDir, entry), { recursive: true, force: true });
  }
}

function clearDirectoryExceptGit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    rmSync(join(dir, entry.name), { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = {
    mode: "temp",
    deployPath: undefined,
    push: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") args.mode = argv[++index];
    else if (arg === "--branch") args.branch = argv[++index];
    else if (arg === "--deploy-path") args.deployPath = argv[++index];
    else if (arg === "--push") args.push = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/cpanel-deploy-artifacts.mjs --mode temp --push",
    "  node scripts/cpanel-deploy-artifacts.mjs --mode prod --branch deploy/cpanel-prod --deploy-path /home/vhplasti/bibistudio.vn/",
    "",
    "Modes:",
    "  temp  Build for http://h217103.tino.org/~vhplasti/",
    "  prod  Build for a root domain such as https://bibistudio.vn/",
    "",
    "The script creates an artifact-only deploy branch commit. It pushes only when --push is passed.",
  ].join("\n");
}

function branchExists(branch) {
  return (
    spawnSync("git", ["show-ref", "--verify", `refs/heads/${branch}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    }).status === 0
  );
}

function ensureDeployBranch(branch, workdir) {
  const parentDir = resolve(workdir, "..");
  mkdirSync(parentDir, { recursive: true });

  if (!existsSync(workdir)) {
    if (branchExists(branch)) {
      run("git", ["worktree", "add", workdir, branch]);
      return;
    }

    run("git", ["worktree", "add", "--detach", workdir, "HEAD"]);
    run("git", ["checkout", "--orphan", branch], { cwd: workdir });
    clearDirectoryExceptGit(workdir);
    return;
  }

  if (!existsSync(join(workdir, ".git"))) {
    rmSync(workdir, { recursive: true, force: true });
    ensureDeployBranch(branch, workdir);
    return;
  }

  if (branchExists(branch)) {
    run("git", ["checkout", branch], { cwd: workdir });
  } else {
    run("git", ["checkout", "--orphan", branch], { cwd: workdir });
    clearDirectoryExceptGit(workdir);
  }
}

function commitArtifacts(workdir, mode) {
  run("git", ["add", "-A"], { cwd: workdir });
  const hasChanges =
    spawnSync("git", ["diff", "--cached", "--quiet"], {
      cwd: workdir,
      stdio: "pipe",
    }).status !== 0;

  if (!hasChanges) {
    console.log("No artifact changes to commit.");
    return false;
  }

  run("git", ["commit", "-m", `Deploy cPanel ${mode} artifact`], { cwd: workdir });
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const config = getModeConfig(args.mode);
  const branch = args.branch ?? config.branch;
  const deployPath = args.deployPath ?? config.deployPath;
  const root = process.cwd();
  const distDir = join(root, "dist-cpanel");
  const deployWorkdir = join(root, ".deploy-artifacts", toSafeWorkdirName(branch));

  run("npm", ["run", config.buildScript], { cwd: root });
  writeFileSync(join(distDir, ".cpanel.yml"), renderCpanelYml(deployPath));

  ensureDeployBranch(branch, deployWorkdir);
  clearDirectoryExceptGit(deployWorkdir);
  copyArtifacts(distDir, deployWorkdir);
  cpSync(join(distDir, ".cpanel.yml"), join(deployWorkdir, ".cpanel.yml"), { force: true });

  const committed = commitArtifacts(deployWorkdir, args.mode);
  if (args.push && committed) {
    run("git", ["push", "-u", "origin", branch], { cwd: deployWorkdir });
  }

  console.log(`Artifact branch ready: ${branch}`);
  console.log(`Local deploy workdir: ${deployWorkdir}`);
  if (!args.push) {
    console.log("Review it, then rerun with --push when you want to publish the deploy branch.");
  }
}

if (process.argv[1] && basename(process.argv[1]) === "cpanel-deploy-artifacts.mjs") {
  main();
}

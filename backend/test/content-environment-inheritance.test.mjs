import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
test(
  "fixed receiver maintenance subprocess preserves the attested kernel lock FD",
  { skip: process.platform !== "linux" ? "Linux receiver subprocess contract" : false },
  async (t) => {
    const { mkdtemp, rm, mkdir, writeFile } = await import("node:fs/promises"),
      { tmpdir } = await import("node:os"),
      { resolve, dirname } = await import("node:path"),
      { spawn } = await import("node:child_process");
    const root = await mkdtemp(join(tmpdir(), "bibi-receiver-content-")),
      app = join(root, "release");
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(app, "backend/dist/content"), { recursive: true });
    await writeFile(
      join(app, "backend/dist/content/cli.js"),
      `const fs=require('node:fs');if(process.argv[2]!=='status')process.exit(3);console.log(JSON.stringify({locked:/FLOCK.*WRITE/.test(fs.readFileSync('/proc/self/fdinfo/3','utf8'))}));`,
    );
    const code = `require(process.argv[1]).runDatabaseTool({root:process.argv[2],runtimeBin:process.argv[4],contentLockFd:3},process.argv[3],'content-status',{}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=2})`;
    const result = await new Promise((done, fail) => {
      const child = spawn(
        "flock",
        [
          "-x",
          "-w",
          "2",
          join(root, "deploy.lock"),
          process.execPath,
          "-e",
          code,
          resolve("ops/database-lifecycle.cjs"),
          root,
          app,
          dirname(process.execPath),
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let out = "",
        err = "";
      child.stdout.on("data", (b) => (out += b));
      child.stderr.on("data", (b) => (err += b));
      child.once("error", fail);
      child.once("close", (status) => done({ status, out, err }));
    });
    assert.equal(result.status, 0, result.err);
    assert.deepEqual(JSON.parse(result.out), { locked: true });
  },
);
test(
  "inherited receiver lease requires a real kernel flock on the exact deployment lock",
  { skip: process.platform !== "linux" ? "Linux receiver FD contract is exercised in CI" : false },
  async (t) => {
    const { mkdtemp, rm, open } = await import("node:fs/promises"),
      { tmpdir } = await import("node:os"),
      { resolve } = await import("node:path"),
      { spawn } = await import("node:child_process");
    const root = await mkdtemp(join(tmpdir(), "bibi-inherited-content-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const file = join(root, "deploy.lock"),
      h = await open(file, "wx", 0o600);
    const code = `const {withContentEnvironmentLock}=require(process.argv[1]);withContentEnvironmentLock({deployLock:process.argv[2]},async l=>{l.assertActive();console.log('verified-kernel-lease')}).catch(()=>{process.exitCode=2})`;
    const invoke = (locked) =>
      new Promise((done, fail) => {
        const args = [
            process.execPath,
            "-e",
            code,
            resolve("backend/dist/content/environment-lock.js"),
            file,
          ],
          child = spawn(
            locked ? "flock" : args.shift(),
            locked ? ["-x", "-w", "2", file, ...args] : args,
            {
              stdio: ["ignore", "pipe", "pipe", locked ? "ignore" : h.fd],
              env: { ...process.env, BIBI_CONTENT_LOCK_FD: "3" },
            },
          );
        let out = "";
        child.stdout.on("data", (b) => (out += b));
        child.stderr.resume();
        child.once("error", fail);
        child.once("close", (status) => done({ status, out }));
      });
    try {
      assert.equal((await invoke(false)).status, 2);
      const locked = await invoke(true);
      assert.equal(locked.status, 0);
      assert.match(locked.out, /verified-kernel-lease/);
    } finally {
      await h.close();
    }
  },
);

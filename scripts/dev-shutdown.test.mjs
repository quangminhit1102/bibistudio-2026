import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import * as development from "./dev.mjs";

test("frontend shutdown closes watches added by a plugin finishing after the first watcher close", async () => {
  const root = await mkdtemp(join(tmpdir(), "bibi-shutdown-"));
  await writeFile(join(root, "fixture.txt"), "owned shutdown fixture");
  let server, closed;
  const watcherClosed = new Promise((resolve) => {
    closed = resolve;
  });
  let injected = false;
  try {
    server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [
        {
          name: "controlled-late-plugin-watch",
          configureServer(vite) {
            const close = vite.watcher.close.bind(vite.watcher);
            vite.watcher.close = async () => {
              await close();
              closed();
            };
          },
          async closeBundle() {
            if (injected) return;
            injected = true;
            await watcherClosed;
            server.watcher.add(root);
          },
        },
      ],
    });
    const close = development.closeFrontend ?? ((vite) => vite.close());
    await close(server);
    assert.equal(injected, true);
    assert.equal(
      server.watcher.closed,
      true,
      "No plugin may leave resurrected filesystem watchers after shutdown",
    );
    assert.deepEqual(server.watcher.getWatched(), {});
  } finally {
    await server?.watcher.close();
    await rm(root, { recursive: true, force: true });
  }
});

import { readFile } from "node:fs/promises";
import { createDbPool } from "../../dist/db/pool.js";
import { createContentMedia } from "../../dist/content/media/service.js";
import { createContentPublication } from "../../dist/content/publication/publisher.js";
import { runNextPublication } from "../../dist/content/publication/worker.js";
const [file, phase] = process.argv.slice(2),
  config = JSON.parse(await readFile(file, "utf8")),
  pool = createDbPool(config.database),
  clock = { now: () => new Date(config.now) };
async function stop() {
  process.send(phase);
  await new Promise(() => {});
}
const publication = createContentPublication({
    ...config,
    pool,
    clock,
    media: createContentMedia({ pool, clock, paths: config.paths }),
    origin: "https://bibistudio.vn",
    canary: async () => {
      if (phase === "finalize") await stop();
    },
  }),
  context = publication.context,
  activate = context.store.activate;
context.store = {
  ...context.store,
  activate: async (...args) => {
    if (phase === "prepared") await stop();
    await activate(...args);
    if (phase === "pointer") await stop();
  },
};
try {
  await runNextPublication(context);
} finally {
  await pool.end();
}

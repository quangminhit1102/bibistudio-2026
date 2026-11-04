import { createServer, type Server } from "node:http";
import { createApp, type AppOptions } from "./app";
import { createRuntime } from "./runtime";
import { readRelease, type ReleaseInfo } from "./release";

export function startServer(options: {
  host: string;
  port: number;
  release: ReleaseInfo;
  appOptions?: AppOptions;
}): Promise<Server> {
  const server = createServer(createApp(options.release, options.appOptions));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve(server));
  });
}

if (require.main === module) {
  if (process.env.BIBI_PRIVATE_ENV_FILE) process.loadEnvFile(process.env.BIBI_PRIVATE_ENV_FILE);
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
  const runtime = createRuntime();
  startServer({
    host: process.env.HOST ?? "127.0.0.1",
    port,
    release: readRelease(),
    appOptions: runtime.appOptions,
  })
    .then((server) => {
      const address = server.address();
      console.log(
        `BIBI_API_READY http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`,
      );
      const close = () => {
        server.closeAllConnections();
        server.close(() => {
          void runtime.close().finally(() => process.exit(0));
        });
      };
      process.once("SIGINT", close);
      process.once("SIGTERM", close);
    })
    .catch(async () => {
      await runtime.close();
      console.error("API startup failed; check private configuration and database readiness");
      process.exitCode = 1;
    });
}

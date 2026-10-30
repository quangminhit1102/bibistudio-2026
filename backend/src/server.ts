import { createServer, type Server } from "node:http";
import { createApp } from "./app";
import { readRelease, type ReleaseInfo } from "./release";

export function startServer(options: {
  host: string;
  port: number;
  release: ReleaseInfo;
}): Promise<Server> {
  const server = createServer(createApp(options.release));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve(server));
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
  startServer({ host: process.env.HOST ?? "127.0.0.1", port, release: readRelease() })
    .then((server) => {
      const address = server.address();
      console.log(
        `BIBI_API_READY http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`,
      );
      const close = () => {
        server.closeAllConnections();
        server.close(() => process.exit(0));
      };
      process.once("SIGINT", close);
      process.once("SIGTERM", close);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

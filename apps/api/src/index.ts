import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./env";
import { setupRealtime } from "./realtime";

const app = createApp();
const server = createServer(app);
setupRealtime(server);

server.listen(env.port, () => {
  console.log(`[api] http://localhost:${env.port}`);
  console.log(`[api] realtime ready, web origin: ${env.clientOrigin}`);
});

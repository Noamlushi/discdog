import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { registerSocketHandlers } from "./sockets";

async function bootstrap(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Socket.io shares the HTTP server (§2.1 — REST + WebSocket on one origin).
  const io = new Server(server, {
    cors: { origin: env.clientOrigin, credentials: true },
  });
  registerSocketHandlers(io);

  // Expose io to routes/controllers for emitting real-time events.
  app.set("io", io);

  server.listen(env.port, () => {
    console.log(`[http] API + WebSocket on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[fatal] startup failed:", err);
  process.exit(1);
});

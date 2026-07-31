import express, { type Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRouter from "./routes";
import { notFound, errorHandler } from "./middleware/errorHandler";

export function createApp(): Application {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // §5.1 REST endpoints, all under /api.
  app.use("/api", apiRouter);

  // Fallthrough + centralised errors (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

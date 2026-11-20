import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { HttpError, errorHandler } from "./errors";
import { env } from "./env";
import { authRouter } from "./routes/auth";
import { boardsRouter } from "./routes/boards";
import { cardsRouter } from "./routes/cards";
import { columnsRouter } from "./routes/columns";
import { invitesRouter } from "./routes/invites";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", boardsRouter);
  app.use("/api", columnsRouter);
  app.use("/api", cardsRouter);
  app.use("/api", invitesRouter);

  app.use((_req, _res, next) => next(new HttpError(404, "Маршрут не найден")));
  app.use(errorHandler);

  return app;
}

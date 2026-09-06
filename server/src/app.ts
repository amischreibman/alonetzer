// Fastify application factory. Kept separate from index.ts so tests can
// build an app around an in-memory database and a dry push sender.
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { DB } from "./db.js";
import type { Sender } from "./push.js";
import type { Mailer } from "./mail.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerContentRoutes } from "./routes/content.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerUploadRoutes } from "./routes/uploads.js";

export interface AppContext {
  db: DB;
  sender: Sender;
  mailer: Mailer;
  uploadsDir: string;
  webDir?: string;
  logger?: boolean;
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({ logger: ctx.logger ?? false, bodyLimit: 2 * 1024 * 1024 });

  await app.register(cors, {
    origin: config.corsOrigins === "*" ? true : config.corsOrigins.split(",").map((s) => s.trim()),
  });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 } });

  fs.mkdirSync(ctx.uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: ctx.uploadsDir,
    prefix: "/uploads/",
    decorateReply: true,
    cacheControl: true,
    maxAge: "7d",
  });

  app.get("/api/health", async () => ({
    ok: true,
    push: ctx.sender.ready ? "firebase" : "dry",
    mail: ctx.mailer.ready ? "smtp" : "dry",
    time: new Date().toISOString(),
  }));

  registerAuthRoutes(app, ctx);
  registerContentRoutes(app, ctx);
  registerDeviceRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerUploadRoutes(app, ctx);

  // Optional: serve the built web app so the newsletter also works in a browser.
  if (ctx.webDir && fs.existsSync(path.join(ctx.webDir, "index.html"))) {
    await app.register(fastifyStatic, { root: ctx.webDir, prefix: "/", decorateReply: false, index: ["index.html"] });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api/")) return reply.code(404).send({ error: "לא נמצא" });
      return reply.sendFile("index.html", ctx.webDir);
    });
  }

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number; validation?: unknown };
    const status = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500;
    if (status >= 500) app.log.error(err);
    reply.code(status).send({ error: status >= 500 ? "שגיאת שרת" : e.message });
  });

  return app;
}

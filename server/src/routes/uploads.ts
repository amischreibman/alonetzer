import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../app.js";
import { requireEditor } from "../auth.js";
import { config } from "../config.js";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

export function registerUploadRoutes(app: FastifyInstance, ctx: AppContext): void {
  /** Upload an image or PDF; returns a public URL served from /uploads. */
  app.post("/api/uploads", async (req, reply) => {
    const user = requireEditor(ctx.db, req, reply);
    if (!user) return;
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "לא נבחר קובץ" });
    const ext = ALLOWED[file.mimetype] ?? (path.extname(file.filename || "").toLowerCase() === ".pdf" ? ".pdf" : null);
    if (!ext) return reply.code(415).send({ error: "אפשר להעלות רק תמונות (JPG/PNG/WebP/GIF) או PDF" });
    const day = new Date().toISOString().slice(0, 7);
    const dir = path.join(ctx.uploadsDir, day);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    await pipeline(file.file, fs.createWriteStream(path.join(dir, name)));
    if (file.file.truncated) {
      fs.rmSync(path.join(dir, name), { force: true });
      return reply.code(413).send({ error: `הקובץ גדול מדי (מקסימום ${config.maxUploadMb}MB)` });
    }
    const relative = `/uploads/${day}/${name}`;
    return { url: `${config.publicUrl}${relative}`, path: relative, name: file.filename, size: file.file.bytesRead };
  });
}

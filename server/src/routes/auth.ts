import type { FastifyInstance } from "fastify";
import type { AppContext } from "../app.js";
import { config } from "../config.js";
import {
  bearerToken,
  currentUser,
  hashPassword,
  requireUser,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "../auth.js";
import {
  consumePasswordReset,
  createPasswordReset,
  createSession,
  createUser,
  deleteSession,
  deleteUserSessions,
  getUserRowByEmail,
  updateUser,
} from "../db.js";

interface Credentials {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  device?: string;
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  app.post<{ Body: Credentials }>("/api/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const { email, password, full_name, phone } = req.body ?? {};
    const err = validateEmail(email) ?? validatePassword(password);
    if (err) return reply.code(400).send({ error: err });
    if (!full_name || !full_name.trim()) return reply.code(400).send({ error: "יש להזין שם מלא" });
    if (getUserRowByEmail(db, email!)) return reply.code(409).send({ error: "כתובת האימייל כבר רשומה. אפשר להתחבר או לאפס סיסמה" });
    const user = createUser(db, {
      email: email!,
      password_hash: await hashPassword(password!),
      full_name: full_name!,
      phone: phone?.trim() || null,
      status: config.newUserStatus,
    });
    const token = createSession(db, user.id, config.sessionDays, req.body?.device);
    return { token, user };
  });

  app.post<{ Body: Credentials }>("/api/auth/login", { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return reply.code(400).send({ error: "יש להזין אימייל וסיסמה" });
    const row = getUserRowByEmail(db, email);
    if (!row || !(await verifyPassword(password, row.password_hash))) return reply.code(401).send({ error: "אימייל או סיסמה שגויים" });
    if (row.status === "blocked") return reply.code(403).send({ error: "החשבון חסום. פנה לעורך העלון" });
    const token = createSession(db, row.id, config.sessionDays, req.body?.device);
    const { password_hash: _h, ...user } = row;
    void _h;
    return { token, user };
  });

  app.post("/api/auth/logout", async (req) => {
    const token = bearerToken(req);
    if (token) deleteSession(db, token);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = currentUser(db, req);
    if (!user) return reply.code(401).send({ error: "נדרשת התחברות" });
    return { user };
  });

  app.put<{ Body: { full_name?: string; phone?: string; password?: string; current_password?: string } }>("/api/auth/me", async (req, reply) => {
    const user = requireUser(db, req, reply);
    if (!user) return;
    const patch: { full_name?: string; phone?: string | null; password_hash?: string } = {};
    if (typeof req.body?.full_name === "string" && req.body.full_name.trim()) patch.full_name = req.body.full_name.trim();
    if (typeof req.body?.phone === "string") patch.phone = req.body.phone.trim() || null;
    if (req.body?.password) {
      const err = validatePassword(req.body.password);
      if (err) return reply.code(400).send({ error: err });
      const row = getUserRowByEmail(db, user.email)!;
      if (!req.body.current_password || !(await verifyPassword(req.body.current_password, row.password_hash))) {
        return reply.code(400).send({ error: "הסיסמה הנוכחית שגויה" });
      }
      patch.password_hash = await hashPassword(req.body.password);
    }
    return { user: updateUser(db, user.id, patch) };
  });

  app.post<{ Body: { email?: string } }>("/api/auth/forgot", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req) => {
    const row = req.body?.email ? getUserRowByEmail(db, req.body.email) : null;
    // Always answer the same way so email addresses cannot be probed.
    if (row) {
      const token = createPasswordReset(db, row.id);
      const link = `${config.publicUrl}/reset?token=${token}`;
      await ctx.mailer.send(
        row.email,
        "איפוס סיסמה – עלון נצר-סרני",
        `שלום ${row.full_name},\n\nלאיפוס הסיסמה באפליקציית העלון פתח את הקישור הבא (תקף לשעתיים):\n${link}\n\nאם לא ביקשת איפוס, אפשר להתעלם מהודעה זו.`,
      );
    }
    return { ok: true, mail: ctx.mailer.ready };
  });

  app.post<{ Body: { token?: string; password?: string } }>("/api/auth/reset", async (req, reply) => {
    const err = validatePassword(req.body?.password);
    if (err) return reply.code(400).send({ error: err });
    const userId = req.body?.token ? consumePasswordReset(db, req.body.token) : null;
    if (!userId) return reply.code(400).send({ error: "הקישור אינו תקף או שפג תוקפו" });
    updateUser(db, userId, { password_hash: await hashPassword(req.body!.password!) });
    deleteUserSessions(db, userId);
    return { ok: true };
  });
}

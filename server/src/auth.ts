// Password hashing and request authentication helpers.
import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "../../shared/src/index.js";
import { isAdmin, isEditor } from "../../shared/src/index.js";
import { getUserBySession, type DB } from "./db.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 6) return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (password.length > 200) return "הסיסמה ארוכה מדי";
  return null;
}

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "כתובת אימייל לא תקינה";
  return null;
}

export function bearerToken(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

export function currentUser(db: DB, req: FastifyRequest): User | null {
  const token = bearerToken(req);
  if (!token) return null;
  const user = getUserBySession(db, token);
  if (!user || user.status === "blocked") return null;
  return user;
}

export function requireUser(db: DB, req: FastifyRequest, reply: FastifyReply): User | null {
  const user = currentUser(db, req);
  if (!user) {
    reply.code(401).send({ error: "נדרשת התחברות" });
    return null;
  }
  return user;
}

export function requireEditor(db: DB, req: FastifyRequest, reply: FastifyReply): User | null {
  const user = requireUser(db, req, reply);
  if (!user) return null;
  if (!isEditor(user) || user.status !== "active") {
    reply.code(403).send({ error: "אין הרשאה" });
    return null;
  }
  return user;
}

export function requireAdmin(db: DB, req: FastifyRequest, reply: FastifyReply): User | null {
  const user = requireUser(db, req, reply);
  if (!user) return null;
  if (!isAdmin(user) || user.status !== "active") {
    reply.code(403).send({ error: "אין הרשאה" });
    return null;
  }
  return user;
}

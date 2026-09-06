import { buildApp } from "../src/app.js";
import { createUser, openDb, type DB } from "../src/db.js";
import { hashPassword } from "../src/auth.js";
import { createDrySender } from "../src/push.js";
import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TestEnv {
  app: FastifyInstance;
  db: DB;
  pushLog: string[];
  adminToken: string;
  login(email: string, password: string): Promise<string>;
}

export async function createTestEnv(): Promise<TestEnv> {
  const db = openDb(":memory:");
  const pushLog: string[] = [];
  const sender = createDrySender((line) => pushLog.push(line));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "alon-uploads-"));
  const app = await buildApp({
    db,
    sender,
    mailer: { ready: false, send: async () => undefined },
    uploadsDir,
  });
  createUser(db, {
    email: "admin@test.local",
    password_hash: await hashPassword("secret123"),
    full_name: "Admin",
    role: "admin",
    membership: "member",
    status: "active",
  });
  const login = async (email: string, password: string): Promise<string> => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
    if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
    return (res.json() as { token: string }).token;
  };
  const adminToken = await login("admin@test.local", "secret123");
  return { app, db, pushLog, adminToken, login };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

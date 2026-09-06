import type { FastifyInstance } from "fastify";
import type { AppContext } from "../app.js";
import { hashPassword, requireAdmin, requireEditor, validateEmail, validatePassword } from "../auth.js";
import { contentStats, countDevices, createUser, deleteUser, deleteUserSessions, getUserById, getUserRowByEmail, listNotifications, listUsers, updateUser } from "../db.js";
import { sendBroadcast } from "../push.js";
import { PUSH_CATEGORIES, type PushCategory, type Visibility } from "../../../shared/src/index.js";

const ROLES = new Set(["admin", "editor", "user"]);
const MEMBERSHIPS = new Set(["member", "resident", "guest"]);
const STATUSES = new Set(["pending", "active", "blocked"]);

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  app.get("/api/admin/stats", async (req, reply) => {
    if (!requireEditor(db, req, reply)) return;
    const users = listUsers(db);
    return {
      content: contentStats(db),
      users: {
        total: users.length,
        pending: users.filter((u) => u.status === "pending").length,
        active: users.filter((u) => u.status === "active").length,
      },
      devices: countDevices(db),
      push: ctx.sender.ready ? "firebase" : "dry",
      notifications: listNotifications(db, 10),
    };
  });

  // ---- Users (admins only) -------------------------------------------------

  app.get("/api/admin/users", async (req, reply) => {
    if (!requireAdmin(db, req, reply)) return;
    return { users: listUsers(db) };
  });

  app.post<{ Body: { email?: string; password?: string; full_name?: string; role?: string; membership?: string; status?: string; phone?: string } }>(
    "/api/admin/users",
    async (req, reply) => {
      if (!requireAdmin(db, req, reply)) return;
      const b = req.body ?? {};
      const err = validateEmail(b.email) ?? validatePassword(b.password);
      if (err) return reply.code(400).send({ error: err });
      if (getUserRowByEmail(db, b.email!)) return reply.code(409).send({ error: "כתובת האימייל כבר רשומה" });
      const user = createUser(db, {
        email: b.email!,
        password_hash: await hashPassword(b.password!),
        full_name: b.full_name ?? "",
        role: ROLES.has(b.role ?? "") ? b.role : "user",
        membership: MEMBERSHIPS.has(b.membership ?? "") ? b.membership : "guest",
        status: STATUSES.has(b.status ?? "") ? b.status : "active",
        phone: b.phone ?? null,
      });
      return reply.code(201).send({ user });
    },
  );

  app.put<{ Params: { id: string }; Body: { full_name?: string; role?: string; membership?: string; status?: string; phone?: string; password?: string; email?: string } }>(
    "/api/admin/users/:id",
    async (req, reply) => {
      const admin = requireAdmin(db, req, reply);
      if (!admin) return;
      const target = getUserById(db, req.params.id);
      if (!target) return reply.code(404).send({ error: "המשתמש לא נמצא" });
      const b = req.body ?? {};
      const patch: Record<string, unknown> = {};
      if (typeof b.full_name === "string") patch.full_name = b.full_name.trim();
      if (typeof b.phone === "string") patch.phone = b.phone.trim() || null;
      if (b.email !== undefined) {
        const err = validateEmail(b.email);
        if (err) return reply.code(400).send({ error: err });
        const other = getUserRowByEmail(db, b.email);
        if (other && other.id !== target.id) return reply.code(409).send({ error: "כתובת האימייל כבר רשומה" });
        patch.email = b.email;
      }
      if (b.role !== undefined) {
        if (!ROLES.has(b.role)) return reply.code(400).send({ error: "תפקיד לא חוקי" });
        if (target.id === admin.id && b.role !== "admin") return reply.code(400).send({ error: "אי אפשר להסיר הרשאת מנהל מעצמך" });
        patch.role = b.role;
      }
      if (b.membership !== undefined) {
        if (!MEMBERSHIPS.has(b.membership)) return reply.code(400).send({ error: "סיווג לא חוקי" });
        patch.membership = b.membership;
      }
      if (b.status !== undefined) {
        if (!STATUSES.has(b.status)) return reply.code(400).send({ error: "סטטוס לא חוקי" });
        if (target.id === admin.id && b.status !== "active") return reply.code(400).send({ error: "אי אפשר לחסום את עצמך" });
        patch.status = b.status;
      }
      if (b.password) {
        const err = validatePassword(b.password);
        if (err) return reply.code(400).send({ error: err });
        patch.password_hash = await hashPassword(b.password);
      }
      const user = updateUser(db, target.id, patch);
      if (patch.status === "blocked" || patch.password_hash) deleteUserSessions(db, target.id);
      return { user };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const admin = requireAdmin(db, req, reply);
    if (!admin) return;
    if (req.params.id === admin.id) return reply.code(400).send({ error: "אי אפשר למחוק את עצמך" });
    if (!getUserById(db, req.params.id)) return reply.code(404).send({ error: "המשתמש לא נמצא" });
    deleteUser(db, req.params.id);
    return { ok: true };
  });

  // ---- Manual push (editors) ----------------------------------------------

  app.post<{ Body: { title?: string; body?: string; category?: string | null; url?: string | null; visibility?: Visibility } }>(
    "/api/admin/notify",
    async (req, reply) => {
      const user = requireEditor(db, req, reply);
      if (!user) return;
      const b = req.body ?? {};
      if (!b.title?.trim()) return reply.code(400).send({ error: "יש להזין כותרת" });
      const category = b.category && PUSH_CATEGORIES.some((c) => c.key === b.category) ? (b.category as PushCategory) : null;
      const result = await sendBroadcast(
        db,
        ctx.sender,
        { title: b.title.trim(), body: (b.body ?? "").trim(), category, url: b.url?.trim() || null, visibility: b.visibility ?? "public" },
        user.id,
      );
      return { result, dry: !ctx.sender.ready };
    },
  );

  app.get("/api/admin/notifications", async (req, reply) => {
    if (!requireEditor(db, req, reply)) return;
    return { notifications: listNotifications(db, 100) };
  });
}

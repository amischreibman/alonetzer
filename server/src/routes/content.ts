import type { FastifyInstance } from "fastify";
import type { AppContext } from "../app.js";
import { currentUser, requireEditor } from "../auth.js";
import { buildContentInput, ValidationError } from "../content.js";
import { deleteContent, getContent, incrementViews, insertContent, queryContent, updateContent, wasNotified } from "../db.js";
import { notifyNewContent } from "../push.js";
import { canRead, entityByType, readableVisibilities, type ContentData, type ContentType } from "../../../shared/src/index.js";

interface ListQuery {
  section?: string;
  q?: string;
  limit?: string;
  skip?: string;
  all?: string;
  upcoming?: string;
  past?: string;
}

export function registerContentRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  function typeOf(param: string, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): ContentType | null {
    if (!entityByType(param)) {
      reply.code(404).send({ error: "סוג תוכן לא מוכר" });
      return null;
    }
    return param as ContentType;
  }

  /** Home screen bundle: one round trip for everything above the fold. */
  app.get("/api/home", async (req) => {
    const user = currentUser(db, req);
    const vis = readableVisibilities(user);
    const nowIso = new Date().toISOString();
    return {
      user,
      articles: queryContent(db, { type: "article", visibilities: vis, limit: 20, pinnedFirst: true }),
      flashes: queryContent(db, { type: "flash", visibilities: vis, limit: 5 }),
      events: queryContent(db, { type: "event", visibilities: vis, limit: 5, ascending: true, since: new Date(Date.now() - 3 * 3600_000).toISOString() }),
      greetings: queryContent(db, { type: "greeting", visibilities: vis, limit: 4 }),
      issues: queryContent(db, { type: "issue", visibilities: vis, limit: 1 }),
      generated_at: nowIso,
    };
  });

  app.get<{ Params: { type: string }; Querystring: ListQuery }>("/api/content/:type", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const user = currentUser(db, req);
    const q = req.query;
    const editor = user && (user.role === "admin" || user.role === "editor") && user.status === "active";
    const includeUnpublished = Boolean(editor && q.all === "1");
    const upcoming = q.upcoming === "1";
    const past = q.past === "1";
    const edge = new Date(Date.now() - 3 * 3600_000).toISOString();
    const items = queryContent(db, {
      type,
      visibilities: readableVisibilities(user),
      includeUnpublished,
      section: q.section || undefined,
      search: q.q?.trim() || undefined,
      limit: q.limit ? Number(q.limit) : 50,
      skip: q.skip ? Number(q.skip) : 0,
      ascending: upcoming,
      since: upcoming ? edge : undefined,
      before: past ? edge : undefined,
      pinnedFirst: type === "article" && !q.q,
    });
    return { items };
  });

  app.get<{ Querystring: { q?: string; limit?: string } }>("/api/search", async (req) => {
    const user = currentUser(db, req);
    const term = req.query.q?.trim() ?? "";
    if (term.length < 2) return { items: [] };
    const vis = readableVisibilities(user);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const types: ContentType[] = ["article", "flash", "event", "greeting", "issue"];
    const items = types.flatMap((type) => queryContent(db, { type, visibilities: vis, search: term, limit }));
    items.sort((a, b) => (a.sort_date < b.sort_date ? 1 : -1));
    return { items: items.slice(0, limit * 2) };
  });

  app.get<{ Params: { type: string; id: string } }>("/api/content/:type/:id", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const user = currentUser(db, req);
    const item = getContent(db, type, req.params.id);
    const editor = user && (user.role === "admin" || user.role === "editor");
    if (!item || (!item.published && !editor)) return reply.code(404).send({ error: "התוכן לא נמצא" });
    if (!canRead(user, item.visibility)) return reply.code(user ? 403 : 401).send({ error: user ? "התוכן מיועד לחברי הקיבוץ" : "נדרשת התחברות" });
    return { item };
  });

  app.post<{ Params: { type: string; id: string } }>("/api/content/:type/:id/view", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const item = getContent(db, type, req.params.id);
    if (!item) return reply.code(404).send({ error: "התוכן לא נמצא" });
    incrementViews(db, type, req.params.id);
    return { ok: true };
  });

  // ---- Editing (editors and admins) ---------------------------------------

  app.post<{ Params: { type: string }; Body: ContentData & { notify?: boolean } }>("/api/content/:type", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const user = requireEditor(db, req, reply);
    if (!user) return;
    try {
      const { notify = true, ...body } = req.body ?? {};
      const input = buildContentInput(type, body);
      const item = insertContent(db, { ...input, created_by: user.id });
      let push = null;
      if (notify && item.published) push = await notifyNewContent(db, ctx.sender, item, user.id);
      return reply.code(201).send({ item, push });
    } catch (err) {
      if (err instanceof ValidationError) return reply.code(400).send({ error: err.message, errors: err.errors });
      throw err;
    }
  });

  app.put<{ Params: { type: string; id: string }; Body: ContentData & { notify?: boolean } }>("/api/content/:type/:id", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const user = requireEditor(db, req, reply);
    if (!user) return;
    const existing = getContent(db, type, req.params.id);
    if (!existing) return reply.code(404).send({ error: "התוכן לא נמצא" });
    try {
      const { notify = true, ...body } = req.body ?? {};
      const input = buildContentInput(type, { ...existing.data, ...body });
      const item = updateContent(db, type, req.params.id, input)!;
      let push = null;
      // Notify once, the first time an item becomes visible to readers.
      if (notify && item.published && !wasNotified(db, item.id)) push = await notifyNewContent(db, ctx.sender, item, user.id);
      return { item, push };
    } catch (err) {
      if (err instanceof ValidationError) return reply.code(400).send({ error: err.message, errors: err.errors });
      throw err;
    }
  });

  app.delete<{ Params: { type: string; id: string } }>("/api/content/:type/:id", async (req, reply) => {
    const type = typeOf(req.params.type, reply);
    if (!type) return;
    const user = requireEditor(db, req, reply);
    if (!user) return;
    if (!deleteContent(db, type, req.params.id)) return reply.code(404).send({ error: "התוכן לא נמצא" });
    return { ok: true };
  });
}

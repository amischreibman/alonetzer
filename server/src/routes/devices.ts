import type { FastifyInstance } from "fastify";
import type { AppContext } from "../app.js";
import { currentUser } from "../auth.js";
import { deleteDevice, getDevice, upsertDevice } from "../db.js";
import { normalizePushPrefs, type PushPrefs } from "../../../shared/src/index.js";

interface RegisterBody {
  token?: string;
  platform?: string;
  prefs?: PushPrefs;
  app_version?: string;
}

export function registerDeviceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  /** Register (or refresh) a device push token, linking it to the signed-in user if any. */
  app.post<{ Body: RegisterBody }>("/api/devices", async (req, reply) => {
    const { token, platform, prefs, app_version } = req.body ?? {};
    if (!token || typeof token !== "string" || token.length < 10) return reply.code(400).send({ error: "token חסר" });
    const user = currentUser(db, req);
    const device = upsertDevice(db, {
      token,
      user_id: user?.id ?? null,
      platform: platform === "ios" ? "ios" : platform === "web" ? "web" : "android",
      prefs: prefs ? normalizePushPrefs(prefs) : undefined,
      app_version: app_version ?? null,
    });
    return { device };
  });

  app.get<{ Params: { token: string } }>("/api/devices/:token", async (req, reply) => {
    const device = getDevice(db, req.params.token);
    if (!device) return reply.code(404).send({ error: "המכשיר לא רשום" });
    return { device };
  });

  app.put<{ Params: { token: string }; Body: { prefs?: PushPrefs } }>("/api/devices/:token/prefs", async (req, reply) => {
    const existing = getDevice(db, req.params.token);
    if (!existing) return reply.code(404).send({ error: "המכשיר לא רשום" });
    const user = currentUser(db, req);
    const device = upsertDevice(db, {
      token: req.params.token,
      user_id: user?.id ?? existing.user_id,
      prefs: normalizePushPrefs(req.body?.prefs),
    });
    return { device };
  });

  app.delete<{ Params: { token: string } }>("/api/devices/:token", async (req) => {
    deleteDevice(db, req.params.token);
    return { ok: true };
  });
}

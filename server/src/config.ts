// Server configuration read from environment variables (see .env.example).
import "dotenv/config";
import path from "node:path";

function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const config = {
  port: Number(env("PORT", "8080")),
  host: env("HOST", "0.0.0.0"),
  publicUrl: env("PUBLIC_URL", `http://localhost:${env("PORT", "8080")}`).replace(/\/$/, ""),
  dataDir: path.resolve(env("DATA_DIR", "./data")),
  corsOrigins: env("CORS_ORIGINS", "*"),
  admin: {
    email: env("ADMIN_EMAIL"),
    password: env("ADMIN_PASSWORD"),
    name: env("ADMIN_NAME", "עורך העלון"),
  },
  newUserStatus: env("NEW_USER_STATUS", "pending") === "active" ? "active" : "pending",
  firebaseServiceAccount: env("FIREBASE_SERVICE_ACCOUNT"),
  smtp: {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", "587")),
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM", "עלון נצר-סרני <no-reply@localhost>"),
  },
  /** Session lifetime in days. */
  sessionDays: Number(env("SESSION_DAYS", "180")),
  /** Max upload size in MB (PDF issues can be large). */
  maxUploadMb: Number(env("MAX_UPLOAD_MB", "40")),
  /** Directory of the built web app to serve at "/" (optional). */
  webDir: env("WEB_DIR", path.resolve(process.cwd(), "../app/dist")),
} as const;

export const uploadsDir = path.join(config.dataDir, "uploads");
export const dbPath = path.join(config.dataDir, "alon.sqlite");

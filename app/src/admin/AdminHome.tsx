import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CONTENT_ENTITIES, isAdmin } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { loadStats, type AdminStats } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { Alert, Spinner } from "@/components/ui";
import { relativeTime } from "@/lib/format";

const ICONS: Record<string, string> = { article: "📝", flash: "⚡", event: "📅", greeting: "🌸", issue: "📰" };

export function AdminHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadStats().then(setStats).catch((e) => setError(errorMessage(e)));
  }, []);
  return (
    <>
      <h1 className="page-title">🛠️ ניהול העלון</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {stats && (
        <>
          {stats.push === "dry" && <Alert kind="info">שליחת פושים אינה מוגדרת בשרת (חסר קובץ Firebase). ההתראות נרשמות ביומן בלבד.</Alert>}
          <div className="stats">
            <div className="stat">
              <div className="n">{stats.users.total}</div>
              <div className="l">משתמשים רשומים</div>
            </div>
            <div className="stat">
              <div className="n" style={{ color: stats.users.pending ? "var(--amber)" : undefined }}>
                {stats.users.pending}
              </div>
              <div className="l">ממתינים לאישור</div>
            </div>
            <div className="stat">
              <div className="n">{stats.devices}</div>
              <div className="l">מכשירים עם התראות</div>
            </div>
            <div className="stat">
              <div className="n">{Object.values(stats.content).reduce((s, c) => s + c.views, 0)}</div>
              <div className="l">צפיות בתכנים</div>
            </div>
          </div>
        </>
      )}
      <div className="admin-grid">
        {CONTENT_ENTITIES.map((e) => (
          <Link key={e.type} to={`/admin/content/${e.type}`}>
            <span className="ico">{ICONS[e.type]}</span>
            {e.labelPlural}
            {stats && (
              <div className="hint" style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-3)" }}>
                {stats.content[e.type]?.published ?? 0} מפורסמים · {stats.content[e.type]?.total ?? 0} סה"כ
              </div>
            )}
          </Link>
        ))}
        <Link to="/admin/notify">
          <span className="ico">🔔</span>שליחת הודעה
        </Link>
        {isAdmin(user) && (
          <Link to="/admin/users">
            <span className="ico">👥</span>משתמשים
            {stats && stats.users.pending > 0 && <div style={{ color: "var(--amber)", fontSize: 12 }}>{stats.users.pending} ממתינים</div>}
          </Link>
        )}
      </div>
      {stats ? (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>
            התראות אחרונות
          </h2>
          {stats.notifications.length === 0 && <p style={{ color: "var(--ink-3)" }}>עדיין לא נשלחו התראות.</p>}
          <ul className="list">
            {stats.notifications.map((n) => (
              <li key={n.id} className="list-item">
                <div className="body">
                  <div className="t">{n.title}</div>
                  <div className="s">
                    {relativeTime(n.created_at)} · {n.target_count} נמענים{n.success_count ? ` · ${n.success_count} נמסרו` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        !error && <Spinner />
      )}
    </>
  );
}

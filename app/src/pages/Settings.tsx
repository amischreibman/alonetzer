import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MEMBERSHIP_OPTIONS, PUSH_CATEGORIES, STATUS_OPTIONS, type PushPrefs } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/http";
import { getStoredPrefs, initPush, isPushSupported, savePrefs, getPushToken } from "@/lib/push";
import { DEFAULT_SERVER_URL, getServerUrl, saveServerUrl } from "@/config";
import { clearCache } from "@/lib/api";
import { Alert } from "@/components/ui";

export function Settings() {
  const { user, logout, updateProfile, refresh } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [pushState, setPushState] = useState<"granted" | "denied" | "unsupported" | "unknown">("unknown");
  const [hasToken, setHasToken] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [profile, setProfile] = useState({ full_name: user?.full_name ?? "", phone: user?.phone ?? "", current_password: "", password: "" });
  const [serverUrl, setServerUrl] = useState(getServerUrl());

  useEffect(() => {
    getStoredPrefs().then(setPrefs);
    getPushToken().then((t) => setHasToken(Boolean(t)));
    setPushState(isPushSupported() ? "unknown" : "unsupported");
  }, []);

  const togglePref = async (patch: Partial<PushPrefs> | { category: string; value: boolean }) => {
    if (!prefs) return;
    const next: PushPrefs = "category" in patch ? { ...prefs, categories: { ...prefs.categories, [patch.category]: patch.value } } : { ...prefs, ...patch };
    setPrefs(next);
    await savePrefs(next);
  };

  const enablePush = async () => {
    const res = await initPush();
    setPushState(res);
    setHasToken(Boolean(await getPushToken()));
    if (res === "denied") setMsg({ kind: "error", text: "ההרשאה להתראות נדחתה. אפשר לאפשר אותה בהגדרות המכשיר." });
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        full_name: profile.full_name,
        phone: profile.phone,
        ...(profile.password ? { password: profile.password, current_password: profile.current_password } : {}),
      });
      setProfile((p) => ({ ...p, password: "", current_password: "" }));
      setMsg({ kind: "success", text: "הפרטים נשמרו" });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  const saveServer = async () => {
    await saveServerUrl(serverUrl);
    await clearCache();
    await refresh();
    setMsg({ kind: "success", text: "כתובת השרת עודכנה" });
  };

  return (
    <>
      <h1 className="page-title">הגדרות</h1>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {user ? (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ margin: "0 0 6px" }}>{user.full_name || user.email}</h3>
          <div className="meta">
            <span dir="ltr">{user.email}</span>
            <span className="tag outline">{MEMBERSHIP_OPTIONS.find((m) => m.value === user.membership)?.label}</span>
            <span className="tag outline">{STATUS_OPTIONS.find((s) => s.value === user.status)?.label}</span>
            {user.role !== "user" && <span className="tag">{user.role === "admin" ? "מנהל/ת" : "עורך/ת"}</span>}
          </div>
          {user.status === "pending" && <Alert kind="info">החשבון ממתין לאישור עורך העלון.</Alert>}
          <form className="form" onSubmit={saveProfile}>
            <div className="field">
              <label>שם מלא</label>
              <input type="text" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="field">
              <label>טלפון</label>
              <input type="text" inputMode="tel" value={profile.phone ?? ""} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} dir="ltr" />
            </div>
            <div className="field">
              <label>סיסמה חדשה (השאר ריק אם אין שינוי)</label>
              <input type="password" value={profile.password} onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} dir="ltr" autoComplete="new-password" />
            </div>
            {profile.password && (
              <div className="field">
                <label>סיסמה נוכחית</label>
                <input type="password" value={profile.current_password} onChange={(e) => setProfile((p) => ({ ...p, current_password: e.target.value }))} dir="ltr" autoComplete="current-password" />
              </div>
            )}
            <button className="btn secondary">שמירת פרטים</button>
          </form>
          <button
            className="btn ghost"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            התנתקות
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 14 }}>
          <p>לא מחובר. התחבר כדי לקרוא תוכן השמור לחברים ולתושבים ולקבל התראות מותאמות.</p>
          <Link className="btn" to="/login">
            כניסה / הרשמה
          </Link>
        </div>
      )}

      <h2 className="page-title" style={{ fontSize: 18 }}>
        🔔 התראות
      </h2>
      <div className="card" style={{ padding: 14 }}>
        {pushState === "unsupported" && <Alert kind="info">התראות זמינות רק באפליקציה המותקנת בטלפון.</Alert>}
        {pushState !== "unsupported" && !hasToken && (
          <button className="btn" onClick={enablePush}>
            הפעלת התראות במכשיר זה
          </button>
        )}
        {prefs && (
          <>
            <label className="check">
              <input type="checkbox" checked={prefs.enabled} onChange={(e) => togglePref({ enabled: e.target.checked })} />
              לקבל התראות על תוכן חדש
            </label>
            {PUSH_CATEGORIES.map((c) => (
              <label key={c.key} className="check" style={{ opacity: prefs.enabled ? 1 : 0.5 }}>
                <input type="checkbox" disabled={!prefs.enabled} checked={prefs.categories[c.key]} onChange={(e) => togglePref({ category: c.key, value: e.target.checked })} />
                <span>
                  {c.label}
                  <div className="hint" style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-3)" }}>
                    {c.description}
                  </div>
                </span>
              </label>
            ))}
            <label className="check" style={{ opacity: prefs.enabled ? 1 : 0.5 }}>
              <input type="checkbox" disabled={!prefs.enabled} checked={prefs.broadcasts} onChange={(e) => togglePref({ broadcasts: e.target.checked })} />
              הודעות מיוחדות מעורכי העלון
            </label>
          </>
        )}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>
        🌐 שרת
      </h2>
      <div className="card" style={{ padding: 14 }}>
        <div className="field">
          <label>כתובת השרת</label>
          <input type="url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} dir="ltr" placeholder={DEFAULT_SERVER_URL || "https://..."} />
          <div className="hint">ברירת מחדל: {DEFAULT_SERVER_URL || "לא הוגדרה בבנייה"}</div>
        </div>
        <button className="btn secondary" onClick={saveServer}>
          שמירה
        </button>
      </div>
      <p style={{ color: "var(--ink-3)", fontSize: 12, textAlign: "center" }}>עלון נצר-סרני · גרסה 1.0.0</p>
    </>
  );
}

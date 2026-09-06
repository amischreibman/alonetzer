import { useEffect, useState, type FormEvent } from "react";
import { PUSH_CATEGORIES, VISIBILITY_OPTIONS } from "@alon/shared";
import { loadNotifications, sendBroadcast, type NotificationLog } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { Alert } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export function Notify() {
  const [form, setForm] = useState({ title: "", body: "", category: "", url: "", visibility: "public" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [log, setLog] = useState<NotificationLog[]>([]);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = () => loadNotifications().then(setLog).catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm("לשלוח את ההודעה לכל המכשירים המתאימים?")) return;
    setBusy(true);
    try {
      const res = await sendBroadcast({ title: form.title, body: form.body, category: form.category || null, url: form.url || null, visibility: form.visibility });
      setMsg({
        kind: res.dry ? "info" : "success",
        text: res.dry ? `השרת במצב ניסיון (Firebase לא מוגדר): ההודעה נרשמה ל-${res.result.targets} מכשירים אך לא נשלחה.` : `נשלח ל-${res.result.targets} מכשירים (${res.result.success} נמסרו).`,
      });
      setForm({ title: "", body: "", category: "", url: "", visibility: "public" });
      await refresh();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">🔔 שליחת הודעה</h1>
      <p className="page-desc">התראה ידנית לכל מי שהתקין את האפליקציה ואישר קבלת הודעות מהעורכים.</p>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>כותרת</label>
          <input type="text" value={form.title} onChange={set("title")} required maxLength={80} />
        </div>
        <div className="field">
          <label>תוכן ההודעה</label>
          <textarea value={form.body} onChange={set("body")} maxLength={300} />
        </div>
        <div className="field">
          <label>נושא (לפי העדפות המנויים)</label>
          <select value={form.category} onChange={set("category")}>
            <option value="">הודעה כללית מהעורכים</option>
            {PUSH_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>קהל</label>
          <select value={form.visibility} onChange={set("visibility")}>
            {VISIBILITY_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>קישור לפתיחה (לא חובה)</label>
          <input type="url" value={form.url} onChange={set("url")} dir="ltr" placeholder="https://..." />
        </div>
        <button className="btn" disabled={busy || !form.title}>
          {busy ? "שולח…" : "שליחה"}
        </button>
      </form>
      <h2 className="page-title" style={{ fontSize: 18 }}>
        היסטוריה
      </h2>
      <ul className="list">
        {log.map((n) => (
          <li key={n.id} className="list-item">
            <div className="body">
              <div className="t">
                {n.kind === "broadcast" ? "📣" : "🆕"} {n.title}
              </div>
              <div className="s">
                {relativeTime(n.created_at)} · {n.target_count} נמענים{n.success_count ? ` · ${n.success_count} נמסרו` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

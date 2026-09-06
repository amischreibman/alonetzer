import { useEffect, useState, type FormEvent } from "react";
import { MEMBERSHIP_OPTIONS, ROLE_OPTIONS, STATUS_OPTIONS, type User } from "@alon/shared";
import { createUserAdmin, deleteUserAdmin, loadUsers, updateUserAdmin } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { Alert, Empty, Spinner } from "@/components/ui";
import { formatShortDate } from "@/lib/format";

export function Users() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () =>
    loadUsers()
      .then((u) => {
        setUsers(u);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    void load();
  }, []);

  const shown = users?.filter((u) => (filter === "all" || u.status === "pending") && (!term || `${u.full_name} ${u.email} ${u.phone ?? ""}`.includes(term)));

  const quickApprove = async (u: User, membership: string) => {
    try {
      await updateUserAdmin(u.id, { status: "active", membership });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <div className="row between">
        <h1 className="page-title">👥 משתמשים</h1>
        <button className="btn small" onClick={() => setAdding(true)}>
          ＋ הוספה
        </button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="chips">
        <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          הכל ({users?.length ?? 0})
        </button>
        <button className={`chip ${filter === "pending" ? "active" : ""}`} onClick={() => setFilter("pending")}>
          ממתינים לאישור ({users?.filter((u) => u.status === "pending").length ?? 0})
        </button>
      </div>
      <div className="field">
        <input type="search" placeholder="חיפוש לפי שם, אימייל או טלפון" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {!shown ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty icon="👥" text="אין משתמשים להצגה" />
      ) : (
        <ul className="list">
          {shown.map((u) => (
            <li key={u.id} className="list-item" style={{ flexWrap: "wrap" }}>
              <span className={`status-dot ${u.status === "active" ? "on" : u.status === "pending" ? "pending" : ""}`} />
              <button className="body" style={{ textAlign: "start" }} onClick={() => setEditing(u)}>
                <div className="t">
                  {u.full_name || "(ללא שם)"} {u.role !== "user" && <span className="tag">{ROLE_OPTIONS.find((r) => r.value === u.role)?.label}</span>}
                </div>
                <div className="s" dir="ltr" style={{ textAlign: "end" }}>
                  {u.email}
                  {u.phone ? ` · ${u.phone}` : ""}
                </div>
                <div className="s">
                  {MEMBERSHIP_OPTIONS.find((m) => m.value === u.membership)?.label} · {STATUS_OPTIONS.find((s) => s.value === u.status)?.label} · נרשם/ה {formatShortDate(u.created_at)}
                </div>
              </button>
              {u.status === "pending" && (
                <div className="row wrap" style={{ width: "100%" }}>
                  <button className="btn small" onClick={() => quickApprove(u, "member")}>
                    אישור כחבר/ה
                  </button>
                  <button className="btn small secondary" onClick={() => quickApprove(u, "resident")}>
                    אישור כתושב/ת
                  </button>
                  <button className="btn small ghost" onClick={() => quickApprove(u, "guest")}>
                    אישור כאורח/ת
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <UserEditor
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {adding && (
        <UserEditor
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function UserEditor({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "user",
    membership: user?.membership ?? "guest",
    status: user?.status ?? "active",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.password) delete payload.password;
      if (user) await updateUserAdmin(user.id, payload);
      else await createUserAdmin(payload);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user || !window.confirm(`למחוק את ${user.full_name || user.email}?`)) return;
    try {
      await deleteUserAdmin(user.id);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 30, overflowY: "auto", padding: "40px 14px" }} onClick={onClose}>
      <form className="form card" style={{ padding: 16, maxWidth: 520, margin: "0 auto" }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{user ? "עריכת משתמש" : "משתמש חדש"}</h2>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="field">
          <label>שם מלא</label>
          <input type="text" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="field">
          <label>אימייל</label>
          <input type="email" value={form.email} onChange={set("email")} dir="ltr" required />
        </div>
        <div className="field">
          <label>טלפון</label>
          <input type="text" value={form.phone ?? ""} onChange={set("phone")} dir="ltr" />
        </div>
        <div className="field">
          <label>סיווג</label>
          <select value={form.membership} onChange={set("membership")}>
            {MEMBERSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>סטטוס</label>
          <select value={form.status} onChange={set("status")}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>תפקיד</label>
          <select value={form.role} onChange={set("role")}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{user ? "סיסמה חדשה (השאר ריק אם אין שינוי)" : "סיסמה ראשונית"}</label>
          <input type="password" value={form.password} onChange={set("password")} dir="ltr" required={!user} minLength={6} autoComplete="new-password" />
        </div>
        <button className="btn" disabled={busy}>
          {busy ? "שומר…" : "שמירה"}
        </button>
        <div className="row">
          <button type="button" className="btn ghost" onClick={onClose}>
            ביטול
          </button>
          {user && (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={remove}>
              מחיקה
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

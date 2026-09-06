import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { entityByType, type ContentData } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { createItem, deleteItem, loadItem, updateItem } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { FieldInput } from "@/components/fields";
import { Alert, Spinner } from "@/components/ui";
import { todayIso } from "@/lib/format";

export function ContentForm() {
  const { type = "article", id } = useParams();
  const def = entityByType(type);
  const isNew = !id || id === "new";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ContentData | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!def) return;
    if (isNew) {
      const initial: ContentData = {};
      for (const f of def.fields) {
        initial[f.name] = f.defaultValue ?? (f.type === "boolean" ? false : "");
        if ((f.type === "date" || f.type === "datetime") && f.name === def.dateField) initial[f.name] = f.type === "date" ? todayIso() : new Date().toISOString();
      }
      if (def.type === "article") initial.author = user?.full_name ?? "";
      setData(initial);
    } else {
      loadItem(def.type, id!, user)
        .then((res) => setData(res.data.data))
        .catch((e) => setError(errorMessage(e)));
    }
  }, [def, id, isNew, user]);

  if (!def) return <Alert kind="error">סוג תוכן לא מוכר</Alert>;
  if (!data) return error ? <Alert kind="error">{error}</Alert> : <Spinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = isNew ? await createItem(def.type, data, notify) : await updateItem(def.type, id!, data, notify);
      if (res.push) setInfo(`נשמר. התראה נשלחה ל-${res.push.targets} מכשירים.`);
      navigate(`/admin/content/${def.type}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("למחוק את הפריט? הפעולה אינה הפיכה.")) return;
    await deleteItem(def.type, id!);
    navigate(`/admin/content/${def.type}`, { replace: true });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1 className="page-title">{isNew ? `${def.label} חדש/ה` : `עריכת ${def.label}`}</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}
      {def.fields.map((f) => (
        <FieldInput key={f.name} field={f} value={data[f.name]} onChange={(v) => setData((d) => ({ ...(d ?? {}), [f.name]: v }))} />
      ))}
      <label className="check">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        לשלוח התראה למנויים בפרסום (נשלחת פעם אחת בלבד, בפרסום הראשון)
      </label>
      <button className="btn" disabled={busy}>
        {busy ? "שומר…" : isNew ? "שמירה ופרסום" : "שמירת שינויים"}
      </button>
      {!isNew && (
        <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={remove}>
          מחיקה
        </button>
      )}
    </form>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityByType, type ContentItem } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { deleteItem, loadList, updateItem } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { Alert, Empty, Spinner } from "@/components/ui";
import { formatShortDate } from "@/lib/format";

export function ContentList() {
  const { type = "article" } = useParams();
  const def = entityByType(type);
  const { user } = useAuth();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    if (!def) return;
    try {
      const res = await loadList(def.type, user, { all: 1, limit: 500 });
      setItems(res.data);
      setError(res.fromCache ? (res.error ?? null) : null);
    } catch (e) {
      setError(errorMessage(e));
      setItems([]);
    }
  }, [def, user]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!def) return <Alert kind="error">סוג תוכן לא מוכר</Alert>;

  const togglePublish = async (it: ContentItem) => {
    try {
      await updateItem(def.type, it.id, { published: !it.published }, true);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = async (it: ContentItem) => {
    if (!window.confirm(`למחוק את "${String(it.data[def.titleField] ?? "")}"? הפעולה אינה הפיכה.`)) return;
    try {
      await deleteItem(def.type, it.id);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const secondary = def.fields.find((f) => f.listSecondary);
  const shown = items?.filter((it) => !filter || String(it.data[def.titleField] ?? "").includes(filter));

  return (
    <>
      <div className="row between">
        <h1 className="page-title">{def.labelPlural}</h1>
        <Link className="btn small" to={`/admin/content/${def.type}/new`}>
          ＋ {def.label} חדש/ה
        </Link>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="field">
        <input type="search" placeholder="סינון לפי כותרת" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {shown === undefined || items === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty text={`אין ${def.labelPlural} עדיין`} />
      ) : (
        <ul className="list">
          {shown.map((it) => {
            const sec = secondary ? it.data[secondary.name] : null;
            const secLabel = secondary?.options ? secondary.options.find((o) => o.value === sec)?.label ?? sec : sec;
            return (
              <li key={it.id} className="list-item">
                <span className={`status-dot ${it.published ? "on" : ""}`} title={it.published ? "מפורסם" : "טיוטה"} />
                <Link to={`/admin/content/${def.type}/${it.id}`} className="body" style={{ color: "inherit" }}>
                  <div className="t">{String(it.data[def.titleField] ?? "(ללא כותרת)")}</div>
                  <div className="s">
                    {formatShortDate(it.sort_date)}
                    {secLabel ? ` · ${String(secLabel)}` : ""}
                    {it.views ? ` · ${it.views} צפיות` : ""}
                    {!it.published ? " · טיוטה" : ""}
                  </div>
                </Link>
                <button className="btn small ghost" onClick={() => togglePublish(it)} title={it.published ? "הסתרה" : "פרסום"}>
                  {it.published ? "הסתר" : "פרסם"}
                </button>
                <button className="btn small ghost" onClick={() => remove(it)} aria-label="מחיקה">
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Link className="fab" to={`/admin/content/${def.type}/new`} aria-label="הוספה">
        ＋
      </Link>
    </>
  );
}

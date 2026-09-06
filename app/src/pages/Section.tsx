import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SECTIONS, sectionByKey, type ContentItem } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { loadList } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { ArticleCard, Empty, OfflineBar, Spinner } from "@/components/ui";
import { useAppResume } from "@/lib/resume";

export function Section() {
  const { key = "all" } = useParams();
  const { user } = useAuth();
  const section = sectionByKey(key);
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await loadList("article", user, { section: section?.key, limit: 100 });
      setItems(res.data);
      setOffline(res.fromCache ? (res.error ?? null) : null);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
    }
  }, [user, section?.key]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);
  useAppResume(load);

  return (
    <>
      <h1 className="page-title" style={{ color: section?.color }}>
        {section ? section.label : "כל הכתבות"}
      </h1>
      {section && <p className="page-desc">{section.description}</p>}
      <div className="chips">
        <Link to="/section/all" className={`chip ${!section ? "active" : ""}`}>
          הכל
        </Link>
        {SECTIONS.map((s) => (
          <Link key={s.key} to={`/section/${s.key}`} className={`chip ${s.key === section?.key ? "active" : ""}`} style={{ "--chip-color": s.color } as React.CSSProperties}>
            {s.label}
          </Link>
        ))}
      </div>
      {error && <OfflineBar message={error} onRetry={load} />}
      {offline && <OfflineBar message={offline} onRetry={load} />}
      {items === null ? <Spinner /> : items.length === 0 ? <Empty text="אין כתבות במדור זה עדיין" /> : items.map((a) => <ArticleCard key={a.id} item={a} />)}
    </>
  );
}

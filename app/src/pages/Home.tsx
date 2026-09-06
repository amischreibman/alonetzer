import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SECTIONS } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { loadHome, type HomeBundle } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { ArticleCard, Empty, EventCard, FlashItem, GreetingCard, IssueCard, OfflineBar, SectionHead, Spinner, usePullToRefresh } from "@/components/ui";
import { useAppResume } from "@/lib/resume";

export function Home() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await loadHome(user);
      setData(res.data);
      setOffline(res.fromCache ? (res.error ?? "מוצג תוכן שמור") : null);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);
  useAppResume(load);
  const { pulling } = usePullToRefresh(load);

  if (loading && !data) return <Spinner />;
  if (error && !data)
    return (
      <>
        <OfflineBar message={error} onRetry={load} />
        <Empty icon="📡" text="לא הצלחנו לטעון את העלון. בדוק את החיבור לרשת ואת כתובת השרת בהגדרות." />
        <Link className="btn ghost" to="/settings">
          להגדרות
        </Link>
      </>
    );
  if (!data) return null;

  const pinned = data.articles.filter((a) => a.data.pinned);
  const rest = data.articles.filter((a) => !a.data.pinned);

  return (
    <>
      {pulling && <div className="pull-hint">מרענן…</div>}
      {offline && <OfflineBar message={offline} onRetry={load} />}
      {user?.status === "pending" && <div className="alert info">החשבון שלך ממתין לאישור עורך העלון. עד אז מוצג רק תוכן פתוח לכולם.</div>}

      <div className="chips">
        {SECTIONS.map((s) => (
          <Link key={s.key} to={`/section/${s.key}`} className="chip" style={{ borderColor: s.color, color: s.color }}>
            {s.label}
          </Link>
        ))}
      </div>

      {data.flashes.length > 0 && (
        <div className="flash-strip">
          <div className="head">
            <span>⚡ מבזקים</span>
            <Link to="/flashes">לכל המבזקים ›</Link>
          </div>
          {data.flashes.slice(0, 3).map((f) => (
            <FlashItem key={f.id} item={f} />
          ))}
        </div>
      )}

      {pinned.map((a) => (
        <ArticleCard key={a.id} item={a} />
      ))}

      {data.events.length > 0 && (
        <>
          <SectionHead title="בקרוב בלוח האירועים" to="/events" />
          {data.events.slice(0, 3).map((e) => (
            <EventCard key={e.id} item={e} />
          ))}
        </>
      )}

      <SectionHead title="כתבות אחרונות" to="/section/all" />
      {rest.length === 0 && pinned.length === 0 ? <Empty text="עדיין אין כתבות" /> : rest.map((a, i) => <ArticleCard key={a.id} item={a} compact={i > 1} />)}

      {data.greetings.length > 0 && (
        <>
          <SectionHead title="ורודים 🌸" to="/pinks" />
          {data.greetings.slice(0, 2).map((g) => (
            <GreetingCard key={g.id} item={g} />
          ))}
        </>
      )}

      {data.issues.length > 0 && (
        <>
          <SectionHead title="הגיליון המודפס האחרון" to="/archive" linkText="לארכיון" />
          <div className="issue-grid">
            {data.issues.map((i) => (
              <IssueCard key={i.id} item={i} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

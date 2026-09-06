import { useCallback, useEffect, useState } from "react";
import type { ContentItem, ContentType } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { loadList } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { ArticleCard, Empty, EventCard, FlashItem, GreetingCard, IssueCard, OfflineBar, Spinner } from "@/components/ui";
import { useAppResume } from "@/lib/resume";

function useContentList(type: ContentType, params: Record<string, string | number | undefined>) {
  const { user } = useAuth();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    try {
      const res = await loadList(type, user, JSON.parse(key));
      setItems(res.data);
      setNotice(res.fromCache ? (res.error ?? null) : null);
    } catch (err) {
      setNotice(errorMessage(err));
      setItems((prev) => prev ?? []);
    }
  }, [type, user, key]);
  useEffect(() => {
    void load();
  }, [load]);
  useAppResume(load);
  return { items, notice, load };
}

export function Flashes() {
  const { items, notice, load } = useContentList("flash", { limit: 100 });
  return (
    <>
      <h1 className="page-title">⚡ מבזקים</h1>
      <p className="page-desc">הודעות קצרות ועדכונים דחופים</p>
      {notice && <OfflineBar message={notice} onRetry={load} />}
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="אין מבזקים כרגע" />
      ) : (
        <div className="flash-strip">
          {items.map((f) => (
            <FlashItem key={f.id} item={f} />
          ))}
        </div>
      )}
    </>
  );
}

export function Events() {
  const upcoming = useContentList("event", { upcoming: 1, limit: 100 });
  const past = useContentList("event", { past: 1, limit: 30 });
  const [showPast, setShowPast] = useState(false);
  return (
    <>
      <h1 className="page-title">📅 לוח אירועים</h1>
      {upcoming.notice && <OfflineBar message={upcoming.notice} onRetry={upcoming.load} />}
      {upcoming.items === null ? <Spinner /> : upcoming.items.length === 0 ? <Empty icon="🗓️" text="אין אירועים קרובים בלוח" /> : upcoming.items.map((e) => <EventCard key={e.id} item={e} />)}
      <button className="btn ghost" onClick={() => setShowPast((v) => !v)}>
        {showPast ? "הסתרת אירועים שהיו" : "אירועים שכבר היו"}
      </button>
      {showPast && past.items?.map((e) => <EventCard key={e.id} item={e} past />)}
    </>
  );
}

export function Pinks() {
  const greetings = useContentList("greeting", { limit: 60 });
  const articles = useContentList("article", { section: "pinks", limit: 30 });
  return (
    <>
      <h1 className="page-title" style={{ color: "var(--pink)" }}>
        🌸 ורודים
      </h1>
      <p className="page-desc">ברכות, ימי הולדת והאירועים המשמחים</p>
      {greetings.notice && <OfflineBar message={greetings.notice} onRetry={greetings.load} />}
      {greetings.items === null ? <Spinner /> : greetings.items.length === 0 && (articles.items?.length ?? 0) === 0 ? <Empty icon="🌸" text="אין ברכות כרגע" /> : greetings.items.map((g) => <GreetingCard key={g.id} item={g} />)}
      {articles.items && articles.items.length > 0 && (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>
            כתבות במדור ורודים
          </h2>
          {articles.items.map((a) => (
            <ArticleCard key={a.id} item={a} compact />
          ))}
        </>
      )}
    </>
  );
}

export function Archive() {
  const { items, notice, load } = useContentList("issue", { limit: 300 });
  const [kind, setKind] = useState<"all" | "print" | "supplement">("all");
  const filtered = items?.filter((i) => kind === "all" || (i.data.kind ?? "print") === kind) ?? null;
  return (
    <>
      <h1 className="page-title">🗂️ ארכיון</h1>
      <p className="page-desc">הגיליונות המודפסים והמוספים, לקריאה ולהורדה</p>
      <div className="chips">
        {(
          [
            ["all", "הכל"],
            ["print", "גיליונות"],
            ["supplement", "מוספים"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`chip ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      {notice && <OfflineBar message={notice} onRetry={load} />}
      {filtered === null ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty icon="📰" text="הארכיון ריק עדיין" />
      ) : (
        <div className="issue-grid">
          {filtered.map((i) => (
            <IssueCard key={i.id} item={i} />
          ))}
        </div>
      )}
    </>
  );
}

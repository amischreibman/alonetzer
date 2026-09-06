import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Browser } from "@capacitor/browser";
import { sectionByKey, type ContentItem, type ContentType } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { loadItem, trackView } from "@/lib/api";
import { absoluteUrl, errorMessage, HttpError } from "@/lib/http";
import { formatDate, formatDateTime } from "@/lib/format";
import { Alert, RichText, Spinner, VisibilityLock } from "@/components/ui";

/** Detail screen for articles, events, greetings and issues. */
export function ItemPage({ type }: { type: ContentType }) {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setItem(null);
    setError(null);
    loadItem(type, id, user)
      .then((res) => {
        if (!alive) return;
        setItem(res.data);
        if (!res.fromCache) void trackView(type, id);
      })
      .catch((err) => alive && setError({ message: errorMessage(err), status: err instanceof HttpError ? err.status : 0 }));
    return () => {
      alive = false;
    };
  }, [type, id, user]);

  if (error) {
    return (
      <>
        <Alert kind="error">{error.message}</Alert>
        {error.status === 401 && (
          <Link className="btn" to="/login">
            להתחברות
          </Link>
        )}
      </>
    );
  }
  if (!item) return <Spinner />;
  const d = item.data;
  const section = sectionByKey(d.section);
  const hero = absoluteUrl(d.image_url ?? d.cover_url);

  const openPdf = async () => {
    await Browser.open({ url: absoluteUrl(d.pdf_url) });
  };

  return (
    <article className="article">
      <div className="meta">
        {section && (
          <span className="tag" style={{ "--tag-color": section.color } as React.CSSProperties}>
            {section.label}
          </span>
        )}
        {type === "event" ? <span>{formatDateTime(d.start_date)}</span> : <span>{formatDate(d.publish_date ?? d.date ?? item.sort_date)}</span>}
        {d.author ? <span>· {String(d.author)}</span> : null}
        <VisibilityLock visibility={item.visibility} />
        {!item.published && <span className="tag outline">טיוטה</span>}
      </div>
      <h1>{String(d.title ?? "")}</h1>
      {d.subtitle ? <p className="lead">{String(d.subtitle)}</p> : null}
      {type === "event" && (
        <div className="card" style={{ padding: 12 }}>
          <div>🗓️ {formatDateTime(d.start_date)}{d.end_date ? ` – ${formatDateTime(d.end_date)}` : ""}</div>
          {d.location ? <div>📍 {String(d.location)}</div> : null}
        </div>
      )}
      {hero && <img className="hero" src={hero} alt="" />}
      {type === "issue" && (
        <button className="btn" onClick={openPdf}>
          📄 פתיחת הגיליון (PDF)
        </button>
      )}
      <RichText html={d.content ?? d.message ?? d.description ?? ""} />
      {item.views > 0 && <p style={{ color: "var(--ink-3)", fontSize: 12 }}>{item.views} צפיות</p>}
    </article>
  );
}

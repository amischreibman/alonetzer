// Small presentational building blocks shared by all screens.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { sectionByKey, type ContentItem } from "@alon/shared";
import { absoluteUrl } from "@/lib/http";
import { excerpt, formatDate, formatDateTime, relativeTime, toDate } from "@/lib/format";

export function Spinner() {
  return <div className="spinner" aria-label="טוען" />;
}

export function Empty({ icon = "📭", text }: { icon?: string; text: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div>{text}</div>
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function OfflineBar({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="offline-bar">
      <span>⚠️ {message}</span>
      {onRetry && (
        <button className="btn small ghost" onClick={onRetry}>
          נסה שוב
        </button>
      )}
    </div>
  );
}

export function SectionHead({ title, to, linkText = "לכל המדור" }: { title: string; to?: string; linkText?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {to && <Link to={to}>{linkText} ›</Link>}
    </div>
  );
}

export function VisibilityLock({ visibility }: { visibility: unknown }) {
  if (visibility === "members") return <span className="lock" title="לחברי קיבוץ בלבד">🔒 חברים</span>;
  if (visibility === "residents") return <span className="lock" title="לחברים ותושבים">🔒 תושבים</span>;
  return null;
}

export function ArticleCard({ item, compact = false }: { item: ContentItem; compact?: boolean }) {
  const d = item.data;
  const section = sectionByKey(d.section);
  const img = absoluteUrl(d.image_url);
  const cls = `card ${compact ? "compact" : ""} ${item.data.pinned ? "pinned" : ""}`;
  return (
    <Link to={`/article/${item.id}`} className={cls}>
      {img && (compact ? <img className="thumb" src={img} alt="" loading="lazy" /> : <img className="cover" src={img} alt="" loading="lazy" />)}
      <div className="body">
        <div className="meta">
          {section && (
            <span className="tag" style={{ "--tag-color": section.color } as React.CSSProperties}>
              {section.label}
            </span>
          )}
          <span>{formatDate(d.publish_date ?? item.sort_date)}</span>
          {d.author ? <span>· {String(d.author)}</span> : null}
          <VisibilityLock visibility={item.visibility} />
        </div>
        <h3>{String(d.title ?? "")}</h3>
        {d.subtitle ? <p className="sub">{String(d.subtitle)}</p> : null}
        {!compact && <p className="excerpt">{excerpt(d.content, 160)}</p>}
      </div>
    </Link>
  );
}

export function FlashItem({ item }: { item: ContentItem }) {
  const d = item.data;
  const link = typeof d.link === "string" && d.link ? d.link : null;
  return (
    <div className="flash-item">
      <div className="t">
        {String(d.title ?? "")} <VisibilityLock visibility={item.visibility} />
      </div>
      <div className="c">{String(d.content ?? "")}</div>
      {link && (
        <a href={link} target="_blank" rel="noreferrer">
          לקישור ›
        </a>
      )}
      <div className="d">{relativeTime(d.date ?? item.sort_date)}</div>
    </div>
  );
}

export function EventCard({ item, past = false }: { item: ContentItem; past?: boolean }) {
  const d = item.data;
  const date = toDate(d.start_date);
  const day = date ? String(date.getDate()) : "";
  const mon = date ? date.toLocaleDateString("he-IL", { month: "short" }) : "";
  const img = absoluteUrl(d.image_url);
  return (
    <Link to={`/event/${item.id}`} className={`card ${past ? "past" : ""}`}>
      <div className="body event-row">
        <div className="event-date">
          <div className="day">{day}</div>
          <div className="mon">{mon}</div>
        </div>
        <div className="grow">
          <h3>{String(d.title ?? "")}</h3>
          <div className="meta">
            <span>{formatDateTime(d.start_date)}</span>
            {d.location ? <span>📍 {String(d.location)}</span> : null}
          </div>
          {d.description ? <p className="excerpt">{excerpt(d.description, 120)}</p> : null}
        </div>
        {img && <img className="thumb" src={img} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} loading="lazy" />}
      </div>
    </Link>
  );
}

const GREETING_ICON: Record<string, string> = { birthday: "🎂", birth: "👶", wedding: "💍", achievement: "🏆", other: "💐" };

export function GreetingCard({ item }: { item: ContentItem }) {
  const d = item.data;
  const img = absoluteUrl(d.image_url);
  return (
    <Link to={`/greeting/${item.id}`} className="card greeting">
      {img && <img className="cover" src={img} alt="" loading="lazy" />}
      <div className="body">
        <div className="meta">
          <span>{GREETING_ICON[String(d.kind)] ?? "💐"}</span>
          <span>{formatDate(d.date ?? item.sort_date)}</span>
        </div>
        <h3>{String(d.title ?? "")}</h3>
        <p className="excerpt">{excerpt(d.message, 140)}</p>
      </div>
    </Link>
  );
}

export function IssueCard({ item }: { item: ContentItem }) {
  const d = item.data;
  const cover = absoluteUrl(d.cover_url);
  return (
    <Link to={`/issue/${item.id}`} className="card issue-card">
      {cover ? <img className="cover" src={cover} alt="" loading="lazy" /> : <div className="cover" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📰</div>}
      <div className="body">
        <h3>{String(d.title ?? "")}</h3>
        <div className="meta">
          <span>{formatDate(d.date)}</span>
          {d.kind === "supplement" ? <span className="tag outline">מוסף</span> : null}
        </div>
      </div>
    </Link>
  );
}

/** Renders stored HTML (from the editor) or plain text with line breaks. */
export function RichText({ html }: { html: unknown }) {
  const s = String(html ?? "");
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(s);
  if (!looksHtml) {
    return (
      <div className="rich">
        {s.split(/\n{2,}/).map((p, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            {p}
          </p>
        ))}
      </div>
    );
  }
  return <div className="rich" dangerouslySetInnerHTML={{ __html: sanitize(s) }} />;
}

/** Very small sanitizer: strips scripts/handlers. Content comes from trusted editors only. */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function Toast({ title, body, onClose }: { title: string; body?: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast" onClick={onClose} role="status">
      <b>{title}</b>
      {body}
    </div>
  );
}

/** Simple pull-to-refresh for touch screens (works inside the scrolling body). */
export function usePullToRefresh(onRefresh: () => Promise<unknown>): { pulling: boolean } {
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    let startY = 0;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        startY = e.touches[0].clientY;
        armed = true;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (armed && e.touches[0].clientY - startY > 90 && window.scrollY <= 0) setPulling(true);
    };
    const onEnd = () => {
      if (pulling) {
        onRefresh().finally(() => setPulling(false));
      }
      armed = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh, pulling]);
  return { pulling };
}

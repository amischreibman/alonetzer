import { useEffect, useState } from "react";
import type { ContentItem } from "@alon/shared";
import { search } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { ArticleCard, Empty, EventCard, FlashItem, GreetingCard, IssueCard, Alert } from "@/components/ui";

export function Search() {
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setItems(null);
      return;
    }
    const timer = setTimeout(() => {
      search(t)
        .then((res) => {
          setItems(res);
          setError(null);
        })
        .catch((err) => setError(errorMessage(err)));
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <>
      <div className="field">
        <input type="search" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="חיפוש כתבה, מבזק, אירוע או ברכה…" />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {items?.length === 0 && <Empty icon="🔍" text="לא נמצאו תוצאות" />}
      {items?.map((it) => {
        switch (it.type) {
          case "article":
            return <ArticleCard key={it.id} item={it} compact />;
          case "flash":
            return (
              <div key={it.id} className="flash-strip">
                <FlashItem item={it} />
              </div>
            );
          case "event":
            return <EventCard key={it.id} item={it} />;
          case "greeting":
            return <GreetingCard key={it.id} item={it} />;
          case "issue":
            return <IssueCard key={it.id} item={it} />;
          default:
            return null;
        }
      })}
    </>
  );
}

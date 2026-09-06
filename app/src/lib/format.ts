// Date and text helpers for Hebrew UI.
const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long" });

export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "";
}

export function formatShortDate(value: unknown): string {
  const d = toDate(value);
  return d ? shortFmt.format(d) : "";
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  const hasTime = typeof value === "string" && /T\d{2}:\d{2}/.test(value);
  return hasTime ? `${weekdayFmt.format(d)}, ${dateFmt.format(d)} · ${timeFmt.format(d)}` : `${weekdayFmt.format(d)}, ${dateFmt.format(d)}`;
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function relativeTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const days = Math.round(h / 24);
  if (days < 7) return days === 1 ? "אתמול" : `לפני ${days} ימים`;
  return shortFmt.format(d);
}

/** Strip HTML/markdown for previews. */
export function excerpt(html: unknown, max = 140): string {
  const text = String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

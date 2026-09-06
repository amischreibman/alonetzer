// Turns a validated payload into the envelope columns stored in `content`.
import { entityByType, validateContent, type ContentData, type ContentType, type EntityDef, type Visibility } from "../../shared/src/index.js";
import type { ContentInput } from "./db.js";

export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
  }
}

export function buildContentInput(type: ContentType, input: ContentData): Omit<ContentInput, "created_by" | "legacy_id" | "created_at"> {
  const def = entityByType(type);
  if (!def) throw new ValidationError(["סוג תוכן לא מוכר"]);
  const { data, errors } = validateContent(def, input);
  if (errors.length) throw new ValidationError(errors);
  return {
    type,
    data,
    published: data.published === true,
    sort_date: sortDateOf(def, data),
    section: def.sectionField ? String(data[def.sectionField] ?? "") || null : null,
    visibility: (def.visibilityField ? (data[def.visibilityField] as Visibility) : "public") ?? "public",
    pinned: data.pinned === true,
    search_text: searchText(def, data),
  };
}

export function sortDateOf(def: EntityDef, data: ContentData): string {
  const raw = data[def.dateField];
  const t = raw ? Date.parse(String(raw)) : NaN;
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

export function searchText(def: EntityDef, data: ContentData): string {
  return def.fields
    .filter((f) => f.searchable)
    .map((f) => String(data[f.name] ?? "").replace(/<[^>]+>/g, " "))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Content model of the newsletter, shared by the app and the server.
// Every entity, field and enum used by both sides is declared here once.

export type SectionKey = "management" | "community" | "stage" | "pinks";

export interface SectionDef {
  key: SectionKey;
  label: string;
  color: string;
  description: string;
}

export const SECTIONS: SectionDef[] = [
  { key: "management", label: "הנהלה", color: "#1f6b3a", description: "פרוטוקולים, עדכונים והודעות רשמיות" },
  { key: "community", label: "קהילה", color: "#2b6cb0", description: "חיי היומיום, תרבות, חינוך ואנשים" },
  { key: "stage", label: "במה", color: "#b7791f", description: "דעות, ביקורת ותגובות של חברי הקיבוץ" },
  { key: "pinks", label: "ורודים", color: "#d53f8c", description: "ברכות, ימי הולדת ואירועים משמחים" },
];

export function sectionByKey(key: unknown): SectionDef | undefined {
  return SECTIONS.find((s) => s.key === key || s.label === key);
}

/** Who may read a content item. Mirrors the site: public / residents / members only. */
export type Visibility = "public" | "residents" | "members";

export const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "public", label: "פתוח לכולם" },
  { value: "residents", label: "חברים ותושבים בלבד" },
  { value: "members", label: "חברי קיבוץ בלבד" },
];

/** Membership level of a registered user. */
export type Membership = "member" | "resident" | "guest";

export const MEMBERSHIP_OPTIONS: { value: Membership; label: string }[] = [
  { value: "member", label: "חבר/ת קיבוץ" },
  { value: "resident", label: "תושב/ת" },
  { value: "guest", label: "אורח/ת" },
];

export type UserRole = "admin" | "editor" | "user";

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "קורא/ת" },
  { value: "editor", label: "עורך/ת" },
  { value: "admin", label: "מנהל/ת" },
];

export type UserStatus = "pending" | "active" | "blocked";

export const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "pending", label: "ממתין/ה לאישור" },
  { value: "active", label: "פעיל/ה" },
  { value: "blocked", label: "חסום/ה" },
];

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  membership: Membership;
  status: UserStatus;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "select"
  | "date"
  | "datetime"
  | "image"
  | "file"
  | "boolean"
  | "number";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Shown in admin list rows as a secondary line. */
  listSecondary?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  /** Searchable by the text search endpoint. */
  searchable?: boolean;
}

export type ContentType = "article" | "flash" | "event" | "greeting" | "issue";

export type PushCategory = "management" | "community" | "stage" | "pinks" | "flash" | "event" | "issue";

export interface EntityDef {
  type: ContentType;
  label: string;
  labelPlural: string;
  titleField: string;
  /** Field used for ordering (newest first) and as the "sort_date" column. */
  dateField: string;
  /** Field holding the section key (articles only). */
  sectionField?: string;
  visibilityField?: string;
  /** Push category, or a function deriving it from the item (articles use the section). */
  pushCategory: PushCategory | ((item: ContentData) => PushCategory);
  fields: FieldDef[];
}

export type ContentData = Record<string, unknown>;

/** A stored content item: envelope columns + the entity fields. */
export interface ContentItem {
  id: string;
  type: ContentType;
  published: boolean;
  sort_date: string;
  section?: string | null;
  visibility: Visibility;
  views: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  data: ContentData;
}

export const ARTICLE: EntityDef = {
  type: "article",
  label: "כתבה",
  labelPlural: "כתבות",
  titleField: "title",
  dateField: "publish_date",
  sectionField: "section",
  visibilityField: "visibility",
  pushCategory: (item) => (sectionByKey(item.section)?.key ?? "community"),
  fields: [
    { name: "title", label: "כותרת", type: "text", required: true, searchable: true },
    { name: "subtitle", label: "כותרת משנה", type: "text", searchable: true },
    { name: "section", label: "מדור", type: "select", required: true, options: SECTIONS.map((s) => ({ value: s.key, label: s.label })), listSecondary: true },
    { name: "author", label: "מאת", type: "text", placeholder: "שם הכותב/ת", searchable: true },
    { name: "image_url", label: "תמונה ראשית", type: "image" },
    { name: "content", label: "תוכן", type: "richtext", required: true, searchable: true },
    { name: "publish_date", label: "תאריך פרסום", type: "date", required: true },
    { name: "visibility", label: "מי יכול לקרוא", type: "select", options: VISIBILITY_OPTIONS, defaultValue: "public" },
    { name: "pinned", label: "נעוץ בראש העמוד", type: "boolean", defaultValue: false },
    { name: "published", label: "מפורסם", type: "boolean", defaultValue: true },
  ],
};

export const FLASH: EntityDef = {
  type: "flash",
  label: "מבזק",
  labelPlural: "מבזקים",
  titleField: "title",
  dateField: "date",
  visibilityField: "visibility",
  pushCategory: "flash",
  fields: [
    { name: "title", label: "כותרת המבזק", type: "text", required: true, searchable: true },
    { name: "content", label: "תוכן", type: "textarea", required: true, searchable: true },
    { name: "link", label: "קישור (לא חובה)", type: "text", placeholder: "https://..." },
    { name: "date", label: "תאריך", type: "datetime", required: true },
    { name: "visibility", label: "מי יכול לקרוא", type: "select", options: VISIBILITY_OPTIONS, defaultValue: "public" },
    { name: "published", label: "מפורסם", type: "boolean", defaultValue: true },
  ],
};

export const EVENT: EntityDef = {
  type: "event",
  label: "אירוע",
  labelPlural: "לוח אירועים",
  titleField: "title",
  dateField: "start_date",
  pushCategory: "event",
  fields: [
    { name: "title", label: "שם האירוע", type: "text", required: true, searchable: true },
    { name: "start_date", label: "תאריך ושעה", type: "datetime", required: true, listSecondary: true },
    { name: "end_date", label: "סיום (לא חובה)", type: "datetime" },
    { name: "location", label: "מיקום", type: "text", searchable: true },
    { name: "description", label: "פרטים", type: "textarea", searchable: true },
    { name: "image_url", label: "תמונה", type: "image" },
    { name: "published", label: "מפורסם", type: "boolean", defaultValue: true },
  ],
};

export const GREETING: EntityDef = {
  type: "greeting",
  label: "ברכה",
  labelPlural: "ורודים",
  titleField: "title",
  dateField: "date",
  pushCategory: "pinks",
  fields: [
    { name: "title", label: "כותרת", type: "text", required: true, placeholder: "מזל טוב ל...", searchable: true },
    {
      name: "kind",
      label: "סוג",
      type: "select",
      options: [
        { value: "birthday", label: "יום הולדת" },
        { value: "birth", label: "לידה" },
        { value: "wedding", label: "חתונה" },
        { value: "achievement", label: "הישג" },
        { value: "other", label: "אחר" },
      ],
      defaultValue: "other",
      listSecondary: true,
    },
    { name: "message", label: "ברכה", type: "textarea", required: true, searchable: true },
    { name: "image_url", label: "תמונה", type: "image" },
    { name: "date", label: "תאריך", type: "date", required: true },
    { name: "published", label: "מפורסם", type: "boolean", defaultValue: true },
  ],
};

export const ISSUE: EntityDef = {
  type: "issue",
  label: "גיליון",
  labelPlural: "ארכיון גיליונות",
  titleField: "title",
  dateField: "date",
  pushCategory: "issue",
  fields: [
    { name: "title", label: "שם הגיליון", type: "text", required: true, placeholder: "גיליון 2236", searchable: true },
    { name: "number", label: "מספר גיליון", type: "number", listSecondary: true },
    { name: "date", label: "תאריך", type: "date", required: true },
    {
      name: "kind",
      label: "סוג",
      type: "select",
      options: [
        { value: "print", label: "גיליון מודפס" },
        { value: "supplement", label: "מוסף" },
      ],
      defaultValue: "print",
    },
    { name: "cover_url", label: "תמונת שער", type: "image" },
    { name: "pdf_url", label: "קובץ PDF", type: "file", required: true },
    { name: "published", label: "מפורסם", type: "boolean", defaultValue: true },
  ],
};

export const CONTENT_ENTITIES: EntityDef[] = [ARTICLE, FLASH, EVENT, GREETING, ISSUE];

export function entityByType(type: unknown): EntityDef | undefined {
  return CONTENT_ENTITIES.find((e) => e.type === type);
}

export function isAdmin(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}

export function isEditor(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "editor";
}

/** Can this user read an item with the given visibility? */
export function canRead(user: Pick<User, "role" | "membership" | "status"> | null | undefined, visibility: unknown): boolean {
  const v = (visibility as Visibility | undefined) ?? "public";
  if (v === "public") return true;
  if (!user || user.status !== "active") return false;
  if (isEditor(user)) return true;
  if (v === "residents") return user.membership === "member" || user.membership === "resident";
  if (v === "members") return user.membership === "member";
  return true;
}

/** Visibilities a user is allowed to see (used for SQL filtering). */
export function readableVisibilities(user: Pick<User, "role" | "membership" | "status"> | null | undefined): Visibility[] {
  const all: Visibility[] = ["public", "residents", "members"];
  return all.filter((v) => canRead(user, v));
}

export function pushCategoryOf(def: EntityDef, data: ContentData): PushCategory {
  return typeof def.pushCategory === "function" ? def.pushCategory(data) : def.pushCategory;
}

/**
 * Validate and normalise a content payload against its entity definition.
 * Returns the cleaned data or a list of Hebrew error messages.
 */
export function validateContent(def: EntityDef, input: ContentData): { data: ContentData; errors: string[] } {
  const data: ContentData = {};
  const errors: string[] = [];
  for (const f of def.fields) {
    let v = input[f.name];
    if (v === undefined || v === null || v === "") v = f.defaultValue ?? (f.type === "boolean" ? false : null);
    switch (f.type) {
      case "boolean":
        v = v === true || v === "true" || v === 1 || v === "1";
        break;
      case "number":
        if (v !== null) {
          const n = Number(v);
          if (Number.isNaN(n)) errors.push(`${f.label}: חייב להיות מספר`);
          else v = n;
        }
        break;
      case "select":
        if (v !== null && f.options && !f.options.some((o) => o.value === v)) errors.push(`${f.label}: ערך לא חוקי`);
        break;
      case "date":
      case "datetime":
        if (v !== null) {
          const t = Date.parse(String(v));
          if (Number.isNaN(t)) errors.push(`${f.label}: תאריך לא חוקי`);
          else v = f.type === "date" ? String(v).slice(0, 10) : new Date(t).toISOString();
        }
        break;
      default:
        if (v !== null) v = String(v);
    }
    if (f.required && (v === null || v === "")) errors.push(`${f.label}: שדה חובה`);
    data[f.name] = v;
  }
  return { data, errors };
}

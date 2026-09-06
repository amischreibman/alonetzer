// Generic form inputs driven by the shared field definitions.
import { useState } from "react";
import type { FieldDef } from "@alon/shared";
import { uploadFile } from "@/lib/api";
import { absoluteUrl, errorMessage } from "@/lib/http";

interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function FieldInput({ field, value, onChange }: Props) {
  const id = `f_${field.name}`;
  const str = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "boolean":
      return (
        <label className="check">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "select":
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
            {!field.required && <option value="">—</option>}
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "textarea":
    case "richtext":
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <textarea id={id} className={field.type === "richtext" ? "tall" : ""} value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
          {field.type === "richtext" && <div className="hint">אפשר להדביק טקסט רגיל (פסקאות מופרדות בשורה ריקה) או HTML.</div>}
        </div>
      );
    case "date":
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type="date" value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "datetime":
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type="datetime-local" value={toLocalInput(str)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")} />
        </div>
      );
    case "number":
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type="number" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </div>
      );
    case "image":
    case "file":
      return <FileField field={field} value={str} onChange={onChange} />;
    default:
      return (
        <div className="field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type="text" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </div>
      );
  }
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FileField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isImage = field.type === "image";
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadFile(file));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field">
      <label>{field.label}</label>
      <div className="row">
        <label className="btn small secondary" style={{ width: "auto" }}>
          {busy ? "מעלה…" : isImage ? "בחירת תמונה" : "בחירת קובץ"}
          <input type="file" accept={isImage ? "image/*" : "application/pdf,image/*"} hidden disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" className="btn small ghost" onClick={() => onChange("")}>
            הסרה
          </button>
        )}
        <input type="url" className="grow" value={value} onChange={(e) => onChange(e.target.value)} placeholder="או הדבקת כתובת URL" style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }} />
      </div>
      {err && <div className="alert error">{err}</div>}
      {value && isImage && <img className="preview-img" src={absoluteUrl(value)} alt="" />}
      {value && !isImage && (
        <div className="hint">
          קובץ: <a href={absoluteUrl(value)} target="_blank" rel="noreferrer">{value.split("/").pop()}</a>
        </div>
      )}
    </div>
  );
}

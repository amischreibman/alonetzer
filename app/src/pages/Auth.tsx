import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { errorMessage, post } from "@/lib/http";
import { Alert } from "@/components/ui";
import { APP_NAME } from "@/config";

function Logo() {
  return (
    <div className="login-logo">
      <div className="mark">📰</div>
      <h1>{APP_NAME}</h1>
      <p>העלון הדיגיטלי של הקיבוץ</p>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <Logo />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="field">
        <label htmlFor="email">אימייל</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
      </div>
      <div className="field">
        <label htmlFor="password">סיסמה</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "מתחבר…" : "כניסה"}
      </button>
      <div className="links">
        <Link to="/register">הרשמה לעלון</Link>
        <Link to="/forgot">שכחתי סיסמה</Link>
      </div>
      <Link className="btn ghost" to="/">
        המשך בלי להתחבר (תוכן פתוח בלבד)
      </Link>
    </form>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", password2: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.password2) return setError("הסיסמאות אינן זהות");
    setBusy(true);
    setError(null);
    try {
      await register(form.email, form.password, form.full_name, form.phone);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <Logo />
      <Alert kind="info">ההרשמה פתוחה לחברי הקיבוץ, לתושבים ולבני משפחה. לאחר ההרשמה עורך העלון מאשר את החשבון ומסווג אותו, ואז נפתחות הכתבות השמורות לחברים.</Alert>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="field">
        <label>שם מלא</label>
        <input type="text" autoComplete="name" value={form.full_name} onChange={set("full_name")} required />
      </div>
      <div className="field">
        <label>אימייל</label>
        <input type="email" autoComplete="email" value={form.email} onChange={set("email")} required dir="ltr" />
      </div>
      <div className="field">
        <label>טלפון (לא חובה)</label>
        <input type="text" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} dir="ltr" />
      </div>
      <div className="field">
        <label>סיסמה (לפחות 6 תווים)</label>
        <input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={6} dir="ltr" />
      </div>
      <div className="field">
        <label>אימות סיסמה</label>
        <input type="password" autoComplete="new-password" value={form.password2} onChange={set("password2")} required dir="ltr" />
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "נרשם…" : "הרשמה"}
      </button>
      <div className="links">
        <Link to="/login">כבר רשום? כניסה</Link>
      </div>
    </form>
  );
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ mail: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setDone(await post<{ ok: boolean; mail: boolean }>("/api/auth/forgot", { email }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <Logo />
      {done ? (
        <Alert kind={done.mail ? "success" : "info"}>{done.mail ? "אם הכתובת רשומה, נשלח אליה קישור לאיפוס הסיסמה (תקף לשעתיים)." : "שליחת מייל אינה מוגדרת בשרת. פנה לעורך העלון כדי לקבל סיסמה חדשה."}</Alert>
      ) : (
        <>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="field">
            <label>אימייל</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
          </div>
          <button className="btn">שליחת קישור לאיפוס</button>
        </>
      )}
      <div className="links">
        <Link to="/login">חזרה לכניסה</Link>
      </div>
    </form>
  );
}

/** Opened from the email link (web build served by the server): /reset?token=... */
export function Reset() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/api/auth/reset", { token: params.get("token"), password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <Logo />
      {done ? (
        <>
          <Alert kind="success">הסיסמה עודכנה. אפשר להתחבר באפליקציה.</Alert>
          <Link className="btn" to="/login">
            לכניסה
          </Link>
        </>
      ) : (
        <>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="field">
            <label>סיסמה חדשה</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
          </div>
          <button className="btn">עדכון סיסמה</button>
        </>
      )}
    </form>
  );
}

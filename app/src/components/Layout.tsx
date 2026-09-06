import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isEditor } from "@alon/shared";
import { useAuth } from "@/lib/auth";
import { APP_NAME } from "@/config";

const NAV = [
  { to: "/", label: "ראשי", ico: "🏠", end: true },
  { to: "/flashes", label: "מבזקים", ico: "⚡" },
  { to: "/events", label: "אירועים", ico: "📅" },
  { to: "/pinks", label: "ורודים", ico: "🌸", cls: "pinks" },
  { to: "/archive", label: "ארכיון", ico: "🗂️" },
];

export function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  return (
    <>
      <header className="app-header">
        {!isHome && (
          <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} aria-label="חזרה">
            →
          </button>
        )}
        <h1 className="title">
          {APP_NAME}
          {isHome && <span className="subtitle">העלון הדיגיטלי של קיבוץ נצר-סרני</span>}
        </h1>
        <button className="icon-btn" onClick={() => navigate("/search")} aria-label="חיפוש">
          🔍
        </button>
        {isEditor(user) && (
          <button className="icon-btn" onClick={() => navigate("/admin")} aria-label="ניהול">
            🛠️
          </button>
        )}
        <button className="icon-btn" onClick={() => navigate(user ? "/settings" : "/login")} aria-label={user ? "הגדרות" : "התחברות"}>
          {user ? "👤" : "🔑"}
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${n.cls ?? ""} ${isActive ? "active" : ""}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

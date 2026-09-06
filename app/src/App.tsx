import { useEffect, useState, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Browser } from "@capacitor/browser";
import { isAdmin, isEditor, type PushData } from "@alon/shared";
import { AuthProvider, useAuth } from "@/lib/auth";
import { initPush, onForegroundNotification, onNotificationOpen, syncDeviceUser } from "@/lib/push";
import { Layout } from "@/components/Layout";
import { Spinner, Toast } from "@/components/ui";
import { Home } from "@/pages/Home";
import { Section } from "@/pages/Section";
import { ItemPage } from "@/pages/Article";
import { Archive, Events, Flashes, Pinks } from "@/pages/Lists";
import { Search } from "@/pages/Search";
import { Forgot, Login, Register, Reset } from "@/pages/Auth";
import { Settings } from "@/pages/Settings";
import { AdminHome } from "@/admin/AdminHome";
import { ContentList } from "@/admin/ContentList";
import { ContentForm } from "@/admin/ContentForm";
import { Users } from "@/admin/Users";
import { Notify } from "@/admin/Notify";

function routeForPush(data: PushData): string | null {
  if (data.kind === "content" && data.type && data.id) {
    const map: Record<string, string> = { article: "/article/", event: "/event/", greeting: "/greeting/", issue: "/issue/", flash: "/flashes" };
    const base = map[data.type];
    if (!base) return "/";
    return base.endsWith("/") ? `${base}${data.id}` : base;
  }
  return null;
}

function Guard({ level, children }: { level: "user" | "editor" | "admin"; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (level === "editor" && !isEditor(user)) return <Navigate to="/" replace />;
  if (level === "admin" && !isAdmin(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NativeBridge() {
  const navigate = useNavigate();
  const { ready } = useAuth();
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: "#1f6b3a" }).catch(() => undefined);
      StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      SplashScreen.hide().catch(() => undefined);
      // Android hardware back button: go back in history, exit on the home screen.
      const back = CapApp.addListener("backButton", ({ canGoBack }) => {
        if (window.location.hash === "#/" || !canGoBack) CapApp.exitApp();
        else window.history.back();
      });
      const links = CapApp.addListener("appUrlOpen", ({ url }) => {
        const m = /^alonetzer:\/\/(.*)$/.exec(url);
        if (m) navigate(`/${m[1].replace(/^\/+/, "")}`);
      });
      onNotificationOpen(async (data) => {
        const route = routeForPush(data);
        if (route) navigate(route);
        else if (data.url) await Browser.open({ url: data.url });
      });
      onForegroundNotification((n) => setToast({ title: n.title ?? "עדכון חדש", body: n.body }));
      initPush().then((res) => {
        if (res === "granted") void syncDeviceUser();
      });
      return () => {
        back.then((h) => h.remove());
        links.then((h) => h.remove());
      };
    }
  }, [ready, navigate]);

  return toast ? <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} /> : null;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <NativeBridge />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/section/:key" element={<Section />} />
            <Route path="/article/:id" element={<ItemPage type="article" />} />
            <Route path="/event/:id" element={<ItemPage type="event" />} />
            <Route path="/greeting/:id" element={<ItemPage type="greeting" />} />
            <Route path="/issue/:id" element={<ItemPage type="issue" />} />
            <Route path="/flashes" element={<Flashes />} />
            <Route path="/events" element={<Events />} />
            <Route path="/pinks" element={<Pinks />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route
              path="/admin"
              element={
                <Guard level="editor">
                  <AdminHome />
                </Guard>
              }
            />
            <Route
              path="/admin/content/:type"
              element={
                <Guard level="editor">
                  <ContentList />
                </Guard>
              }
            />
            <Route
              path="/admin/content/:type/:id"
              element={
                <Guard level="editor">
                  <ContentForm />
                </Guard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <Guard level="admin">
                  <Users />
                </Guard>
              }
            />
            <Route
              path="/admin/notify"
              element={
                <Guard level="editor">
                  <Notify />
                </Guard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

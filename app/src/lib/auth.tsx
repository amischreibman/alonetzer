// Session state shared by every screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@alon/shared";
import { get, post, put, setToken, loadToken, HttpError } from "@/lib/http";
import { loadServerUrl } from "@/config";
import { clearCache } from "@/lib/api";
import { syncDeviceUser } from "@/lib/push";

interface AuthState {
  user: User | null;
  ready: boolean;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: { full_name?: string; phone?: string; password?: string; current_password?: string }) => Promise<User>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const res = await get<{ user: User }>("/api/auth/me");
      setUser(res.user);
      return res.user;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        await setToken(null);
        setUser(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadServerUrl();
      const token = await loadToken();
      if (token) await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ token: string; user: User }>("/api/auth/login", { email, password, device: navigator.userAgent });
    await setToken(res.token);
    setUser(res.user);
    await clearCache();
    void syncDeviceUser();
    return res.user;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, phone?: string) => {
    const res = await post<{ token: string; user: User }>("/api/auth/register", { email, password, full_name: fullName, phone, device: navigator.userAgent });
    await setToken(res.token);
    setUser(res.user);
    void syncDeviceUser();
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await post("/api/auth/logout");
    } catch {
      /* offline logout is fine */
    }
    await setToken(null);
    setUser(null);
    await clearCache();
    void syncDeviceUser();
  }, []);

  const updateProfile = useCallback(async (patch: { full_name?: string; phone?: string; password?: string; current_password?: string }) => {
    const res = await put<{ user: User }>("/api/auth/me", patch);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(() => ({ user, ready, refresh, login, register, logout, updateProfile }), [user, ready, refresh, login, register, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

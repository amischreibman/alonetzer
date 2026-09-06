// Re-run a loader whenever the app returns to the foreground so content is
// fresh on every visit, without a manual refresh.
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export function useAppResume(fn: () => unknown): void {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handle = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) fn();
      });
      return () => {
        handle.then((h) => h.remove());
      };
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") fn();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fn]);
}

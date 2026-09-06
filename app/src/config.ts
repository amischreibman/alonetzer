// Runtime configuration. The server URL comes from the Vite env at build time
// and can be overridden on the device from the settings screen.
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const CONFIG_KEY = "alon.serverUrl";

// In the browser build (served by the server itself) default to the same origin.
export const DEFAULT_SERVER_URL =
  (import.meta.env.VITE_SERVER_URL ?? "").replace(/\/$/, "") || (!Capacitor.isNativePlatform() && typeof window !== "undefined" ? window.location.origin : "");

let serverUrl = DEFAULT_SERVER_URL;

export function getServerUrl(): string {
  return serverUrl;
}

export async function loadServerUrl(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: CONFIG_KEY });
    if (value) serverUrl = value.replace(/\/$/, "");
  } catch {
    /* keep default */
  }
  return serverUrl;
}

export async function saveServerUrl(url: string): Promise<string> {
  const clean = url.trim().replace(/\/$/, "");
  if (clean) await Preferences.set({ key: CONFIG_KEY, value: clean });
  else await Preferences.remove({ key: CONFIG_KEY });
  serverUrl = clean || DEFAULT_SERVER_URL;
  return serverUrl;
}

/** Custom URL scheme handled by the app (notification taps, links). */
export const DEEP_LINK_SCHEME = "alonetzer";
export const APP_NAME = "עלון נצר-סרני";

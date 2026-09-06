import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "il.org.netzer.alon",
  appName: "עלון נצר-סרני",
  webDir: "dist",
  android: {
    // Allow http for local development servers only; production uses https.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#1f6b3a",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

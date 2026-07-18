import { registerSW } from "virtual:pwa-register";

/** How often to poll for a new service worker while the app is open. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Registers the PWA service worker with auto-update + reload, and checks for
 * updates on an interval and whenever the app returns to the foreground
 * (important for installed mobile PWAs that stay suspended).
 */
export function registerPWA(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdates = async () => {
        if (registration.installing || !navigator.onLine) return;

        try {
          const resp = await fetch(swUrl, {
            cache: "no-store",
            headers: {
              cache: "no-store",
              "cache-control": "no-cache",
            },
          });

          if (resp.status === 200) {
            await registration.update();
          }
        } catch {
          // Network errors are expected when offline.
        }
      };

      window.setInterval(() => {
        void checkForUpdates();
      }, CHECK_INTERVAL_MS);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void checkForUpdates();
        }
      });

      window.addEventListener("focus", () => {
        void checkForUpdates();
      });
    },
  });
}

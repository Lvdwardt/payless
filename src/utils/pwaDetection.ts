/**
 * Simple utility to detect if a PWA is installed
 */

export const isPWAInstalled = (): boolean => {
  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // Check for iOS Safari standalone mode
  if (
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  ) {
    return true;
  }

  return false;
};

export const isPWAInstallable = (): boolean => {
  // Check if PWA is already installed
  if (isPWAInstalled()) {
    return false;
  }

  // Check for install prompt support
  return "serviceWorker" in navigator && "PushManager" in window;
};

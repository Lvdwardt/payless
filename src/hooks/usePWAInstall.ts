import { useState, useEffect } from "react";
import {
  isAppleMobile,
  isAppleDesktop,
  isAndroid,
  isAndroidFallback,
  getDeviceFormFactor,
  isStandalone,
  isRelatedAppsInstalled,
  setStorageFlag,
  getStorageFlag,
  triggerInstalledSuccessEvent,
  triggerInstalledFailEvent,
  triggerInstallAvailableEvent,
  triggerInstallHowToEvent,
  triggerGalleryEvent,
} from "../utils/pwaUtils";
import { PWAInstallState, BeforeInstallPromptEvent } from "../types/pwa";
import i18n from "@/i18n";

export const usePWAInstall = () => {
  const [state, setState] = useState<PWAInstallState>({
    isInstalled: false,
    isStandalone: false,
    isInstallable: false,
    isAppleMobile: false,
    isAppleDesktop: false,
    isAndroid: false,
    isAndroidFallback: false,
    deviceFormFactor: "narrow",
    relatedAppsInstalled: false,
    isLoading: true,
    error: undefined,
  });
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const checkPWAStatus = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

        // Check if PWA is already installed (standalone mode)
        const standalone = isStandalone();

        // Check device types
        const appleMobile = isAppleMobile();
        const appleDesktop = isAppleDesktop();
        const android = isAndroid();
        const androidFallback = isAndroidFallback();

        // Check device form factor
        const deviceFormFactor = getDeviceFormFactor();

        // Check if related apps are installed
        const relatedAppsInstalled = await isRelatedAppsInstalled();

        // Determine if PWA is installable
        // This is a simplified check - you might want to enhance this
        const installable =
          !standalone &&
          (android ||
            appleMobile ||
            appleDesktop ||
            ("serviceWorker" in navigator && "PushManager" in window));

        // Determine if PWA is installed
        const installed = standalone || relatedAppsInstalled;

        setState({
          isInstalled: installed,
          isStandalone: standalone,
          isInstallable: installable,
          isAppleMobile: appleMobile,
          isAppleDesktop: appleDesktop,
          isAndroid: android,
          isAndroidFallback: androidFallback,
          deviceFormFactor,
          relatedAppsInstalled,
          isLoading: false,
          error: undefined,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        }));
      }
    };

    checkPWAStatus();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      checkPWAStatus();
    };

    mediaQuery.addEventListener("change", handleDisplayModeChange);

    // Listen for orientation changes
    const orientationMediaQuery = window.matchMedia("(orientation: portrait)");
    const handleOrientationChange = () => {
      setState((prev) => ({
        ...prev,
        deviceFormFactor: getDeviceFormFactor(),
      }));
    };

    orientationMediaQuery.addEventListener("change", handleOrientationChange);

    return () => {
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
      orientationMediaQuery.removeEventListener(
        "change",
        handleOrientationChange
      );
    };
  }, []);

  // Capture beforeinstallprompt for Chromium browsers
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState((prev) => ({ ...prev, isInstallable: true }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const requestInstall = async (): Promise<void> => {
    setIsInstalling(true);
    try {
      if (deferredPrompt) {
        triggerInstallAvailableEvent(document.body);
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          triggerInstalledSuccessEvent(document.body);
        } else {
          triggerInstalledFailEvent(document.body);
        }
        setDeferredPrompt(null);
      } else {
        // Fallback instructions per platform
        if (state.isAppleMobile) {
          alert(i18n.t("install.ios.instructions"));
        } else if (state.isAppleDesktop) {
          alert(i18n.t("install.macos.instructions"));
        } else if (state.isAndroid) {
          alert(i18n.t("install.android.instructions"));
        } else {
          alert(i18n.t("install.generic.instructions"));
        }
        triggerInstallHowToEvent(document.body);
      }
    } catch (error) {
      console.error("Install failed:", error);
      alert(i18n.t("install.failed"));
    } finally {
      setIsInstalling(false);
    }
  };

  // Helper functions for common PWA operations
  const setInstallFlag = (value: boolean, persistent: boolean = false) => {
    setStorageFlag("pwa-installed", value, persistent);
  };

  const getInstallFlag = () => {
    return getStorageFlag("pwa-installed");
  };

  const triggerInstallEvent = (
    element: Element,
    eventType: "success" | "fail" | "available" | "how-to" | "gallery"
  ) => {
    switch (eventType) {
      case "success":
        triggerInstalledSuccessEvent(element);
        break;
      case "fail":
        triggerInstalledFailEvent(element);
        break;
      case "available":
        triggerInstallAvailableEvent(element);
        break;
      case "how-to":
        triggerInstallHowToEvent(element);
        break;
      case "gallery":
        triggerGalleryEvent(element);
        break;
    }
  };

  return {
    ...state,
    setInstallFlag,
    getInstallFlag,
    triggerInstallEvent,
    requestInstall,
    isInstalling,
  };
};

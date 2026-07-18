import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { BeforeInstallPromptEvent } from "../types/pwa";
import { useTranslation } from "react-i18next";

export const InstallDialog = () => {
  const { t } = useTranslation();
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const {
    isInstalled,
    isInstallable,
    isAppleMobile,
    isAppleDesktop,
    isAndroid,
  } = usePWAInstall();
  const installButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkInstallStatus = () => {
      // Show install screen if not installed but installable
      setShowInstall(!isInstalled && isInstallable);
    };

    checkInstallStatus();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = () => checkInstallStatus();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isInstalled, isInstallable]);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);

    try {
      if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
          console.log("User accepted the install prompt");
          setShowInstall(false);
        } else {
          console.log("User dismissed the install prompt");
        }

        // Clear the deferredPrompt so it can only be used once
        setDeferredPrompt(null);
      } else {
        // Fallback for browsers that don't support beforeinstallprompt
        if (isAppleMobile) {
          // iOS Safari instructions
          alert(t("install.ios.instructions"));
        } else if (isAppleDesktop) {
          // macOS Safari instructions
          alert(t("install.macos.instructions"));
        } else if (isAndroid) {
          // Android Chrome instructions
          alert(t("install.android.instructions"));
        } else {
          // Generic instructions
          alert(t("install.generic.instructions"));
        }
      }
    } catch (error) {
      console.error("Install failed:", error);
      alert(t("install.failed"));
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={showInstall} onOpenChange={setShowInstall}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("install.title")}</DialogTitle>
          <DialogDescription>{t("install.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-2">
          <Button
            ref={installButtonRef}
            onClick={handleInstall}
            className="w-full"
            disabled={isInstalling}
          >
            {isInstalling ? t("install.installing") : t("install.button")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowInstall(false)}
            className="w-full"
            disabled={isInstalling}
          >
            {t("install.later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

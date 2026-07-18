import { useEffect, useState } from "react";
import { BeforeInstallPromptEvent } from "@/types";
import useLocalStorageState from "use-local-storage-state";

export default function usePwa() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isInstalled, setIsInstalled] = useLocalStorageState("isInstalled", {
    defaultValue: false,
  });

  const [pwaCheckLoading, setLoading] = useState(true);
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      console.log("PWA is supported");
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    window.addEventListener(
      "beforeinstallprompt",
      handler as EventListenerOrEventListenerObject
    );

    setLoading(false);

    return () =>
      window.removeEventListener("transitionend", handler as EventListener);
  }, []);

  const onClick = (evt: { preventDefault: () => void }) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }

    promptInstall.prompt().then((result) => {
      // @ts-expect-error this is not in the typescript definition
      if (result.outcome === "accepted") {
        console.log("User accepted the install prompt");
        setIsInstalled(true);
      } else {
        console.log("User dismissed the install prompt");
      }
    });
  };

  return { pwaCheckLoading, supportsPWA, onClick };
}

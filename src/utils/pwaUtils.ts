import { IRelatedApp } from "@/types/pwa";

const eventDispatcher = (element: Element, name: string, message: string) => {
  const event = new CustomEvent(name, {
    detail: {
      message,
    },
  });
  element.dispatchEvent(event);
};

// Device detection functions
export const isAppleMobile = (): boolean => {
  if (
    (["iPhone", "iPad", "iPod"].includes(navigator.platform) ||
      (navigator.userAgent.match(/Mac/) &&
        navigator.maxTouchPoints &&
        navigator.maxTouchPoints > 2)) &&
    "serviceWorker" in navigator
  )
    return true;
  return false;
};

export const isAppleDesktop = (): boolean => {
  // check if it's a mac
  const userAgent = navigator.userAgent.toLowerCase();
  if (navigator.maxTouchPoints || !userAgent.match(/macintosh/)) return false;
  // check safari version >= 17
  const version = /version\/(\d{2})\./.exec(userAgent);
  if (!version || !version[1] || !(parseInt(version[1]) >= 17)) return false;
  // hacky way to detect Sonoma
  const audioCheck = document
    .createElement("audio")
    .canPlayType('audio/wav; codecs="1"')
    ? true
    : false;
  const webGLCheck = new OffscreenCanvas(1, 1).getContext("webgl")
    ? true
    : false;

  return audioCheck && webGLCheck;
};

export const isAndroid = (): boolean => {
  if (navigator.userAgent.toLowerCase().match(/android/)) return true;
  return false;
};

export const isAndroidFallback = (): boolean => {
  if (isAndroid() && !("BeforeInstallPromptEvent" in window)) return true;
  return false;
};

export const getDeviceFormFactor = (): "narrow" | "wide" => {
  return window.matchMedia("(orientation: portrait)").matches
    ? "narrow"
    : "wide";
};

export const isStandalone = (): boolean => {
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
    return true;
  return false;
};

// Related apps functions
export const getInstalledRelatedApps = async (): Promise<IRelatedApp[]> => {
  if ("getInstalledRelatedApps" in navigator)
    try {
      return await (
        navigator as Navigator & {
          getInstalledRelatedApps: () => Promise<IRelatedApp[]>;
        }
      )
        .getInstalledRelatedApps()
        .then((relatedApps: IRelatedApp[]) => {
          return relatedApps;
        });
    } catch {
      // Silently fail if API is not available
    }

  return [];
};

export const isRelatedAppsInstalled = async (): Promise<boolean> => {
  const relatedApps = await getInstalledRelatedApps();
  return relatedApps.length > 0;
};

// Storage functions
export const setStorageFlag = (
  name: string,
  value: boolean,
  persistent: boolean = false
): void => {
  try {
    if (persistent) localStorage.setItem(name, value.toString());
    else sessionStorage.setItem(name, value.toString());
  } catch {
    // Silently fail if storage is not available
  }
};

export const getStorageFlag = (name: string): boolean => {
  try {
    return (
      sessionStorage.getItem(name) === "true" ||
      localStorage.getItem(name) === "true"
    );
  } catch {
    return false;
  }
};

// Event functions
export const triggerInstalledSuccessEvent = (element: Element): void => {
  eventDispatcher(
    element,
    "pwa-install-success-event",
    "App install success (Chromium/Android only)"
  );
};

export const triggerInstalledFailEvent = (element: Element): void => {
  eventDispatcher(
    element,
    "pwa-install-fail-event",
    "App install failed (Chromium/Android only)"
  );
};

export const triggerUserChoiceResultEvent = (
  element: Element,
  message: string
): void => {
  eventDispatcher(element, "pwa-user-choice-result-event", message);
};

export const triggerInstallAvailableEvent = (element: Element): void => {
  eventDispatcher(
    element,
    "pwa-install-available-event",
    "App install available"
  );
};

export const triggerInstallHowToEvent = (element: Element): void => {
  eventDispatcher(
    element,
    "pwa-install-how-to-event",
    "App install instruction showed"
  );
};

export const triggerGalleryEvent = (element: Element): void => {
  eventDispatcher(
    element,
    "pwa-install-gallery-event",
    "App install gallery showed"
  );
};

// Manifest functions
interface ManifestAsset {
  src: string;
  sizes?: string;
  type?: string;
}

interface Manifest {
  icons?: ManifestAsset[];
  screenshots?: ManifestAsset[];
  short_name?: string;
  description?: string;
}

export const normalizeManifestAssetUrls = (
  manifest: Manifest,
  manifestUrl: string
): void => {
  const normalizedManifestUrl = new URL(manifestUrl, document.location.href);
  [...(manifest.icons || []), ...(manifest.screenshots || [])].forEach(
    (asset: ManifestAsset) => {
      asset.src = new URL(asset.src, normalizedManifestUrl).href;
    }
  );
};

interface ProcessedManifest {
  _manifest: Manifest;
  icon: string;
  name: string;
  description: string;
}

export const fetchAndProcessManifest = async (
  manifestUrl: string,
  icon: string,
  name: string,
  description: string
): Promise<ProcessedManifest> => {
  let _manifest: Manifest = { icons: [], screenshots: [] };
  let _json: Manifest | null = null;

  try {
    const _response = await fetch(manifestUrl);
    _json = await _response.json();
    if (!_response.ok || !_json || !Object.keys(_json))
      throw new Error("Manifest not found");
    normalizeManifestAssetUrls(_json, manifestUrl);
  } catch {
    // Silently fail if manifest cannot be fetched
  }

  icon =
    icon ||
    (_json?.icons?.length ? _json?.icons![0].src : _manifest.icons?.[0].src) ||
    "";
  name = name || (_json ? _json["short_name"] : _manifest["short_name"]) || "";
  description =
    description || _json?.description || _manifest.description || "";
  _manifest = _json || _manifest;

  return {
    _manifest,
    icon,
    name,
    description,
  };
};

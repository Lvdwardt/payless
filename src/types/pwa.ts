export interface IRelatedApp {
  id: string;
  platform: string;
  url?: string;
}

export interface Manifest {
  name?: string;
  short_name?: string;
  description?: string;
  icons?: Array<{
    src: string;
    sizes?: string;
    type?: string;
  }>;
  screenshots?: Array<{
    src: string;
    sizes?: string;
    type?: string;
  }>;
}

export interface PWAInstallState {
  isInstalled: boolean;
  isStandalone: boolean;
  isInstallable: boolean;
  isAppleMobile: boolean;
  isAppleDesktop: boolean;
  isAndroid: boolean;
  isAndroidFallback: boolean;
  deviceFormFactor: "narrow" | "wide";
  relatedAppsInstalled: boolean;
  isLoading: boolean;
  error?: string;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type Provider = {
  archiveUrl: string;
  info?: string;
  uploadNewUrl?: string;
};

export type Rules = {
  removeRules?: string[];
  alterRules?: {
    selector?: string;
    class?: string;
    style: string;
  }[];
  addRules?: {
    selector: string;
    class?: string;
    style: string;
  }[];
};

export type Site = {
  [key: string]: Rules;
};

export type MultipleSites = {
  sites: string[];
  rules: Rules;
};

export type Font = {
  scale: number;
  height?: number;
};

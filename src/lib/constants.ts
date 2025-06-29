// App-wide constants
export const COLORS = {
  PRIMARY: "#1f295b",
  ACCENT: "#A96CDA",
  WHITE: "#ffffff",
  GRAY_200: "#e5e7eb",
  INDIGO_500: "#6366f1",
} as const;

export const ARCHIVE_CONFIG = {
  BASE_URL: "https://archive.is/",
  DEFAULT_TIMEOUT: 5000,
} as const;

export const APP_CONFIG = {
  DEFAULT_FONT_SCALE: 1,
  FONT_SCALE_OPTIONS: Array.from(Array(7).keys()).map((i) => 0.5 + i * 0.25),
  DEFAULT_TIME_BEFORE_REDIRECT: 500,
} as const;

export const SELECTORS = {
  ARCHIVE_LINK: ".TEXT-BLOCK a",
} as const;

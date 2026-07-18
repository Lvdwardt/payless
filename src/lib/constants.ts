export const APP_CONFIG = {
  DEFAULT_FONT_SCALE: 1,
  FONT_SCALE_OPTIONS: Array.from(Array(7).keys()).map((i) => 0.5 + i * 0.25),
} as const;

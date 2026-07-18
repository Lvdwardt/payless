import { dpg } from "@/data/sites/multiple/dpg";

export type NativeSiteHints = {
  /** CSS selector for the element that should be handed to Readability. */
  rootSelector?: string;
  /** Selectors removed from a clone of the root before Readability runs. */
  removeSelectors?: string[];
};

const TELEGRAAF_HOST = "www.telegraaf.nl";
const TROUW_HOST = "www.trouw.nl";
const VOLKSKRANT_HOST = "www.volkskrant.nl";
const FT_HOST = "www.ft.com";

/** DPG-family hosts that share the `#article-content` article root
 * (regional AD titles + Trouw + Volkskrant). Verified per-host via fixtures. */
const dpgTemplateHosts: string[] = [
  ...dpg.sites,
  TROUW_HOST,
  VOLKSKRANT_HOST,
];

/** Hosts allowed to use native (v2) extraction. Keep this list narrow — a
 * host only belongs here once its extraction has been verified against a
 * captured fixture (see plans/fixtures/articles). */
export const nativeMigratedHosts: string[] = [
  ...dpgTemplateHosts,
  TELEGRAAF_HOST,
  FT_HOST,
];

const dpgHints: NativeSiteHints = {
  rootSelector: "#article-content",
  // Related-news cards and premium chrome live as siblings after this
  // marker, inside the same #article-content element.
  removeSelectors: [
    "#article-content-bottom ~ *",
    '[title*="nieuwsbrief"]',
    '[id^="sim_"]',
  ],
};

const telegraafHints: NativeSiteHints = {
  rootSelector: "#__next main, main",
};

/** FT keeps the headline in `#o-topper` and body in `#site-content`
 * (siblings under archive `#CONTENT`). Use full `#CONTENT` + strip chrome. */
const ftHints: NativeSiteHints = {
  removeSelectors: ["#site-navigation", "#site-footer"],
};

export function isNativeMigratedHost(host: string): boolean {
  return nativeMigratedHosts.includes(host);
}

export function getNativeSiteHints(host: string): NativeSiteHints | undefined {
  if (dpgTemplateHosts.includes(host)) {
    return dpgHints;
  }
  if (host === TELEGRAAF_HOST) {
    return telegraafHints;
  }
  if (host === FT_HOST) {
    return ftHints;
  }
  return undefined;
}

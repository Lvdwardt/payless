import { dpg } from "@/data/sites/multiple/dpg";

export type NativeSiteHints = {
  /** CSS selector for the element that should be handed to Readability. */
  rootSelector?: string;
  /** Selectors removed from a clone of the root before Readability runs. */
  removeSelectors?: string[];
  /** Headline element for publishers that don't mark it as `<h1>`. Promoted to
   * `<h1>` before extraction (see `promoteTitleHeading`). */
  titleSelector?: string;
  /** Byline element for publishers whose author link isn't an `/auteur/`-style
   * profile URL. Text is used verbatim, so point it at the name itself. */
  bylineSelector?: string;
};

const TELEGRAAF_HOST = "www.telegraaf.nl";
const TROUW_HOST = "www.trouw.nl";
const VOLKSKRANT_HOST = "www.volkskrant.nl";
const FT_HOST = "www.ft.com";
const QUOTE_HOST = "www.quotenet.nl";
const NT_HOST = "www.nt.nl";

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
  QUOTE_HOST,
  NT_HOST,
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

/** Quote (Hearst): article lives in `#main-content`; Piano paywall stub
 * and related "Lees ook" trail the body inside the same main. */
const quoteHints: NativeSiteHints = {
  rootSelector: "#main-content, main",
  removeSelectors: ["#piano-paywall-container"],
};

/** NT (Nieuwsblad Transport): the story is the first `<article>` under
 * `main#main` — the "Overig nieuws in …" trail and the "Meest gelezen" sidebar
 * are separate `article`/`aside` siblings in the same `main`. The headline is an
 * `<h2>` (no `<h1>` anywhere) and the byline is a bare `mailto:` link. */
const ntHints: NativeSiteHints = {
  // Single selector on purpose: `querySelector` picks the first match in
  // document order, not the first selector, so listing `main#main` as a
  // fallback here would always win over the article. No match falls back to
  // `#CONTENT` (see `extractNativeArticle`).
  rootSelector: "main#main article",
  // Guards the `#CONTENT` fallback path, where the related trail is in scope.
  removeSelectors: ['[id^="loop-related"]'],
  titleSelector: "header h2",
  bylineSelector: 'header a[href^="mailto:"] strong',
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
  if (host === QUOTE_HOST) {
    return quoteHints;
  }
  if (host === NT_HOST) {
    return ntHints;
  }
  return undefined;
}

import { Readability } from "@mozilla/readability";
import DOMPurify from "isomorphic-dompurify";
import parse from "node-html-parser";
import { getNativeSiteHints } from "@/data/nativeSites";
import type { NativeArticle, NativeArticleImage } from "@/types/article";

const MIN_CONTENT_LENGTH = 200;
const EMBED_PLACEHOLDER_TEXT = "Hier staat ingevoegde content";
const SHOW_TEXT = 4;

export type ExtractNativeArticleResult =
  | { status: "ok"; article: NativeArticle }
  | { status: "error"; message: string };

/**
 * Parses `html` into a real DOM Document. Vite ships `DOMParser` in the
 * browser bundle; `bun test` has no DOM, so it falls back to linkedom.
 */
async function parseHtmlDocument(html: string): Promise<Document> {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(html, "text/html");
  }

  const { parseHTML } = await import("linkedom");
  return parseHTML(html).document as unknown as Document;
}

/**
 * `document.baseURI` (used by Readability to resolve relative `<a>`/`<img>`
 * URIs) reflects a `<base>` element, so injecting one here lets Readability
 * resolve archive-relative paths (e.g. `/foo.jpg`) against `baseURL` itself.
 */
function ensureBaseHref(document: Document, baseURL: string) {
  if (document.querySelector("base")) return;
  const base = document.createElement("base");
  base.setAttribute("href", `${baseURL.replace(/\/$/, "")}/`);
  document.head?.appendChild(base);
}

/**
 * Telegraaf wraps hero images in `<button>` (lightbox). Readability drops
 * button contents, so unwrap before parsing.
 */
function unwrapImageButtons(root: Element) {
  for (const button of [...root.querySelectorAll("button")]) {
    if (!button.querySelector("img")) continue;
    const parent = button.parentNode;
    if (!parent) continue;
    while (button.firstChild) {
      parent.insertBefore(button.firstChild, button);
    }
    button.remove();
  }
}

/**
 * Drop related-article cards (linked thumbnail + headline) and other
 * thumbnail-sized images that aren't part of the story.
 */
function removeRelatedTeasers(root: Element) {
  for (const anchor of [...root.querySelectorAll("a")]) {
    if (!anchor.querySelector("img")) continue;
    const text = anchor.textContent?.replace(/\s+/g, " ").trim() || "";
    // Real body links around an image are short; teaser cards carry a headline.
    if (text.length < 30) continue;
    anchor.remove();
  }

  for (const img of [...root.querySelectorAll("img")]) {
    const sizes = img.getAttribute("sizes") || "";
    if (!sizes) continue;
    const hasLargeHint =
      /100vw/.test(sizes) || /\b([6-9]\d{2}|1\d{3})px\b/.test(sizes);
    const hasThumbHint = /\b(80|100|120)px\b/.test(sizes);
    if (!hasThumbHint || hasLargeHint) continue;
    const block =
      img.closest("figure") || img.closest("a") || img.parentElement || img;
    block.remove();
  }
}

function isLikelyLeadImage(img: Element): boolean {
  const src = img.getAttribute("src") || "";
  if (!src) return false;
  const sizes = img.getAttribute("sizes") || "";
  const alt = img.getAttribute("alt")?.trim() || "";
  const dims = readImageDimensions(img);
  // FT heroes often have empty alt but large min-width/min-height in archive CSS.
  const hasLargeDims = Boolean(
    dims && ((dims.width >= 400 && dims.height >= 280) || dims.width >= 640)
  );
  const hasLargeHint =
    /100vw/.test(sizes) || /\b([6-9]\d{2}|1\d{3})px\b/.test(sizes);
  const hasThumbHint = /\b(80|100|120)px\b/.test(sizes);
  if (hasThumbHint && !hasLargeHint && !hasLargeDims) return false;
  return hasLargeHint || hasLargeDims || alt.length >= 8;
}

function readImageDimensions(img: Element): { width: number; height: number } | null {
  const style = img.getAttribute("style") || "";
  const minW = parseFloat(style.match(/min-width:\s*([\d.]+)px/i)?.[1] || "");
  const minH = parseFloat(style.match(/min-height:\s*([\d.]+)px/i)?.[1] || "");
  const attrW = parseFloat(img.getAttribute("width") || "");
  const attrH = parseFloat(img.getAttribute("height") || "");
  const width = attrW || minW;
  const height = attrH || minH;
  if (!(width > 0 && height > 0)) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Keep width/height so the browser can reserve aspect-ratio space before the
 * image bytes arrive (avoids layout shift). Strip archive layout styles.
 */
function stabilizeImages(root: Element) {
  for (const img of root.querySelectorAll("img")) {
    const dims = readImageDimensions(img);
    img.removeAttribute("style");
    if (!dims) continue;
    img.setAttribute("width", String(dims.width));
    img.setAttribute("height", String(dims.height));
  }
}

/**
 * Readability often drops Telegraaf heroes (especially when they sit in
 * `<hgroup>` before the body). Capture a clean lead figure to re-inject.
 */
function captureLeadFigure(root: Element): string | null {
  const img = [...root.querySelectorAll("img")].find(isLikelyLeadImage);
  if (!img) return null;

  const src = img.getAttribute("src") || "";
  const alt = img.getAttribute("alt")?.trim() || "";
  const dims = readImageDimensions(img);
  const figure = img.closest("figure");

  let caption = "";
  if (figure) {
    for (const el of figure.querySelectorAll("figcaption, span, p")) {
      if (el.querySelector("img")) continue;
      const text = el.textContent?.replace(/\s+/g, " ").trim() || "";
      if (text.length >= 5) {
        caption = text;
        break;
      }
    }
  }
  if (!caption && alt) caption = alt;

  const dimAttrs = dims
    ? ` width="${dims.width}" height="${dims.height}"`
    : "";

  return `<figure data-payless-lead="true"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${dimAttrs} />${
    caption
      ? `<figcaption>${escapeHtml(caption)}</figcaption>`
      : ""
  }</figure>`;
}

function ensureLeadFigure(contentHtml: string, leadFigureHtml: string | null): string {
  if (!leadFigureHtml) return contentHtml;

  const srcMatch = leadFigureHtml.match(/\ssrc="([^"]+)"/);
  const src = srcMatch?.[1];
  if (!src) return contentHtml;

  const srcTail = src.split("/").pop() || src;
  if (contentHtml.includes(src) || contentHtml.includes(srcTail)) {
    return contentHtml;
  }

  return `${leadFigureHtml}${contentHtml}`;
}

/** True for DPG-style visually-hidden / screen-reader-only nodes
 * (`clip: rect(0,0,0,0); height: 1px; …`). Their text ("Dit artikel is
 * geschreven door", "Gepubliceerd op", …) must not leak into the body. */
function isVisuallyHidden(element: Element): boolean {
  const style = (element.getAttribute("style") || "").toLowerCase();
  return /clip:\s*rect\s*\(/.test(style) && /height:\s*1px/.test(style);
}

function removeVisuallyHidden(root: Element) {
  for (const element of [...root.querySelectorAll("*")]) {
    if (isVisuallyHidden(element)) {
      element.remove();
    }
  }
}

/**
 * Drop the DPG header byline cluster (author link + role + publish time +
 * share chrome). Byline is already captured separately; leaving this in the
 * DOM produces orphan lines like "correspondent Oost-Nederland".
 */
function removeAuthorMetaChrome(root: Element) {
  const author = root.querySelector(
    'a[rel="author"], a[href*="/auteur/"], a[href*="/author/"]'
  );
  if (!author) return;

  let best: Element | null = null;
  let node: Element | null = author;
  for (let depth = 0; depth < 8 && node; depth += 1) {
    const parent: Element | null = node.parentElement;
    if (!parent || parent === root) break;

    const text = parent.textContent?.replace(/\s+/g, " ").trim() || "";
    const hasHeading = Boolean(parent.querySelector("h1, h2"));
    const hasFigure = Boolean(parent.querySelector("figure"));
    const looksLikeMeta =
      text.length > 0 &&
      text.length < 280 &&
      !hasHeading &&
      !hasFigure &&
      (/Leestijd|Bewaren|Delen|Gepubliceerd|correspondent\b/i.test(text) ||
        Boolean(parent.querySelector("time")));

    if (looksLikeMeta) {
      best = parent;
    }
    node = parent;
  }

  best?.remove();
}

/** Removes elements whose own text is an embed-consent placeholder, e.g.
 * Mediahuis's "Hier staat ingevoegde content" social-embed stub. */
function removeEmbedPlaceholders(root: Element) {
  const ownerDocument = root.ownerDocument;
  if (!ownerDocument) return;

  const walker = ownerDocument.createTreeWalker(root, SHOW_TEXT);
  const toRemove: Element[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(EMBED_PLACEHOLDER_TEXT)) {
      const element = node.parentElement;
      if (element) toRemove.push(element);
    }
  }
  toRemove.forEach((element) => element.remove());
}

/** Defensive pass over the serialized Readability output: resolves any
 * root-relative `src`/`href`/`srcset` that Readability's own `<a>`/`<img>`
 * fixups didn't touch (e.g. `<source srcset>`).
 *
 * Path-absolute URLs (`/iqyNt/foo.avif`) resolve against the archive origin,
 * not a snapshot subpath — otherwise `baseURL=https://archive.is/iqyNt`
 * would produce `/iqyNt/iqyNt/...`. */
function rewriteRelativeUrls(html: string, baseURL: string): string {
  const base = baseURL.replace(/\/$/, "");
  let origin = base;
  try {
    origin = new URL(base).origin;
  } catch {
    // keep base
  }
  const root = parse(html);

  const absolutize = (value: string): string => {
    if (!value.startsWith("/")) return value;
    return `${origin}${value}`;
  };

  root.querySelectorAll("[src]").forEach((element) => {
    const src = element.getAttribute("src");
    if (src) element.setAttribute("src", absolutize(src));
  });

  root.querySelectorAll("[href]").forEach((element) => {
    const href = element.getAttribute("href");
    if (href) element.setAttribute("href", absolutize(href));
  });

  root.querySelectorAll("[srcset]").forEach((element) => {
    const srcset = element.getAttribute("srcset");
    if (!srcset) return;
    const rewritten = srcset
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed.startsWith("/")) return trimmed;
        // srcset entries are "url [descriptor]"
        const [url, ...rest] = trimmed.split(/\s+/);
        return [absolutize(url), ...rest].join(" ");
      })
      .join(", ");
    element.setAttribute("srcset", rewritten);
  });

  return root.toString();
}

function collectImages(html: string): NativeArticleImage[] {
  const root = parse(html);
  return root.querySelectorAll("img").map((img) => ({
    src: img.getAttribute("src") || "",
    alt: img.getAttribute("alt") || undefined,
  }));
}

const AUTHOR_SELECTORS = [
  'a[rel="author"]',
  'a[href*="/auteur/"]',
  'a[href*="/author/"]',
  '[itemprop="author"]',
  '[rel="author"]',
];

/** Multi-segment FT hubs that look like author slugs (`life-arts`, …). */
const FT_SECTION_SLUGS = new Set([
  "life-arts",
  "work-careers",
  "how-to-spend-it",
  "ft-weekend",
  "ft-money",
  "moral-money",
  "climate-capital",
]);

const CHROME_BYLINE =
  /^(accessibility(\s+help)?|cookie(s)?|subscribe|sign in|help|share on\b|lunch with\b|life & arts|how to spend it)\b/i;

function looksLikePersonName(text: string): boolean {
  // "Roula Khalaf", "Jo Ellison", "Marjolein van de Water"
  return /^[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*(?:\s+[a-zà-öø-ÿ]+)*\s+[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*$/u.test(
    text
  );
}

/**
 * FT profile URLs look like `www.ft.com/roula-khalaf` (not `/author/…`).
 * Require a hyphenated person slug so section hubs (`style`, `htsi`) are skipped.
 */
function extractFtByline(root: Element): string | undefined {
  let fallback: string | undefined;

  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") || "";
    const match = href.match(
      /https?:\/\/(?:www\.)?ft\.com\/([a-z0-9-]+)(?:[/?#]|$)/i
    );
    if (!match) continue;

    const slug = match[1].toLowerCase();
    // Authors: firstname-lastname (+ optional particle). Skip section hubs.
    if (!/^[a-z]+(?:-[a-z]+){1,3}$/.test(slug)) continue;
    if (FT_SECTION_SLUGS.has(slug)) continue;
    if (/(?:-with-the-ft|podcast|newsletter|accessibility)$/i.test(slug)) {
      continue;
    }

    const text = anchor.textContent
      ?.replace(/\(opens a new window\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length < 2 || text.length > 80) continue;
    if (CHROME_BYLINE.test(text) || !looksLikePersonName(text)) continue;

    const nearTime = Boolean(
      anchor.parentElement?.querySelector("time") ||
        anchor.parentElement?.parentElement?.querySelector("time")
    );
    if (nearTime) return text;
    fallback ??= text;
  }

  return fallback;
}

/** Best-effort byline from publisher markup Readability often misses. */
function extractByline(root: Element): string | undefined {
  for (const selector of AUTHOR_SELECTORS) {
    const element = root.querySelector(selector);
    const text = element?.textContent?.replace(/\s+/g, " ").trim();
    if (
      text &&
      text.length >= 2 &&
      text.length <= 80 &&
      !CHROME_BYLINE.test(text)
    ) {
      return text;
    }
  }
  return extractFtByline(root);
}

/**
 * Prefer a real article `<h1>` over truncated social titles (og/twitter often
 * end in `…` on DPG). Also drop those meta tags so Readability can't re-pick them.
 */
function stripPublisherTitleSuffix(title: string): string {
  return title
    .replace(/\s*\|\s*Financial Times\s*$/i, "")
    .replace(/\s*\|\s*de Volkskrant\s*$/i, "")
    .replace(/\s*\|\s*Trouw\s*$/i, "")
    .replace(/\s*\|\s*AD\.nl\s*$/i, "")
    .trim();
}

function preferArticleTitle(
  parsedTitle: string | null | undefined,
  headingTitle: string
): string {
  const parsed = stripPublisherTitleSuffix(
    parsedTitle?.replace(/\s+/g, " ").trim() || ""
  );
  const heading = stripPublisherTitleSuffix(
    headingTitle.replace(/\s+/g, " ").trim()
  );

  if (!heading) return parsed;
  if (!parsed) return heading;

  const truncated =
    /…$/.test(parsed) ||
    /\.\.\.$/.test(parsed) ||
    (heading.startsWith(parsed.replace(/…$/, "").replace(/\.\.\.$/, "").trim()) &&
      heading.length > parsed.length);

  if (truncated || heading.length > parsed.length + 10) {
    return heading;
  }

  return parsed;
}

function stripTruncatedSocialTitles(document: Document) {
  document
    .querySelectorAll(
      'meta[property="og:title"], meta[name="twitter:title"], meta[property="twitter:title"]'
    )
    .forEach((element) => {
      const content = element.getAttribute("content") || "";
      if (/…$/.test(content) || /\.\.\.$/.test(content)) {
        element.remove();
      }
    });
}

const CHROME_HEADING =
  /^(lees meer|meer lezen|leestips|gerelateerd|gerelateerde artikelen|volg .+ op sociale media|volg ons( op sociale media)?|promoted content|follow the topics in this article|comment guidelines|latest from .+)$/i;

/**
 * Drop end-of-article promo blocks ("Lees meer", "Volg … op sociale media")
 * and everything after the first matching heading.
 */
function removeChromeTail(root: ReturnType<typeof parse>) {
  const headings = root.querySelectorAll("h2, h3");
  for (const heading of headings) {
    const text = heading.textContent.replace(/\s+/g, " ").trim();
    if (!CHROME_HEADING.test(text)) continue;

    let block = heading;
    let parent = heading.parentNode;
    while (
      parent &&
      parent !== root &&
      "rawTagName" in parent &&
      parent.rawTagName !== "article" &&
      parent.childNodes.filter(
        (node) => "rawTagName" in node && Boolean(node.rawTagName)
      ).length <= 5
    ) {
      const parentText = parent.textContent.replace(/\s+/g, " ").trim();
      if (parentText.length > text.length + 40) break;
      block = parent as typeof heading;
      parent = parent.parentNode;
    }

    let sibling = block.nextElementSibling;
    block.remove();
    while (sibling) {
      const next = sibling.nextElementSibling;
      sibling.remove();
      sibling = next;
    }
    break;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * DPG (and similar) leave the author photo + "Schrijft over …" bio but drop
 * the visible name link. Re-insert the byline next to that bio block.
 */
function injectAuthorNameIntoBio(
  root: ReturnType<typeof parse>,
  byline: string | undefined
) {
  if (!byline) return;

  const authorImg = root
    .querySelectorAll("img")
    .find((img) => img.getAttribute("alt")?.trim() === byline);
  if (!authorImg) return;

  let cluster = authorImg.parentNode;
  for (let depth = 0; depth < 6 && cluster; depth += 1) {
    const text = cluster.textContent.replace(/\s+/g, " ").trim();
    if (/Schrijft over\b|Writes about\b/i.test(text)) break;
    cluster = cluster.parentNode;
  }
  if (!cluster || !("querySelectorAll" in cluster)) return;

  // Skip if the name is already visible as real text (not only img alt).
  const hasVisibleName = [...cluster.querySelectorAll("a, p, span, strong")].some(
    (el) => {
      if (el.querySelector("img")) return false;
      return el.textContent.replace(/\s+/g, " ").trim() === byline;
    }
  );
  if (hasVisibleName) return;

  const bio = [...cluster.querySelectorAll("p, span")].find((el) =>
    /^(Schrijft over|Writes about)\b/i.test(
      el.textContent.replace(/\s+/g, " ").trim()
    )
  );
  if (!bio) return;

  const bioBlock =
    bio.rawTagName === "span" && bio.parentNode?.rawTagName === "p"
      ? bio.parentNode
      : bio;

  if (!("setAttribute" in cluster)) return;
  cluster.setAttribute("data-payless-author", "true");

  const meta = parse(
    `<div data-payless-author-meta="true"><p data-payless-author-name="true"><strong>${escapeHtml(byline)}</strong></p></div>`
  ).querySelector("div");
  if (!meta) return;

  bioBlock.before(meta);
  meta.appendChild(bioBlock);
}

/** Drop empty placeholders Readability leaves behind (extra whitespace). */
function removeEmptyNodes(root: ReturnType<typeof parse>) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const el of root.querySelectorAll("span, section, div, p")) {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const hasMedia = Boolean(
        el.querySelector("img, picture, video, iframe, svg, figure")
      );
      if (text || hasMedia) continue;
      el.remove();
      changed = true;
    }
  }
}

/** Cookie / social-embed consent stubs left in archive HTML. */
function removeCookiePlaceholders(root: ReturnType<typeof parse>) {
  const pattern =
    /cookies voor sociale media uitgeschakeld|toestemming geven voor deze cookies|hier toestemming geven/i;

  root.querySelectorAll("p, div, span").forEach((el) => {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!pattern.test(text)) return;
    if (text.length > 300) return;
    const block = el.closest("div") || el;
    // Prefer removing a small wrapper, not the whole article.
    if (
      block !== root &&
      block.textContent.replace(/\s+/g, " ").trim().length < 400
    ) {
      block.remove();
    } else {
      el.remove();
    }
  });
}

/** "Maak ons je Google-favoriet" and similar publisher promo links. */
function removePromoLinks(root: ReturnType<typeof parse>) {
  root.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    const text = anchor.textContent.replace(/\s+/g, " ").trim();
    const isGoogleFavorite =
      /google\.com\/preferences\/source/i.test(href) ||
      /google-favoriet|google favoriet/i.test(text) ||
      /^maak ons je google/i.test(text);

    if (!isGoogleFavorite) return;

    const block =
      anchor.closest("p") ||
      anchor.closest("div") ||
      anchor;
    block.remove();
  });
}

/**
 * DPG often wraps mid-sentence links in their own block. Readability then
 * emits `</p><a>…</a><p>…`, which renders as a lone linked word + gap.
 * Merge those sandwich splits back into one paragraph.
 */
function mergeSplitInlineAnchors(root: ReturnType<typeof parse>) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const anchor of root.querySelectorAll("a")) {
      const prev = anchor.previousElementSibling;
      const next = anchor.nextElementSibling;
      if (!prev || !next) continue;
      if (prev.rawTagName !== "p" || next.rawTagName !== "p") continue;

      const linkText = anchor.textContent.replace(/\s+/g, " ").trim();
      // Only repair short mid-sentence fragments, not standalone CTAs.
      if (!linkText || linkText.length > 48) continue;

      prev.appendChild(anchor);
      while (next.childNodes.length > 0) {
        prev.appendChild(next.childNodes[0]);
      }
      next.remove();
      changed = true;
      break;
    }
  }
}

const NEWSLETTER_CTA =
  /(?:for the best of .+ straight into your inbox|sign\s*up to our\s*newsletter|aanmelden voor (de )?nieuwsbrief|de volkskrant ochtend)/i;

/** Newsletter / "Ochtend" signup iframes and stubs from DPG / FT archives. */
function removeNewsletterBlocks(root: ReturnType<typeof parse>) {
  root.querySelectorAll("[id], [title]").forEach((el) => {
    const id = el.getAttribute("id") || "";
    const title = el.getAttribute("title") || "";
    if (/^sim_/i.test(id) || /nieuwsbrief/i.test(title)) {
      el.remove();
    }
  });

  // FT often ends with a newsletter CTA linking to /newsletters.
  root.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    const linkText = anchor.textContent.replace(/\s+/g, " ").trim();
    const isNewsletterLink =
      /ft\.com\/newsletters/i.test(href) ||
      /\/newsletters\/?/i.test(href) ||
      /^ft\.com\/newsletters$/i.test(linkText);

    if (!isNewsletterLink) return;

    let block: typeof anchor | null = anchor;
    for (let depth = 0; depth < 6 && block; depth += 1) {
      const parent = block.parentNode;
      if (!parent || !("rawTagName" in parent) || !parent.rawTagName) break;
      const parentText = parent.textContent.replace(/\s+/g, " ").trim();
      if (parentText.length < 450 && NEWSLETTER_CTA.test(parentText)) {
        block = parent as typeof anchor;
        continue;
      }
      // Prefer removing the enclosing <p> even when the CTA regex is picky.
      if (
        parent.rawTagName === "p" &&
        parentText.length < 450 &&
        /newsletter|nieuwsbrief/i.test(parentText)
      ) {
        block = parent as typeof anchor;
        continue;
      }
      break;
    }
    block?.remove();
  });

  root.querySelectorAll("h2, h3, div, aside, section, p, span").forEach((el) => {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (NEWSLETTER_CTA.test(text) && text.length < 450) {
      el.remove();
    }
  });
}

/**
 * FT "Lunch with the FT" bill cards survive as a small div of priced lines.
 * Mark them so the native reader can style them as asides.
 */
function markMenuAsides(root: ReturnType<typeof parse>) {
  root.querySelectorAll("div").forEach((el) => {
    if (el.getAttribute("data-payless-aside")) return;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (text.length < 40 || text.length > 1200) return;
    if (el.querySelectorAll("div").length > 2) return;

    const priceCount = (text.match(/\$\d/g) || []).length;
    if (priceCount < 3) return;
    if (!/\bTotal\b/i.test(text) && !/\binc(?:\s+|-)tax\b/i.test(text)) return;

    el.setAttribute("data-payless-aside", "menu");
  });
}

/** Remove decorative caption markers / premium chrome SVGs from body HTML. */
function cleanExtractedHtml(
  html: string,
  byline: string | undefined
): string {
  const root = parse(html);

  root.querySelectorAll("figcaption svg").forEach((element) => element.remove());
  root
    .querySelectorAll(
      'svg[aria-label*="Premium" i], svg[aria-label*="premium" i]'
    )
    .forEach((element) => element.remove());

  root.querySelectorAll("figcaption span").forEach((span) => {
    const text = span.textContent?.replace(/\s+/g, " ").trim() || "";
    if (!text && !span.querySelector("img")) {
      span.remove();
    }
  });

  removePromoLinks(root);
  removeCookiePlaceholders(root);
  removeNewsletterBlocks(root);
  removeChromeTail(root);
  mergeSplitInlineAnchors(root);
  markMenuAsides(root);

  // FT archive link labels append this accessibility suffix.
  root.querySelectorAll("a").forEach((anchor) => {
    const html = anchor.innerHTML;
    if (!/\(opens a new window\)/i.test(html) && !/\(opens a new window\)/i.test(anchor.textContent)) {
      return;
    }
    anchor.innerHTML = html.replace(/\s*\(opens a new window\)/gi, "");
  });

  // Belt-and-suspenders if a clipped label still survives Readability.
  root.querySelectorAll("p, span, div").forEach((el) => {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (/^Dit artikel is geschreven door\.?$/i.test(text)) {
      el.remove();
    }
  });

  removeEmptyNodes(root);
  injectAuthorNameIntoBio(root, byline);

  return root.toString();
}

function normalizeWhitespace(html: string): string {
  // Gotham draws NBSP ~450px wide — always use a normal space instead.
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00A0/g, " ");
}

/**
 * Extracts a structured, Reader Mode–style article from archive HTML.
 * Pure — does not fetch. `host` selects optional per-site extraction hints
 * (see `@/data/nativeSites`); `baseURL` resolves archive-relative asset URLs.
 */
export async function extractNativeArticle(
  html: string,
  { host, baseURL }: { host: string; baseURL: string }
): Promise<ExtractNativeArticleResult> {
  let document: Document;
  try {
    document = await parseHtmlDocument(html);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not parse archived HTML.",
    };
  }

  const content = document.querySelector("#CONTENT");
  if (!content) {
    return {
      status: "error",
      message: "Archived article content was not found.",
    };
  }

  const hints = getNativeSiteHints(host);
  const root =
    (hints?.rootSelector && content.querySelector(hints.rootSelector)) ||
    content;

  const clone = root.cloneNode(true) as HTMLElement;

  hints?.removeSelectors?.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((element) => element.remove());
  });

  unwrapImageButtons(clone);
  removeRelatedTeasers(clone);
  // Capture lead dims from archive min-width/min-height styles first…
  const leadFigureHtml = captureLeadFigure(clone);
  // …then normalize images so width/height survive Readability for CLS.
  stabilizeImages(clone);
  removeEmbedPlaceholders(clone);
  removeVisuallyHidden(clone);

  const headingTitle =
    clone.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
  // Capture byline before stripping the DPG author/date chrome cluster.
  const hintByline = extractByline(clone);
  removeAuthorMetaChrome(clone);

  ensureBaseHref(document, baseURL);
  // Clear the archive page's <title> so Readability's title heuristic
  // falls back to the article's own <h1> instead of unrelated page chrome.
  document.title = "";
  stripTruncatedSocialTitles(document);
  if (!document.body) {
    return {
      status: "error",
      message: "Archived document has no body to extract from.",
    };
  }
  document.body.replaceChildren(clone);

  let parsed: ReturnType<Readability["parse"]>;
  try {
    parsed = new Readability(document, {
      charThreshold: MIN_CONTENT_LENGTH,
    }).parse();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Readability failed to parse the article.",
    };
  }

  if (!parsed || !parsed.content) {
    return { status: "error", message: "Could not extract article content." };
  }

  const length = parsed.length ?? 0;
  if (length < MIN_CONTENT_LENGTH) {
    return {
      status: "error",
      message: "Extracted article content was too short.",
    };
  }

  const byline = hintByline || parsed.byline?.trim() || undefined;
  const withLead = ensureLeadFigure(parsed.content, leadFigureHtml);
  const rewritten = rewriteRelativeUrls(withLead, baseURL);
  const cleaned = cleanExtractedHtml(rewritten, byline);
  const sanitized = normalizeWhitespace(
    DOMPurify.sanitize(cleaned, {
      ADD_ATTR: [
        "data-payless-author",
        "data-payless-author-name",
        "data-payless-author-meta",
        "data-payless-lead",
        "data-payless-aside",
      ],
    })
  );

  const textContent = parse(sanitized)
    .textContent.replace(/\s+/g, " ")
    .trim();

  const article: NativeArticle = {
    title: preferArticleTitle(parsed.title, headingTitle),
    byline,
    content: sanitized,
    // Derive from cleaned HTML so stripped chrome (newsletters, etc.) is gone.
    textContent: textContent || parsed.textContent?.trim() || "",
    length: textContent.length || length,
    siteName: parsed.siteName?.trim() || undefined,
    images: collectImages(sanitized),
  };

  return { status: "ok", article };
}

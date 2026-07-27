/**
 * Archive challenge detection — shared by the app, the proxy (`/fetch`) and the
 * solver, so all three agree on what a CAPTCHA actually looks like.
 *
 * An archive snapshot embeds the original page verbatim, so a loose search for
 * "g-recaptcha" / "hcaptcha" fires on inert leftovers of the archived site (the
 * `g-recaptcha-response` textarea every reCAPTCHA form carries, hCaptcha asset
 * URLs) and locks a perfectly readable article behind the solver. Two rules
 * keep it honest: match the challenge page's own markup, and never call a
 * response a challenge when it already carries archive content.
 *
 * Keep this file dependency-free — `server/archive-proxy.ts` imports it, and
 * `Dockerfile.archive-proxy` copies it into the proxy image.
 */

const CHALLENGE_PATTERNS = [
  // The challenge renders an empty widget container. The `(?![-\w])` guard
  // stops `g-recaptcha-response` — snapshot debris — from matching.
  /(?:class|id)=["'][^"']*\bg-recaptcha(?![-\w])/i,
  /(?:class|id)=["'][^"']*\bh-captcha(?![-\w])/i,
  /cdn-cgi\/l\/chk_captcha/i,
  /cf-browser-verification/i,
  /why do i have to complete a captcha/i,
  /complete the captcha/i,
];

/**
 * Markers only a served archive page has: a snapshot body (`#CONTENT`) or a
 * result list linking to one. The challenge page has neither.
 */
const ARCHIVE_CONTENT_PATTERNS = [
  /id=["']?CONTENT/,
  /href="https:\/\/archive\.(?:is|ph|today|vn|fo)\/[a-zA-Z0-9]{4,7}"/,
];

export const ARCHIVE_BASE = "https://archive.is";

/** True when the response carries something the app can actually render. */
export function hasArchiveContent(html: string): boolean {
  return ARCHIVE_CONTENT_PATTERNS.some((pattern) => pattern.test(html));
}

export function isCaptchaHtml(html: string): boolean {
  if (hasArchiveContent(html)) return false;
  return CHALLENGE_PATTERNS.some((pattern) => pattern.test(html));
}

/**
 * Whether a fetched archive response should send the user to the solver.
 * archive.today serves the challenge with 429; any other content-less failure
 * gets the same treatment so a warm cookie can still rescue it.
 */
export function isCaptchaResponse(status: number, html: string): boolean {
  if (hasArchiveContent(html)) return false;
  return status < 200 || status >= 300 || isCaptchaHtml(html);
}

export function buildArchiveChallengeUrl(targetUrl: string): string {
  return `${ARCHIVE_BASE}/${targetUrl}`;
}

export function extractArchiveSnapshotLink(html: string): string | null {
  const absoluteMatch = html.match(
    /href="(https:\/\/archive\.(?:is|ph|today|vn|fo)\/[a-zA-Z0-9]{4,7})"/
  );
  if (absoluteMatch) {
    return absoluteMatch[1];
  }

  const relativeMatch = html.match(/href="(\/[a-zA-Z0-9]{4,7})"/);
  if (relativeMatch) {
    return `${ARCHIVE_BASE}${relativeMatch[1]}`;
  }

  return null;
}

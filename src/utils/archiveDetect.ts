const CAPTCHA_PATTERNS = [
  /g-recaptcha/i,
  /h-?captcha/i,
  /cf-browser-verification/i,
  /cdn-cgi\/l\/chk_captcha/i,
  /why do i have to complete a captcha/i,
  /complete the captcha/i,
];

export const ARCHIVE_BASE = "https://archive.is";

export function isCaptchaHtml(html: string): boolean {
  return CAPTCHA_PATTERNS.some((pattern) => pattern.test(html));
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

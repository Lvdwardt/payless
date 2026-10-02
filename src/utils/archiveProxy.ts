import {
  ARCHIVE_BASE,
  buildArchiveChallengeUrl,
  hasArchiveContent,
  isCaptchaResponse,
} from "@/utils/archiveDetect";
import { trackEvent } from "@/hooks/useUmami";
import {
  getCachedSnapshot,
  putCachedSnapshot,
} from "@/utils/snapshotCache";

export type ProxyFetchResult = {
  status: number;
  html: string;
  captcha: boolean;
  challengeUrl: string;
  via: "direct" | "proxy" | "cache";
};

const DIRECT_TIMEOUT_MS = 8000;

/** Re-hitting a throttled IP deepens archive's 429 instead of outliving it. */
let directBlockedUntil = 0;
const DIRECT_BLOCK_MS = 10 * 60 * 1000;

/** Local Bun proxy only. Set in `.env.development` via `scripts/dev.ts`. */
const PROXY_BASE = (import.meta.env.VITE_ARCHIVE_PROXY_URL || "").replace(
  /\/$/,
  ""
);

const SID_KEY = "payless_archive_sid";

let sessionReady: Promise<string> | null = null;

function proxyUsable(): boolean {
  return Boolean(PROXY_BASE);
}

function getStoredSid(): string | null {
  try {
    return sessionStorage.getItem(SID_KEY);
  } catch {
    return null;
  }
}

function storeSid(sid: string) {
  try {
    sessionStorage.setItem(SID_KEY, sid);
  } catch {
    // ignore
  }
}

async function ensureSession(): Promise<string> {
  const existing = getStoredSid();
  if (existing) return existing;

  if (!sessionReady) {
    sessionReady = fetch(`${PROXY_BASE}/session`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not create archive proxy session");
        }
        const data = (await response.json()) as { sid: string };
        storeSid(data.sid);
        return data.sid;
      })
      .catch((error) => {
        sessionReady = null;
        throw error;
      });
  }

  return sessionReady;
}

export async function fetchArchivePage(
  targetUrl: string
): Promise<ProxyFetchResult> {
  const challengeUrl = buildDirectChallengeUrl(targetUrl);
  const normalized = normalizeArchiveTarget(targetUrl);

  const cached = await getCachedSnapshot(normalized);
  if (cached) {
    return {
      status: 200,
      html: cached,
      captcha: false,
      challengeUrl,
      via: "cache",
    };
  }

  const directAllowed = Date.now() >= directBlockedUntil;

  const direct =
    directAllowed ?
      await fetchArchiveDirect(targetUrl, challengeUrl)
    : null;

  if (direct && !direct.captcha && direct.status >= 200 && direct.status < 300) {
    cacheIfContent(normalized, direct.html);
    trackEvent("archive fetch direct ok", { via: "direct" });
    return direct;
  }
  if (direct) {
    if (direct.captcha && proxyUsable()) {
      directBlockedUntil = Date.now() + DIRECT_BLOCK_MS;
    }
    trackEvent("archive fetch direct miss", {
      via: "direct",
      status: direct.status,
      captcha: direct.captcha,
    });
  }

  if (proxyUsable() && (await isProxyWarm())) {
    try {
      const result = await fetchViaProxy(targetUrl, challengeUrl);
      if (result.status >= 500 || isProxyErrorHtml(result.html)) {
        throw new Error(`Upstream archive error ${result.status}`);
      }
      if (!result.captcha) {
        directBlockedUntil = 0;
        cacheIfContent(normalized, result.html);
      }
      return result;
    } catch (error) {
      console.warn("Archive proxy failed, falling back to direct fetch", error);
    }
  }

  const fallback = direct ?? {
    status: 429,
    html: "",
    captcha: true,
    challengeUrl,
    via: "direct" as const,
  };
  if (fallback.captcha && proxyUsable()) {
    return { ...fallback, challengeUrl: await buildProxySolveUrl(normalized) };
  }
  return fallback;
}

function cacheIfContent(url: string, html: string) {
  if (hasArchiveContent(html)) void putCachedSnapshot(url, html);
}

/** archive clearance is cookie-bound; only a solve into the proxy jar helps. */
async function buildProxySolveUrl(archiveTarget: string): Promise<string> {
  try {
    const sid = await ensureSession();
    warmCheckedAt = 0;
    return `${PROXY_BASE}/solve?url=${encodeURIComponent(archiveTarget)}&sid=${encodeURIComponent(sid)}`;
  } catch {
    return buildDirectChallengeUrl(archiveTarget);
  }
}

async function fetchViaProxy(
  targetUrl: string,
  fallbackChallengeUrl: string
): Promise<ProxyFetchResult> {
  const sid = await ensureSession();
  const archiveTarget = normalizeArchiveTarget(targetUrl);
  const response = await fetch(
    `${PROXY_BASE}/fetch?url=${encodeURIComponent(archiveTarget)}&sid=${encodeURIComponent(sid)}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new Error(`Proxy error ${response.status}`);
  }

  const data = (await response.json()) as {
    status: number;
    captcha: boolean;
    html: string;
    sid?: string;
    challengeUrl: string | null;
  };

  if (data.sid) storeSid(data.sid);

  return {
    status: data.status,
    html: data.html || "",
    captcha: Boolean(data.captcha),
    challengeUrl: data.challengeUrl || fallbackChallengeUrl,
    via: "proxy",
  };
}

function isProxyErrorHtml(html: string): boolean {
  return /^error code:\s*\d+/i.test(html.trim());
}

let warmCheckedAt = 0;
let warmLastValue = false;

/** Cached (60s) jar state so a cold proxy costs one /health call per minute. */
async function isProxyWarm(): Promise<boolean> {
  if (Date.now() < warmCheckedAt) return warmLastValue;
  try {
    const response = await fetch(`${PROXY_BASE}/health`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { warm?: boolean };
    warmLastValue = Boolean(data.warm);
  } catch {
    warmLastValue = false;
  }
  warmCheckedAt = Date.now() + 60_000;
  return warmLastValue;
}

function buildDirectChallengeUrl(targetUrl: string): string {
  try {
    const parsed = new URL(
      targetUrl.startsWith("http") ? targetUrl : `${ARCHIVE_BASE}/${targetUrl}`
    );
    if (/archive\.(is|ph|today|vn|fo)$/i.test(parsed.hostname)) {
      return parsed.toString();
    }
    return buildArchiveChallengeUrl(parsed.toString());
  } catch {
    return buildArchiveChallengeUrl(targetUrl);
  }
}

function normalizeArchiveTarget(targetUrl: string): string {
  if (targetUrl.startsWith("http")) {
    return targetUrl;
  }
  return `${ARCHIVE_BASE}/${targetUrl}`;
}

async function fetchArchiveDirect(
  targetUrl: string,
  challengeUrl: string
): Promise<ProxyFetchResult> {
  try {
    const response = await fetch(normalizeArchiveTarget(targetUrl), {
      credentials: "omit",
      signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
    });
    const html = await response.text();
    const captcha = isCaptchaResponse(response.status, html);

    return {
      status: response.status,
      html,
      captcha,
      challengeUrl,
      via: "direct",
    };
  } catch (error) {
    trackEvent("archive fetch direct error", {
      via: "direct",
      message: error instanceof Error ? error.message : "network error",
    });
    return {
      status: 0,
      html: "",
      captcha: false,
      challengeUrl,
      via: "direct",
    };
  }
}

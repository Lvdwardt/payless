import {
  ARCHIVE_BASE,
  buildArchiveChallengeUrl,
  isCaptchaHtml,
} from "@/utils/archiveDetect";

export type ProxyFetchResult = {
  status: number;
  html: string;
  captcha: boolean;
  challengeUrl: string;
};

/**
 * Local/dev proxy holds archive CAPTCHA cookies in a server-side jar.
 * Set via .env.development → http://localhost:8787
 */
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

  if (proxyUsable()) {
    try {
      const result = await fetchViaProxy(targetUrl, challengeUrl);
      if (result.status >= 500 || isProxyErrorHtml(result.html)) {
        throw new Error(`Upstream archive error ${result.status}`);
      }
      return result;
    } catch (error) {
      console.warn("Archive proxy failed, falling back to direct fetch", error);
    }
  }

  return fetchArchiveDirect(targetUrl, challengeUrl);
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
  };
}

function isProxyErrorHtml(html: string): boolean {
  return /^error code:\s*\d+/i.test(html.trim());
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
  const response = await fetch(normalizeArchiveTarget(targetUrl));
  const html = await response.text();
  const captcha = !response.ok || isCaptchaHtml(html);

  return {
    status: response.status,
    html,
    captcha,
    challengeUrl,
  };
}

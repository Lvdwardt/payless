/**
 * Archive.is session proxy.
 *
 * Archive CAPTCHA cookies are domain-bound and can't be used by the app's
 * cross-origin fetch (archive sends `Access-Control-Allow-Origin: *`, so the
 * browser refuses to carry credentials). This proxy fetches archive HTML with a
 * server-side cookie jar instead, and cleans past the CAPTCHA by driving a real
 * Chromium once:
 *
 * 1. Keeps a SINGLE shared archive cookie jar (solve once → every device warm),
 *    persisted to disk so it survives restarts.
 * 2. Opens a real Chromium page when a CAPTCHA is hit. Locally that window is on
 *    your screen; on the VPS it runs under Xvfb and you solve it through noVNC.
 * 3. Captures the cleared cookies (`qki` + friends) into the shared jar.
 * 4. Serves cleaned archive HTML back to the app.
 *
 * Egress note: archive.today 429s datacenter + commercial-VPN IPs. The cleared
 * cookie (`qki`, Max-Age 3600) is what buys a warm window on a flagged IP —
 * re-solve when it goes cold.
 */

import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

type Session = {
  touchedAt: number;
  solveStatus: "idle" | "solving" | "done" | "error";
  solveError?: string;
};

/** Short-lived grant that lets the solve page reach noVNC, bound to one solve. */
type VncToken = { sid: string; exp: number };

/** In-flight noVNC websocket proxy state (buffers client frames until upstream is up). */
type VncWsData = {
  upstream: WebSocket | null;
  queue: (string | ArrayBufferLike | ArrayBufferView)[];
};

const PORT = Number(process.env.ARCHIVE_PROXY_PORT || 8788);
const SID_COOKIE = "payless_archive_sid";
const SESSION_TTL_MS = 60 * 60 * 1000;
const VNC_TOKEN_TTL_MS = 10 * 60 * 1000;
const ARCHIVE_HOST_RE = /^archive\.(is|ph|today|vn|fo)$/i;

/** Legacy external noVNC URL (kept for back-compat). Prefer VNC_INTERNAL. */
const VNC_URL = process.env.VNC_URL || "";
/** Container mode: serve + gate noVNC same-origin through this proxy (no public VNC door). */
const VNC_INTERNAL = process.env.VNC_INTERNAL === "1";
/** Loopback port where websockify (noVNC static + VNC bridge) listens inside the container. */
const NOVNC_PORT = Number(process.env.NOVNC_PORT || 6080);
/** Where to persist the shared cookie jar. Unset = in-memory only. */
const COOKIE_STORE_PATH = process.env.COOKIE_STORE_PATH || "";
/** true on the VPS/container: cross-site cookies + secure. */
const CROSS_SITE =
  process.env.CROSS_SITE === "1" || VNC_INTERNAL || Boolean(VNC_URL);

/** Single shared archive cookie jar — warmed by any solve, used by every fetch. */
const archiveCookies: Record<string, string> = {};

const sessions = new Map<string, Session>();
const activeSolves = new Set<string>();
/** token → grant. noVNC is only reachable while the bound solve is "solving". */
const vncTokens = new Map<string, VncToken>();
let sharedBrowser: Browser | null = null;

loadCookies();

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [sid, session] of sessions) {
    if (session.touchedAt < cutoff) sessions.delete(sid);
  }
  const now = Date.now();
  for (const [token, grant] of vncTokens) {
    if (grant.exp < now) vncTokens.delete(token);
  }
}

setInterval(pruneSessions, 60_000).unref?.();

const server = Bun.serve({
  port: PORT,
  async fetch(request, server) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), request);
    }

    const url = new URL(request.url);

    try {
      // noVNC websocket bridge — gated by a live solve token, proxied to loopback.
      if (url.pathname.startsWith("/vnc/websockify/")) {
        const token = url.pathname.slice("/vnc/websockify/".length);
        if (!isLiveVncToken(token)) {
          return new Response("Forbidden", { status: 403 });
        }
        const upgraded = server.upgrade(request, {
          data: { upstream: null, queue: [] } satisfies VncWsData,
          headers: { "Sec-WebSocket-Protocol": "binary" },
        });
        if (upgraded) return undefined;
        return new Response("Expected websocket", { status: 426 });
      }
      // noVNC static assets (vnc.html + core) — harmless without the gated WS.
      if (url.pathname === "/vnc" || url.pathname.startsWith("/vnc/")) {
        return handleVncStatic(request, url);
      }
      if (url.pathname === "/session") {
        return cors(await createSession(request), request);
      }
      if (url.pathname === "/fetch") {
        return cors(await handleFetch(request), request);
      }
      if (url.pathname === "/solve") {
        return handleSolve(request);
      }
      if (url.pathname === "/solve-status") {
        return cors(handleSolveStatus(request), request);
      }
      if (url.pathname === "/challenge") {
        return handleChallenge(request);
      }
      if (url.pathname === "/health") {
        return cors(
          Response.json({
            ok: true,
            cookies: Object.keys(archiveCookies).length,
            warm: Boolean(archiveCookies.qki),
          }),
          request
        );
      }
      return cors(Response.json({ error: "Not found" }, { status: 404 }), request);
    } catch (error) {
      console.error("[archive-proxy]", error);
      return cors(
        Response.json(
          { error: error instanceof Error ? error.message : "Proxy error" },
          { status: 500 }
        ),
        request
      );
    }
  },
  // Pipe the gated client noVNC socket ↔ the loopback websockify bridge.
  websocket: {
    open(ws) {
      const data = ws.data as VncWsData;
      const upstream = new WebSocket(
        `ws://127.0.0.1:${NOVNC_PORT}/websockify`,
        ["binary"]
      );
      upstream.binaryType = "arraybuffer";
      data.upstream = upstream;
      upstream.onopen = () => {
        for (const frame of data.queue) upstream.send(frame);
        data.queue = [];
      };
      upstream.onmessage = (event) => {
        try {
          ws.send(event.data as string | ArrayBufferView | ArrayBufferLike);
        } catch {
          // client gone
        }
      };
      upstream.onclose = () => {
        try {
          ws.close();
        } catch {
          // already closed
        }
      };
      upstream.onerror = () => {
        try {
          ws.close();
        } catch {
          // already closed
        }
      };
    },
    message(ws, message) {
      const data = ws.data as VncWsData;
      const frame =
        typeof message === "string" ? message : (message as Uint8Array);
      if (data.upstream && data.upstream.readyState === WebSocket.OPEN) {
        data.upstream.send(frame);
      } else {
        data.queue.push(frame);
      }
    },
    close(ws) {
      const data = ws.data as VncWsData;
      try {
        data.upstream?.close();
      } catch {
        // already closed
      }
    },
  },
});

console.log(
  `[archive-proxy] listening on :${server.port} (cross-site=${CROSS_SITE}, vnc=${
    VNC_INTERNAL ? "internal" : VNC_URL ? "external" : "off"
  })`
);

async function createSession(request: Request): Promise<Response> {
  const existing = getSid(request);
  const sid = existing || crypto.randomUUID();
  if (!sessions.has(sid)) {
    sessions.set(sid, { touchedAt: Date.now(), solveStatus: "idle" });
  }
  return withSidCookie(Response.json({ sid }), sid);
}

async function handleFetch(request: Request): Promise<Response> {
  const sid = ensureSession(request);
  const target = new URL(request.url).searchParams.get("url");

  if (!target || !isAllowedArchiveUrl(target)) {
    return Response.json({ error: "Invalid archive url" }, { status: 400 });
  }

  const upstream = await proxyFollow(target, "GET", null, undefined, 5);
  const html = await upstream.text();
  const captcha = upstream.status === 429 || isCaptchaHtml(html);
  const origin = publicOrigin(request);

  return withSidCookie(
    Response.json({
      status: upstream.status,
      captcha,
      html,
      sid,
      challengeUrl: captcha
        ? `${origin}/solve?url=${encodeURIComponent(target)}&sid=${encodeURIComponent(sid)}`
        : null,
    }),
    sid
  );
}

function handleSolveStatus(request: Request): Response {
  const sid = ensureSession(request);
  const session = getSession(sid);
  return Response.json({
    sid,
    status: session.solveStatus,
    error: session.solveError || null,
    cookieCount: Object.keys(archiveCookies).length,
    warm: Boolean(archiveCookies.qki),
  });
}

async function handleSolve(request: Request): Promise<Response> {
  const sid = ensureSession(request);
  const target = new URL(request.url).searchParams.get("url");

  if (!target || !isAllowedArchiveUrl(target)) {
    return new Response("Invalid archive url", { status: 400 });
  }

  const session = getSession(sid);
  if (!activeSolves.has(sid)) {
    activeSolves.add(sid);
    session.solveStatus = "solving";
    session.solveError = undefined;
    void runInteractiveSolve(sid, target).finally(() => {
      activeSolves.delete(sid);
    });
  }

  // Grant same-origin noVNC access for the life of this solve only.
  const vncToken = mintVncToken(sid);

  return new Response(solveWaitingPage(sid, publicOrigin(request), vncToken), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "set-cookie": sidCookieValue(sid),
    },
  });
}

async function runInteractiveSolve(sid: string, target: string) {
  const session = getSession(sid);
  let context: BrowserContext | null = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });

    // Seed cookies we already have so archive may skip the challenge entirely.
    const existing = Object.entries(archiveCookies).map(([name, value]) => ({
      name,
      value,
      domain: ".archive.ph",
      path: "/",
    }));
    if (existing.length) {
      await context.addCookies(existing);
    }

    const page: Page = await context.newPage();
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log(`[archive-proxy] Solve window open for ${sid} → ${target}`);

    // Wait until we have real archive content (CAPTCHA pages don't include these).
    await page.waitForFunction(
      () => {
        const html = document.documentElement?.innerHTML || "";
        const hasContent = !!document.querySelector("#CONTENT");
        const hasArchiveLink =
          /href="https:\/\/archive\.(is|ph|today|vn|fo)\/[a-zA-Z0-9]{4,7}"/.test(
            html
          );
        const stillCaptcha =
          !!document.querySelector("#g-recaptcha, .g-recaptcha") ||
          /why do i have to complete a captcha/i.test(
            document.body?.innerText || ""
          );
        return !stillCaptcha && (hasContent || hasArchiveLink);
      },
      { timeout: 5 * 60 * 1000 }
    );

    // Give redirects a moment to settle after CAPTCHA.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let captured = 0;
    for (const cookie of await context.cookies()) {
      archiveCookies[cookie.name] = cookie.value;
      captured += 1;
    }
    saveCookies();

    session.solveStatus = "done";
    session.touchedAt = Date.now();
    console.log(`[archive-proxy] Captured ${captured} cookies (jar=${Object.keys(archiveCookies).length}) for ${sid}`);
  } catch (error) {
    session.solveStatus = "error";
    session.solveError =
      error instanceof Error ? error.message : "Failed to complete CAPTCHA";
    console.error("[archive-proxy] solve failed", error);
  } finally {
    await context?.close().catch(() => undefined);
  }
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;

  // Container-safe args (harmless on desktop). --no-sandbox is required when the
  // proxy runs as root inside Docker.
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-position=0,0",
  ];

  // Try branded channels first (local dev), then Playwright's bundled Chromium
  // (present in the mcr.microsoft.com/playwright container image).
  const attempts: Array<{ channel?: "chrome" | "msedge" }> = [
    { channel: "chrome" },
    { channel: "msedge" },
    {},
  ];

  let lastError: unknown;
  for (const opts of attempts) {
    try {
      sharedBrowser = await chromium.launch({
        ...opts,
        headless: false,
        executablePath: process.env.CHROME_PATH || undefined,
        args,
      });
      sharedBrowser.on("disconnected", () => {
        sharedBrowser = null;
      });
      return sharedBrowser;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not launch a browser for CAPTCHA solving");
}

function solveWaitingPage(sid: string, origin: string, vncToken: string): string {
  // On the VPS the solve happens in a browser you can't see — embed noVNC so you
  // can reach in and tap the checkbox from your phone. Locally the window just
  // opens on your screen.
  //
  // VNC_INTERNAL: noVNC is served + gated same-origin by this proxy. The iframe
  // points at our own /vnc/… and the websocket path carries a one-time token
  // bound to this solve, so there is no public VNC door and no password prompt.
  let solver: string;
  if (VNC_INTERNAL) {
    const wsPath = encodeURIComponent(`vnc/websockify/${vncToken}`);
    const vncSrc = `${origin}/vnc/vnc.html?autoconnect=1&resize=remote&reconnect=1&path=${wsPath}`;
    solver = `<iframe class="vnc" src="${vncSrc}" allow="clipboard-read; clipboard-write"></iframe>
    <p class="hint">Tap the reCAPTCHA above. When it clears, this closes itself and the article loads back in the app.</p>`;
  } else if (VNC_URL) {
    solver = `<iframe class="vnc" src="${VNC_URL}" allow="clipboard-read; clipboard-write"></iframe>
    <p class="hint">Tap the reCAPTCHA above. When it clears, this closes itself and the article loads back in the app.</p>`;
  } else {
    solver = `<p>A Chrome window should open on this machine. Solve the checkbox there.</p>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payless CAPTCHA</title>
  <style>
    body { font-family: Georgia, serif; background: #f4f2ec; color: #2a2438; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
    header { padding: 1rem 1.25rem 0.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .hint { margin: 0.5rem 1.25rem; color: #5b5368; font-size: 0.85rem; text-align: center; }
    .vnc { flex: 1; width: 100%; border: 0; min-height: 60vh; }
    .status { padding: 0.75rem 1.25rem 1rem; text-align: center; font-family: ui-monospace, monospace; font-size: 0.8rem; color: #5b5368; }
    .ok { color: #0f7a45; }
    .err { color: #a12626; }
  </style>
</head>
<body>
  <header><h1>Complete the CAPTCHA</h1></header>
  ${solver}
  <p class="status" id="status">Waiting for CAPTCHA…</p>
  <script>
    const sid = ${JSON.stringify(sid)};
    const statusEl = document.getElementById('status');
    async function poll() {
      try {
        const res = await fetch('/solve-status?sid=' + encodeURIComponent(sid));
        const data = await res.json();
        if (data.status === 'done') {
          statusEl.textContent = 'CAPTCHA cleared. Return to Payless — the article should load automatically.';
          statusEl.className = 'status ok';
          setTimeout(() => { try { window.close(); } catch (e) {} }, 1500);
          return;
        }
        if (data.status === 'error') {
          statusEl.textContent = data.error || 'Something went wrong. Close this and try again.';
          statusEl.className = 'status err';
          return;
        }
        statusEl.textContent = 'Waiting for CAPTCHA… (' + (data.cookieCount || 0) + ' cookies' + (data.warm ? ', warm' : '') + ')';
      } catch (e) {
        statusEl.textContent = 'Still waiting…';
      }
      setTimeout(poll, 1500);
    }
    poll();
  </script>
</body>
</html>`;
}

async function handleChallenge(request: Request): Promise<Response> {
  const sid = ensureSession(request);
  const incoming = new URL(request.url);
  const pub = publicOrigin(request);
  const targetParam = incoming.searchParams.get("url");

  if (!targetParam || !isAllowedArchiveUrl(targetParam)) {
    return new Response("Invalid archive url", { status: 400 });
  }

  const targetUrl = new URL(targetParam);
  for (const [key, value] of incoming.searchParams) {
    if (key === "url" || key === "sid") continue;
    targetUrl.searchParams.set(key, value);
  }

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : null;

  const upstream = await proxyRequest(
    targetUrl.toString(),
    request.method,
    body,
    request.headers
  );
  persistCookies(upstream);

  const headers = new Headers();
  headers.append("set-cookie", sidCookieValue(sid));

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      const absolute = new URL(location, targetUrl).toString();
      headers.set(
        "location",
        isAllowedArchiveUrl(absolute)
          ? `${pub}/challenge?url=${encodeURIComponent(absolute)}&sid=${encodeURIComponent(sid)}`
          : location
      );
      return new Response(null, { status: upstream.status, headers });
    }
  }

  const contentType = upstream.headers.get("content-type") || "";
  headers.set("content-type", contentType || "text/html; charset=utf-8");

  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    html = rewriteArchiveHtml(html, targetUrl.origin, pub, sid);
    return new Response(html, { status: upstream.status, headers });
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  });
}

async function proxyRequest(
  target: string,
  method: string,
  body: ArrayBuffer | null,
  incomingHeaders?: Headers
): Promise<Response> {
  const headers = new Headers();
  headers.set(
    "user-agent",
    incomingHeaders?.get("user-agent") ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
  );
  headers.set(
    "accept",
    incomingHeaders?.get("accept") ||
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  );
  headers.set("accept-language", "en-US,en;q=0.9,nl;q=0.8");

  const cookie = Object.entries(archiveCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);

  const contentType = incomingHeaders?.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return fetch(target, {
    method,
    headers,
    body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
    redirect: "manual",
  });
}

async function proxyFollow(
  target: string,
  method: string,
  body: ArrayBuffer | null,
  incomingHeaders: Headers | undefined,
  redirectsLeft: number
): Promise<Response> {
  let current = target;
  let response = await proxyRequest(current, method, body, incomingHeaders);
  persistCookies(response);

  while (redirectsLeft > 0 && response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!isAllowedArchiveUrl(next)) break;
    current = next;
    redirectsLeft -= 1;
    response = await proxyRequest(current, "GET", null, incomingHeaders);
    persistCookies(response);
  }

  return response;
}

function rewriteArchiveHtml(
  html: string,
  archiveOrigin: string,
  proxyOrigin: string,
  sid: string
): string {
  const proxy = (rawUrl: string) => {
    try {
      const absolute = new URL(rawUrl, archiveOrigin).toString();
      if (!isAllowedArchiveUrl(absolute)) return rawUrl;
      return `${proxyOrigin}/challenge?url=${encodeURIComponent(absolute)}&sid=${encodeURIComponent(sid)}`;
    } catch {
      return rawUrl;
    }
  };

  let rewritten = html.replace(
    /\b(href|src|action)=["']([^"']+)["']/gi,
    (full, attr: string, value: string) => {
      if (
        value.startsWith("#") ||
        value.startsWith("data:") ||
        value.startsWith("javascript:") ||
        value.startsWith("mailto:")
      ) {
        return full;
      }
      return `${attr}="${proxy(value)}"`;
    }
  );

  rewritten = rewritten.replace(
    /content=(["'])(\d+\s*;\s*url=)([^"']+)\1/gi,
    (_full, quote: string, prefix: string, value: string) =>
      `content=${quote}${prefix}${proxy(value)}${quote}`
  );

  return rewritten;
}

function isCaptchaHtml(html: string): boolean {
  return /g-recaptcha|h-?captcha|cdn-cgi\/l\/chk_captcha|complete the captcha|why do i have to complete a captcha/i.test(
    html
  );
}

function isAllowedArchiveUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      ARCHIVE_HOST_RE.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function ensureSession(request: Request): string {
  const existing = getSid(request);
  if (existing) {
    getSession(existing);
    return existing;
  }
  const sid = crypto.randomUUID();
  sessions.set(sid, { touchedAt: Date.now(), solveStatus: "idle" });
  return sid;
}

function getSid(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get("sid");
  if (fromQuery) return fromQuery;

  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SID_COOKIE}=([^;]+)`));
  return match?.[1] || null;
}

function getSession(sid: string): Session {
  let session = sessions.get(sid);
  if (!session) {
    session = { touchedAt: Date.now(), solveStatus: "idle" };
    sessions.set(sid, session);
  }
  session.touchedAt = Date.now();
  return session;
}

function sidCookieValue(sid: string): string {
  // Cross-site (Vercel app → VPS proxy) needs SameSite=None; Secure or the
  // browser drops it. Locally keep Lax so http://localhost works.
  const suffix = CROSS_SITE ? "SameSite=None; Secure" : "SameSite=Lax";
  return `${SID_COOKIE}=${sid}; Path=/; Max-Age=3600; HttpOnly; ${suffix}`;
}

function withSidCookie(response: Response, sid: string): Response {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", sidCookieValue(sid));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function persistCookies(response: Response) {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  const setCookies =
    getSetCookie && getSetCookie.length > 0
      ? getSetCookie
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

  let changed = false;
  for (const item of setCookies) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (archiveCookies[name] !== value) {
      archiveCookies[name] = value;
      changed = true;
    }
  }
  if (changed) saveCookies();
}

/**
 * Public-facing origin of a request. Behind Coolify/Traefik, TLS terminates at
 * the proxy and Bun sees plain http, so `new URL(request.url).origin` yields
 * http:// — which becomes mixed content when embedded from the https app. Trust
 * the forwarded headers the reverse proxy sets.
 */
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}

/** Mint a one-time noVNC grant bound to a solve session. */
function mintVncToken(sid: string): string {
  const token = crypto.randomUUID();
  vncTokens.set(token, { sid, exp: Date.now() + VNC_TOKEN_TTL_MS });
  return token;
}

/** A noVNC token is live only while unexpired AND its solve is still running. */
function isLiveVncToken(token: string): boolean {
  const grant = vncTokens.get(token);
  if (!grant || grant.exp < Date.now()) return false;
  return sessions.get(grant.sid)?.solveStatus === "solving";
}

/** Reverse-proxy noVNC static assets from the loopback websockify server. */
async function handleVncStatic(request: Request, url: URL): Promise<Response> {
  const rest =
    url.pathname === "/vnc" || url.pathname === "/vnc/"
      ? "vnc.html"
      : url.pathname.slice("/vnc/".length);
  const upstream = await fetch(
    `http://127.0.0.1:${NOVNC_PORT}/${rest}${url.search}`
  );
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(upstream.body, { status: upstream.status, headers });
}

function cors(response: Response, request: Request): Response {
  const origin = request.headers.get("origin") || "http://localhost:5173";
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set(
    "access-control-allow-headers",
    request.headers.get("access-control-request-headers") || "content-type"
  );
  headers.set("vary", "origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Cookie jar persistence ───────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadCookies() {
  if (!COOKIE_STORE_PATH) return;
  try {
    const text = readFileSync(COOKIE_STORE_PATH, "utf8");
    const parsed = JSON.parse(text) as Record<string, string>;
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") archiveCookies[name] = value;
    }
    console.log(`[archive-proxy] Loaded ${Object.keys(archiveCookies).length} cookies from ${COOKIE_STORE_PATH}`);
  } catch {
    // No file yet — start cold.
  }
}

function saveCookies() {
  if (!COOKIE_STORE_PATH) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void Bun.write(COOKIE_STORE_PATH, JSON.stringify(archiveCookies, null, 2)).catch(
      (error) => console.error("[archive-proxy] cookie save failed", error)
    );
  }, 1000);
}

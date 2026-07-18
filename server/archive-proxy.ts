/**
 * Local archive.is session proxy.
 *
 * Archive CAPTCHA cookies are domain-bound and can't be used by the Vite app's
 * cross-origin fetch. This proxy:
 * 1. Fetches archive HTML with a server-side cookie jar
 * 2. Opens a real Chrome window via Playwright when CAPTCHA is needed
 * 3. Copies cookies from that browser into the jar after you solve it
 * 4. Serves HTML back to Payless for cleaning
 */

import { chromium, type Browser } from "playwright-core";

type Session = {
  cookies: Record<string, string>;
  touchedAt: number;
  solveStatus: "idle" | "solving" | "done" | "error";
  solveError?: string;
};

const PORT = Number(process.env.ARCHIVE_PROXY_PORT || 8788);
const SID_COOKIE = "payless_archive_sid";
const SESSION_TTL_MS = 60 * 60 * 1000;
const ARCHIVE_HOST_RE = /^archive\.(is|ph|today|vn|fo)$/i;

const sessions = new Map<string, Session>();
const activeSolves = new Set<string>();
let sharedBrowser: Browser | null = null;

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [sid, session] of sessions) {
    if (session.touchedAt < cutoff) sessions.delete(sid);
  }
}

setInterval(pruneSessions, 60_000).unref?.();

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), request);
    }

    const url = new URL(request.url);

    try {
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
        return Response.json({ ok: true });
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
});

console.log(`[archive-proxy] http://localhost:${server.port}`);

async function createSession(request: Request): Promise<Response> {
  const existing = getSid(request);
  const sid = existing || crypto.randomUUID();
  if (!sessions.has(sid)) {
    sessions.set(sid, {
      cookies: {},
      touchedAt: Date.now(),
      solveStatus: "idle",
    });
  }
  return withSidCookie(Response.json({ sid }), sid);
}

async function handleFetch(request: Request): Promise<Response> {
  const sid = ensureSession(request);
  const target = new URL(request.url).searchParams.get("url");

  if (!target || !isAllowedArchiveUrl(target)) {
    return Response.json({ error: "Invalid archive url" }, { status: 400 });
  }

  const session = getSession(sid);
  const upstream = await proxyFollow(target, "GET", null, session, undefined, 5);
  const html = await upstream.text();
  const captcha = upstream.status === 429 || isCaptchaHtml(html);
  const origin = new URL(request.url).origin;

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
    cookieCount: Object.keys(session.cookies).length,
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

  return new Response(solveWaitingPage(sid), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "set-cookie": sidCookieValue(sid),
    },
  });
}

async function runInteractiveSolve(sid: string, target: string) {
  const session = getSession(sid);
  let context = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    // Seed any cookies we already have.
    const existing = Object.entries(session.cookies).map(([name, value]) => ({
      name,
      value,
      domain: ".archive.is",
      path: "/",
    }));
    if (existing.length) {
      await context.addCookies(existing);
    }

    const page = await context.newPage();
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

    const cookies = await context.cookies();
    for (const cookie of cookies) {
      if (
        ARCHIVE_HOST_RE.test(cookie.domain.replace(/^\./, "")) ||
        cookie.domain.endsWith("archive.is") ||
        cookie.domain.endsWith("archive.ph") ||
        cookie.domain.endsWith("archive.today")
      ) {
        session.cookies[cookie.name] = cookie.value;
      }
    }

    // Also keep non-archive CF cookies from the archive response host.
    for (const cookie of cookies) {
      session.cookies[cookie.name] = cookie.value;
    }

    session.solveStatus = "done";
    session.touchedAt = Date.now();
    console.log(
      `[archive-proxy] Captured ${Object.keys(session.cookies).length} cookies for ${sid}`
    );
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

  const launchAttempts = [
    { channel: "chrome" as const },
    { channel: "msedge" as const },
    { channel: "chromium" as const },
  ];

  let lastError: unknown;
  for (const opts of launchAttempts) {
    try {
      sharedBrowser = await chromium.launch({
        ...opts,
        headless: false,
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
    : new Error("Could not launch Chrome/Edge for CAPTCHA solving");
}

function solveWaitingPage(sid: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payless CAPTCHA</title>
  <style>
    body { font-family: Georgia, serif; background: #f4f2ec; color: #2a2438; margin: 0; min-height: 100vh; display: grid; place-items: center; }
    main { max-width: 28rem; padding: 2rem; text-align: center; }
    h1 { font-size: 1.75rem; margin: 0 0 0.75rem; }
    p { line-height: 1.5; color: #5b5368; }
    .status { margin-top: 1.5rem; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .ok { color: #0f7a45; }
    .err { color: #a12626; }
  </style>
</head>
<body>
  <main>
    <h1>Complete the CAPTCHA</h1>
    <p>A Chrome window should open on archive.is. Solve the checkbox there. This page will update when Payless has the session — then go back to the app.</p>
    <p class="status" id="status">Waiting for CAPTCHA…</p>
  </main>
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
          return;
        }
        if (data.status === 'error') {
          statusEl.textContent = data.error || 'Something went wrong. Close this and try again.';
          statusEl.className = 'status err';
          return;
        }
        statusEl.textContent = 'Waiting for CAPTCHA… (' + (data.cookieCount || 0) + ' cookies)';
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
  const targetParam = incoming.searchParams.get("url");

  if (!targetParam || !isAllowedArchiveUrl(targetParam)) {
    return new Response("Invalid archive url", { status: 400 });
  }

  const targetUrl = new URL(targetParam);
  for (const [key, value] of incoming.searchParams) {
    if (key === "url" || key === "sid") continue;
    targetUrl.searchParams.set(key, value);
  }

  const session = getSession(sid);
  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : null;

  const upstream = await proxyRequest(
    targetUrl.toString(),
    request.method,
    body,
    session,
    request.headers
  );
  persistCookies(session, upstream);

  const headers = new Headers();
  headers.append("set-cookie", sidCookieValue(sid));

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      const absolute = new URL(location, targetUrl).toString();
      headers.set(
        "location",
        isAllowedArchiveUrl(absolute)
          ? `${incoming.origin}/challenge?url=${encodeURIComponent(absolute)}&sid=${encodeURIComponent(sid)}`
          : location
      );
      return new Response(null, { status: upstream.status, headers });
    }
  }

  const contentType = upstream.headers.get("content-type") || "";
  headers.set("content-type", contentType || "text/html; charset=utf-8");

  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    html = rewriteArchiveHtml(html, targetUrl.origin, incoming.origin, sid);
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
  session: Session,
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

  const cookie = Object.entries(session.cookies)
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
  session: Session,
  incomingHeaders: Headers | undefined,
  redirectsLeft: number
): Promise<Response> {
  let current = target;
  let response = await proxyRequest(
    current,
    method,
    body,
    session,
    incomingHeaders
  );
  persistCookies(session, response);

  while (redirectsLeft > 0 && response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!isAllowedArchiveUrl(next)) break;
    current = next;
    redirectsLeft -= 1;
    response = await proxyRequest(current, "GET", null, session, incomingHeaders);
    persistCookies(session, response);
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
    if (!sessions.has(existing)) {
      sessions.set(existing, {
        cookies: {},
        touchedAt: Date.now(),
        solveStatus: "idle",
      });
    } else {
      sessions.get(existing)!.touchedAt = Date.now();
    }
    return existing;
  }
  const sid = crypto.randomUUID();
  sessions.set(sid, {
    cookies: {},
    touchedAt: Date.now(),
    solveStatus: "idle",
  });
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
    session = { cookies: {}, touchedAt: Date.now(), solveStatus: "idle" };
    sessions.set(sid, session);
  }
  session.touchedAt = Date.now();
  return session;
}

function sidCookieValue(sid: string): string {
  return `${SID_COOKIE}=${sid}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
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

function persistCookies(session: Session, response: Response) {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  const setCookies =
    getSetCookie && getSetCookie.length > 0
      ? getSetCookie
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

  for (const item of setCookies) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    session.cookies[name] = value;
  }
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

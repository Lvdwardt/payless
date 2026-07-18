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
 * 3. Captures cleared archive cookies into the jar, re-fetches to verify the
 *    CAPTCHA is actually gone, and never lets challenge Set-Cookie clobber a
 *    good jar (archive also sets `qki` on 429s).
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
  solveStatus: "idle" | "solving" | "awaiting-answer" | "done" | "error";
  solveError?: string;
  /** Which solve tier the operator UI should show right now. */
  solveMode?: "auto" | "manual-audio" | "novnc";
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
/**
 * True only after a verified non-CAPTCHA archive response (or a solve that we
 * re-fetched successfully). Presence of `qki` alone is NOT warm — archive sets
 * `qki` on 429s before the challenge is cleared.
 */
let jarCleared = false;

/** Archive cookie domains to seed into Playwright (fetch ignores domain). */
const ARCHIVE_COOKIE_DOMAINS = [
  ".archive.is",
  ".archive.ph",
  ".archive.today",
  ".archive.vn",
  ".archive.fo",
] as const;

const sessions = new Map<string, Session>();
const activeSolves = new Set<string>();
/** token → grant. noVNC is only reachable while the bound solve is "solving". */
const vncTokens = new Map<string, VncToken>();
/**
 * sid → latest reCAPTCHA audio clip captured during a solve. VNC carries no
 * audio, so we grab the challenge mp3 off the wire and let the operator play it
 * in their own browser instead.
 */
const solveAudio = new Map<string, { buf: Uint8Array; ts: number }>();
/** sid → resolver waiting for the operator's typed audio answer (tier 2). */
const pendingAnswers = new Map<string, (answer: string | null) => void>();
let sharedBrowser: Browser | null = null;

/** Optional STT for tier-1 auto solve. If unset, we skip straight to manual audio. */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
/** Model + endpoint for Whisper transcription. */
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || "whisper-1";

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
  for (const sid of solveAudio.keys()) {
    if (!sessions.has(sid)) solveAudio.delete(sid);
  }
  for (const sid of pendingAnswers.keys()) {
    if (!sessions.has(sid)) pendingAnswers.get(sid)?.(null);
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
      if (url.pathname === "/solve-audio") {
        return handleSolveAudio(request);
      }
      if (url.pathname === "/solve-answer") {
        return cors(await handleSolveAnswer(request), request);
      }
      if (url.pathname === "/challenge") {
        return handleChallenge(request);
      }
      if (url.pathname === "/health") {
        return cors(
          Response.json({
            ok: true,
            cookies: Object.keys(archiveCookies).length,
            warm: jarCleared,
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

  // Never let CAPTCHA/429 Set-Cookie clobber a cleared jar — archive sets `qki`
  // on challenge responses too, which previously made `/health` look "warm"
  // while every fetch still failed.
  if (captcha) {
    jarCleared = false;
  } else {
    persistCookies(upstream);
    jarCleared = true;
  }

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
  const audio = solveAudio.get(sid);
  return Response.json({
    sid,
    status: session.solveStatus,
    mode: session.solveMode || "auto",
    error: session.solveError || null,
    audioTs: audio?.ts || null,
    cookieCount: Object.keys(archiveCookies).length,
    warm: jarCleared,
  });
}

async function handleSolveAnswer(request: Request): Promise<Response> {
  const sid = ensureSession(request);
  let answer = "";
  try {
    const body = (await request.json()) as { answer?: string };
    answer = (body.answer || "").trim();
  } catch {
    answer = "";
  }
  if (!answer) {
    return Response.json({ error: "Empty answer" }, { status: 400 });
  }
  const resolve = pendingAnswers.get(sid);
  if (!resolve) {
    return Response.json({ error: "Not awaiting an answer" }, { status: 409 });
  }
  resolve(answer);
  return Response.json({ ok: true });
}

function handleSolveAudio(request: Request): Response {
  const sid = ensureSession(request);
  const audio = solveAudio.get(sid);
  if (!audio) {
    return new Response("No audio captured yet", { status: 404 });
  }
  return new Response(audio.buf, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "x-audio-ts": String(audio.ts),
    },
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

  return new Response(
    solveWaitingPage(sid, publicOrigin(request), vncToken, target),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": sidCookieValue(sid),
      },
    }
  );
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

    // Seed cookies onto every archive TLD — the app uses archive.is while older
    // code only seeded .archive.ph, so Playwright often stayed cold despite a
    // warm jar used by /fetch (which sends Cookie headers without domain checks).
    const existing = Object.entries(archiveCookies).flatMap(([name, value]) =>
      ARCHIVE_COOKIE_DOMAINS.map((domain) => ({
        name,
        value,
        domain,
        path: "/",
      }))
    );
    if (existing.length) {
      await context.addCookies(existing);
    }

    const page: Page = await context.newPage();

    // reCAPTCHA on a flagged IP hands out brutal image challenges; the audio
    // fallback is the way through. VNC has no audio channel, so capture the
    // challenge mp3 as it's fetched and expose it via /solve-audio for the
    // operator to play in their own browser.
    page.on("response", (res) => {
      const url = res.url();
      const contentType = res.headers()["content-type"] || "";
      if (
        !contentType.startsWith("audio/") ||
        !/recaptcha|gstatic|google/i.test(url)
      ) {
        return;
      }
      void res
        .body()
        .then((buf) => {
          solveAudio.set(sid, { buf: new Uint8Array(buf), ts: Date.now() });
          console.log(
            `[archive-proxy] Captured reCAPTCHA audio (${buf.length}B) for ${sid}`
          );
        })
        .catch(() => undefined);
    });

    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log(`[archive-proxy] Solve started for ${sid} → ${target}`);

    // Escalating solve: auto (STT) → manual audio → noVNC. Any failure in the
    // driven path falls through to the universal wait below, where a human can
    // still finish it in noVNC — so this is never worse than the old flow.
    if (!(await hasArchiveContent(page))) {
      try {
        await driveRecaptcha(sid, page, context);
      } catch (error) {
        session.solveMode = "novnc";
        console.warn(
          `[archive-proxy] driven solve fell back to noVNC for ${sid}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Universal success gate — reached by the auto/manual solve OR a human in
    // noVNC. CAPTCHA pages don't have these markers.
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

    // Only keep archive-host cookies. Older builds dumped Google/reCAPTCHA
    // cookies into the shared jar and replayed them on every /fetch.
    const next: Record<string, string> = {};
    for (const cookie of await context.cookies()) {
      if (!isArchiveCookieDomain(cookie.domain)) continue;
      next[cookie.name] = cookie.value;
    }
    if (!Object.keys(next).length) {
      throw new Error("Solve finished but no archive cookies were captured");
    }

    const previous = { ...archiveCookies };
    replaceJar(next);

    // Prove the jar actually clears CAPTCHA via the same path /fetch uses —
    // Playwright content markers alone have produced false "done" states.
    const verified = await verifyJarCleared(target);
    if (!verified) {
      replaceJar(previous);
      jarCleared = false;
      throw new Error("Solve finished but archive still returns CAPTCHA");
    }
    jarCleared = true;

    session.solveStatus = "done";
    session.touchedAt = Date.now();
    console.log(
      `[archive-proxy] Captured ${Object.keys(next).length} archive cookies (jar=${Object.keys(archiveCookies).length}, verified) for ${sid}`
    );
  } catch (error) {
    session.solveStatus = "error";
    session.solveError =
      error instanceof Error ? error.message : "Failed to complete CAPTCHA";
    console.error("[archive-proxy] solve failed", error);
  } finally {
    pendingAnswers.get(sid)?.(null);
    await context?.close().catch(() => undefined);
  }
}

function isArchiveCookieDomain(domain: string): boolean {
  const host = domain.replace(/^\./, "").toLowerCase();
  return ARCHIVE_HOST_RE.test(host);
}

function replaceJar(next: Record<string, string>) {
  for (const key of Object.keys(archiveCookies)) delete archiveCookies[key];
  Object.assign(archiveCookies, next);
  saveCookies();
}

/** Re-fetch `target` with the shared jar; true when CAPTCHA is gone. */
async function verifyJarCleared(target: string): Promise<boolean> {
  try {
    const upstream = await proxyFollow(target, "GET", null, undefined, 5);
    const html = await upstream.text();
    const captcha = upstream.status === 429 || isCaptchaHtml(html);
    if (!captcha) persistCookies(upstream);
    return !captcha;
  } catch (error) {
    console.warn("[archive-proxy] jar verify failed", error);
    return false;
  }
}

/** True once the page shows real archive content (challenge cleared). */
async function hasArchiveContent(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
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
    })
    .catch(() => false);
}

/** Poll for cleared content up to `ms`. */
async function settledSuccess(page: Page, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await hasArchiveContent(page)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Drive reCAPTCHA v2 without noVNC: tick the checkbox, switch to the audio
 * challenge, then per attempt — transcribe automatically (tier 1) or ask the
 * operator to type what they hear (tier 2) — fill + verify. Throws to fall back
 * to noVNC (tier 3) on block or exhaustion.
 */
async function driveRecaptcha(
  sid: string,
  page: Page,
  context: BrowserContext
): Promise<void> {
  const session = getSession(sid);
  session.solveMode = "auto";

  const anchor = page.frameLocator(
    'iframe[title="reCAPTCHA"], iframe[src*="/recaptcha/api2/anchor"]'
  );
  await anchor.locator("#recaptcha-anchor").click({ timeout: 20000 });

  // Checkbox alone sometimes grants the token (no challenge).
  if (await settledSuccess(page, 4000)) return;

  const bframe = page.frameLocator(
    'iframe[title*="challenge"], iframe[src*="/recaptcha/api2/bframe"]'
  );
  await bframe.locator("#recaptcha-audio-button").click({ timeout: 20000 });

  for (let attempt = 0; attempt < 4; attempt++) {
    // Google blocks automated audio from flagged IPs — bail to noVNC.
    const blocked = await bframe
      .locator(".rc-doscaptcha-header")
      .isVisible()
      .catch(() => false);
    if (blocked) {
      session.solveMode = "novnc";
      throw new Error("reCAPTCHA blocked the audio challenge (automated queries)");
    }

    // Locate + fetch the audio clip (in-context request carries the session).
    const src =
      (await bframe
        .locator("#audio-source")
        .getAttribute("src", { timeout: 15000 })
        .catch(() => null)) ||
      (await bframe
        .locator(".rc-audiochallenge-tdownload-link")
        .getAttribute("href")
        .catch(() => null));

    if (src) {
      try {
        const res = await context.request.get(src);
        const buf = new Uint8Array(await res.body());
        solveAudio.set(sid, { buf, ts: Date.now() });
      } catch {
        // fall back to whatever the response hook captured
      }
    }
    const clip = solveAudio.get(sid)?.buf ?? null;

    // Tier 1: automatic transcription.
    let answer: string | null = null;
    if (clip) answer = await transcribeAudio(clip).catch(() => null);

    // Tier 2: hand the clip to the operator and wait for their typed answer.
    if (!answer) {
      session.solveMode = "manual-audio";
      session.solveStatus = "awaiting-answer";
      answer = await waitForAnswer(sid, 4 * 60 * 1000);
      session.solveStatus = "solving";
    }
    if (!answer) throw new Error("no audio answer provided");

    await bframe.locator("#audio-response").fill(answer, { timeout: 10000 });
    await bframe.locator("#recaptcha-verify-button").click({ timeout: 10000 });

    if (await settledSuccess(page, 6000)) return;
    // Wrong/expired → reCAPTCHA serves a fresh clip; loop and try again.
    session.solveMode = OPENAI_API_KEY ? "auto" : "manual-audio";
  }

  throw new Error("exhausted audio attempts");
}

/** Wait for /solve-answer to deliver the operator's typed answer, or time out. */
function waitForAnswer(sid: string, ms: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAnswers.delete(sid);
      resolve(null);
    }, ms);
    pendingAnswers.set(sid, (answer) => {
      clearTimeout(timer);
      pendingAnswers.delete(sid);
      resolve(answer);
    });
  });
}

/** Tier-1 STT via Whisper. Returns null when no key is set or the call fails. */
async function transcribeAudio(buf: Uint8Array): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", TRANSCRIBE_MODEL);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  const text = (data.text || "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return text || null;
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

function websiteFromArchiveTarget(target: string): string {
  try {
    const path = new URL(target).pathname;
    const embedded = path.match(/https?:\/\/[^/]+/i)?.[0];
    if (embedded) {
      return new URL(embedded).hostname.replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  return "unknown";
}

function solveWaitingPage(
  sid: string,
  origin: string,
  vncToken: string,
  target: string
): string {
  // Tiered solve UI:
  //   auto         → the server drives reCAPTCHA + transcribes; just wait.
  //   manual-audio → play the captured clip, type what you hear, submit.
  //   novnc        → last resort: drive the real browser (gated, no password).
  const wsPath = encodeURIComponent(`vnc/websockify/${vncToken}`);
  const vncSrc = VNC_INTERNAL
    ? `${origin}/vnc/vnc.html?autoconnect=1&resize=remote&reconnect=1&path=${wsPath}`
    : VNC_URL || "";
  const novncIframe = vncSrc
    ? `<iframe class="vnc" id="vncframe" src="${vncSrc}" allow="clipboard-read; clipboard-write"></iframe>`
    : `<p class="hint">A Chrome window should open on this machine — solve it there.</p>`;
  const website = websiteFromArchiveTarget(target);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payless — unlocking article</title>
  <script defer src="https://addless-share-worker.lvdw.workers.dev/script.js"
    data-website-id="68fd502a-c9e4-4a63-a9a8-5ad1c14a0ac9"
    data-host="https://addless-share-worker.lvdw.workers.dev"
    data-auto-track="false"></script>
  <style>
    body { font-family: Georgia, serif; background: #f4f2ec; color: #2a2438; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
    header { padding: 1.25rem 1.25rem 0.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .wrap { flex: 1; display: flex; flex-direction: column; }
    section { padding: 0.75rem 1.25rem; text-align: center; }
    .hidden { display: none !important; }
    .hint { margin: 0.5rem auto; color: #5b5368; font-size: 0.85rem; max-width: 30rem; }
    .spinner { width: 34px; height: 34px; margin: 1rem auto; border: 3px solid #d9d3c7; border-top-color: #2a2438; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    audio { width: 100%; max-width: 420px; margin: 0.5rem 0; }
    .answer { display: flex; gap: 0.5rem; max-width: 420px; margin: 0.5rem auto; }
    .answer input { flex: 1; padding: 0.6rem 0.7rem; font-size: 1rem; border: 1px solid #c8c1b3; border-radius: 8px; }
    button { padding: 0.6rem 1rem; font-size: 0.95rem; border: 0; border-radius: 8px; background: #2a2438; color: #fff; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .link { background: none; color: #5b5368; text-decoration: underline; padding: 0.4rem; font-size: 0.8rem; }
    .vnc { flex: 1; width: 100%; border: 0; min-height: 60vh; }
    .status { padding: 0.75rem 1.25rem 1rem; text-align: center; font-family: ui-monospace, monospace; font-size: 0.8rem; color: #5b5368; }
    .ok { color: #0f7a45; } .err { color: #a12626; } .ready { color: #0f7a45; font-weight: bold; }
  </style>
</head>
<body>
  <header><h1>Unlocking your article</h1></header>
  <div class="wrap">
    <section id="auto">
      <div class="spinner"></div>
      <p class="hint">Solving the CAPTCHA automatically… this is usually quick.</p>
    </section>

    <section id="manual" class="hidden">
      <p class="hint ready">Couldn't auto-solve — listen and help out. Press play, then type what you hear.</p>
      <audio id="capaudio" controls preload="none"></audio>
      <form class="answer" id="answerForm">
        <input id="answerInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type what you hear" />
        <button type="submit" id="answerBtn">Submit</button>
      </form>
      <p class="hint" id="manualMsg"></p>
    </section>

    <section id="novnc" class="hidden" style="flex:1; display:flex; flex-direction:column;">
      <p class="hint">Manual mode — solve the reCAPTCHA in the browser view below.</p>
      ${novncIframe}
    </section>

    <button type="button" class="link" id="revealVnc">Trouble? Solve it manually in a browser</button>
  </div>
  <p class="status" id="status">Starting…</p>

  <script>
    const sid = ${JSON.stringify(sid)};
    const website = ${JSON.stringify(website)};
    const startedAt = Date.now();
    const $ = (id) => document.getElementById(id);
    const statusEl = $('status');
    const secAuto = $('auto'), secManual = $('manual'), secVnc = $('novnc');
    const audioEl = $('capaudio'), manualMsg = $('manualMsg');
    const answerForm = $('answerForm'), answerInput = $('answerInput'), answerBtn = $('answerBtn');
    let lastAudioTs = '', vncForced = false, currentMode = 'auto', terminal = false;
    const queue = [];

    function track(name, data) {
      const payload = Object.assign({ website: website }, data || {});
      if (window.umami) {
        try { window.umami.track(name, payload); } catch (e) {}
        return;
      }
      queue.push([name, payload]);
    }

    (function waitUmami(attempts) {
      if (window.umami) {
        while (queue.length) {
          const item = queue.shift();
          try { window.umami.track(item[0], item[1]); } catch (e) {}
        }
        return;
      }
      if (attempts < 40) setTimeout(function () { waitUmami(attempts + 1); }, 250);
    })(0);

    function noteMode(mode) {
      if (terminal || mode === currentMode) return;
      currentMode = mode;
      track('captcha solve mode', { mode: mode, forced: mode === 'novnc' && vncForced });
    }

    function show(which) {
      // UI sections: auto | manual | novnc  — analytics modes match server tiers.
      const mode = which === 'manual' ? 'manual-audio' : which;
      noteMode(mode);
      secAuto.classList.toggle('hidden', which !== 'auto');
      secManual.classList.toggle('hidden', which !== 'manual');
      secVnc.classList.toggle('hidden', which !== 'novnc');
    }

    track('captcha solve open', { mode: 'auto' });

    $('revealVnc').addEventListener('click', () => {
      vncForced = true;
      track('captcha vnc forced', { from: currentMode });
      show('novnc');
    });

    answerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const answer = answerInput.value.trim();
      if (!answer) return;
      answerBtn.disabled = true;
      manualMsg.textContent = 'Checking…';
      track('captcha audio submit', { mode: 'manual-audio' });
      try {
        const res = await fetch('/solve-answer?sid=' + encodeURIComponent(sid), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ answer }),
        });
        if (res.ok) { answerInput.value = ''; manualMsg.textContent = 'Submitted — verifying…'; }
        else { manualMsg.textContent = 'Not ready for an answer yet, hang on…'; }
      } catch (err) { manualMsg.textContent = 'Network hiccup — try again.'; }
      answerBtn.disabled = false;
    });

    async function loadAudioIfNew() {
      try {
        const res = await fetch('/solve-audio?sid=' + encodeURIComponent(sid), { cache: 'no-store' });
        if (!res.ok) return;
        const ts = res.headers.get('x-audio-ts') || '';
        if (ts && ts !== lastAudioTs) {
          lastAudioTs = ts;
          audioEl.src = URL.createObjectURL(await res.blob());
          track('captcha audio ready', { mode: 'manual-audio' });
        }
      } catch (e) {}
    }

    async function poll() {
      try {
        const res = await fetch('/solve-status?sid=' + encodeURIComponent(sid));
        const data = await res.json();
        if (data.status === 'done') {
          if (!terminal) {
            terminal = true;
            track('captcha solve done', { mode: currentMode, ms: Date.now() - startedAt, forced: vncForced });
          }
          show('auto');
          statusEl.textContent = 'Done — return to Payless, the article is loading.';
          statusEl.className = 'status ok';
          // Wake the Payless tab (popup) so it retries without a manual refresh.
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'payless-captcha-done', sid: sid }, '*');
            }
          } catch (e) {}
          setTimeout(() => { try { window.close(); } catch (e) {} }, 1500);
          return;
        }
        if (data.status === 'error') {
          if (!terminal) {
            terminal = true;
            track('captcha solve error', {
              mode: currentMode,
              ms: Date.now() - startedAt,
              error: (data.error || 'unknown').slice(0, 120),
            });
          }
          statusEl.textContent = data.error || 'Something went wrong. Close this and retry.';
          statusEl.className = 'status err';
          return;
        }
        const awaiting = data.status === 'awaiting-answer' || data.mode === 'manual-audio';
        if (vncForced || data.mode === 'novnc') { show('novnc'); }
        else if (awaiting) { show('manual'); await loadAudioIfNew(); }
        else { show('auto'); }
        statusEl.textContent = data.warm
          ? 'Working… session already cleared, confirming…'
          : 'Working… (' + (data.cookieCount || 0) + ' cookies)';
      } catch (e) {
        statusEl.textContent = 'Still working…';
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

  const headers = new Headers();
  headers.append("set-cookie", sidCookieValue(sid));

  if (upstream.status >= 300 && upstream.status < 400) {
    // Redirects are part of a cleared navigation — safe to keep their cookies.
    persistCookies(upstream);
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
    const captcha = upstream.status === 429 || isCaptchaHtml(html);
    if (captcha) {
      jarCleared = false;
    } else {
      persistCookies(upstream);
      jarCleared = true;
    }
    html = rewriteArchiveHtml(html, targetUrl.origin, pub, sid);
    return new Response(html, { status: upstream.status, headers });
  }

  persistCookies(upstream);
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

  while (redirectsLeft > 0 && response.status >= 300 && response.status < 400) {
    // Keep cookies from redirect hops; the caller decides whether to persist
    // the final response (skipped when that response is still a CAPTCHA).
    persistCookies(response);
    const location = response.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!isAllowedArchiveUrl(next)) break;
    current = next;
    redirectsLeft -= 1;
    response = await proxyRequest(current, "GET", null, incomingHeaders);
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

/** Drop Google/reCAPTCHA cookies older builds accidentally stored in the jar. */
const NON_ARCHIVE_COOKIE_NAME =
  /^(NID|__Secure-|__Host-|1P_JAR|AEC|OGPC|APISID|SAPISID|HSID|SSID|SID$|SIDCC|ACCOUNT_CHOOSER|SEARCH_SAMESITE|OTZ|ANID|COMPASS|GAPS)/i;

function loadCookies() {
  if (!COOKIE_STORE_PATH) return;
  try {
    const text = readFileSync(COOKIE_STORE_PATH, "utf8");
    const parsed = JSON.parse(text) as Record<string, string>;
    let skipped = 0;
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value !== "string") continue;
      if (NON_ARCHIVE_COOKIE_NAME.test(name)) {
        skipped += 1;
        continue;
      }
      archiveCookies[name] = value;
    }
    console.log(
      `[archive-proxy] Loaded ${Object.keys(archiveCookies).length} cookies from ${COOKIE_STORE_PATH}` +
        (skipped ? ` (dropped ${skipped} non-archive)` : "")
    );
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

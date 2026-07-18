type Env = {
  SESSIONS: KVNamespace;
};

type Session = {
  cookies: Record<string, string>;
};

const SID_COOKIE = "payless_archive_sid";
const SESSION_TTL_SECONDS = 60 * 60;
const ARCHIVE_HOST_RE = /^archive\.(is|ph|today|vn|fo)$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), request);
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/session") {
        return cors(await createSession(request, env), request);
      }

      if (url.pathname === "/fetch") {
        return cors(await handleFetch(request, env), request);
      }

      if (url.pathname === "/challenge") {
        return await handleChallenge(request, env);
      }

      return cors(
        Response.json({ error: "Not found" }, { status: 404 }),
        request
      );
    } catch (error) {
      console.error(error);
      return cors(
        Response.json(
          { error: error instanceof Error ? error.message : "Proxy error" },
          { status: 500 }
        ),
        request
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function createSession(request: Request, env: Env): Promise<Response> {
  const existing = getSid(request);
  const sid = existing || crypto.randomUUID();
  if (!existing) {
    await saveSession(env, sid, { cookies: {} });
  }

  return withSidCookie(
    Response.json({ sid }),
    sid
  );
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const sid = await ensureSession(request, env);
  const target = new URL(request.url).searchParams.get("url");

  if (!target || !isAllowedArchiveUrl(target)) {
    return Response.json({ error: "Invalid archive url" }, { status: 400 });
  }

  const session = await loadSession(env, sid);
  const upstream = await proxyFollow(
    env,
    sid,
    target,
    "GET",
    null,
    session,
    undefined,
    5
  );
  const html = await upstream.text();

  const captcha = upstream.status === 429 || isCaptchaHtml(html);

  const challengeUrl = captcha
    ? new URL(
        `/challenge?url=${encodeURIComponent(target)}&sid=${encodeURIComponent(sid)}`,
        new URL(request.url).origin
      ).toString()
    : null;

  return withSidCookie(
    Response.json({
      status: upstream.status,
      captcha,
      html,
      sid,
      challengeUrl,
    }),
    sid
  );
}

async function handleChallenge(
  request: Request,
  env: Env
): Promise<Response> {
  const sid = await ensureSession(request, env);
  const incoming = new URL(request.url);
  const targetParam = incoming.searchParams.get("url");

  if (!targetParam || !isAllowedArchiveUrl(targetParam)) {
    return new Response("Invalid archive url", { status: 400 });
  }

  const targetUrl = new URL(targetParam);
  // Preserve extra query params from archive (captcha posts etc.) when nested.
  for (const [key, value] of incoming.searchParams) {
    if (key === "url") continue;
    targetUrl.searchParams.set(key, value);
  }

  const session = await loadSession(env, sid);
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
  await persistCookies(env, sid, session, upstream);

  const headers = new Headers();
  headers.append(
    "set-cookie",
    sidCookieValue(sid)
  );

  // Redirects must stay inside the proxy so the session keeps archive cookies.
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
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );
  headers.set(
    "accept",
    incomingHeaders?.get("accept") ||
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  );

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
  env: Env,
  sid: string,
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
  await persistCookies(env, sid, session, response);

  while (
    redirectsLeft > 0 &&
    response.status >= 300 &&
    response.status < 400
  ) {
    const location = response.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!isAllowedArchiveUrl(next)) break;
    current = next;
    redirectsLeft -= 1;
    response = await proxyRequest(
      current,
      "GET",
      null,
      session,
      incomingHeaders
    );
    await persistCookies(env, sid, session, response);
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

  let rewritten = html;
  rewritten = rewritten.replace(
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

  // Help the challenge page fit mobile popup / in-app use.
  if (!/name=["']viewport["']/i.test(rewritten)) {
    rewritten = rewritten.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />`
    );
  }

  return rewritten;
}

function isCaptchaHtml(html: string): boolean {
  return /g-recaptcha|h-?captcha|cdn-cgi\/l\/chk_captcha|complete the captcha/i.test(
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

async function ensureSession(request: Request, env: Env): Promise<string> {
  const existing = getSid(request);
  if (existing) {
    const session = await env.SESSIONS.get(existing);
    if (session) return existing;
    // Accept client-provided sid even if KV expired; recreate jar.
    await saveSession(env, existing, { cookies: {} });
    return existing;
  }
  const sid = crypto.randomUUID();
  await saveSession(env, sid, { cookies: {} });
  return sid;
}

function getSid(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get("sid");
  if (fromQuery) return fromQuery;

  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SID_COOKIE}=([^;]+)`));
  return match?.[1] || null;
}

function sidCookieValue(sid: string): string {
  return `${SID_COOKIE}=${sid}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=None`;
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

async function loadSession(env: Env, sid: string): Promise<Session> {
  const raw = await env.SESSIONS.get(sid);
  if (!raw) return { cookies: {} };
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return { cookies: {} };
  }
}

async function saveSession(
  env: Env,
  sid: string,
  session: Session
): Promise<void> {
  await env.SESSIONS.put(sid, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

async function persistCookies(
  env: Env,
  sid: string,
  session: Session,
  response: Response
): Promise<void> {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  const setCookies =
    getSetCookie && getSetCookie.length > 0
      ? getSetCookie
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

  if (setCookies.length === 0) return;

  for (const item of setCookies) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    session.cookies[name] = value;
  }

  await saveSession(env, sid, session);
}

function cors(response: Response, request: Request): Response {
  const origin = request.headers.get("origin") || "*";
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set(
    "access-control-allow-headers",
    request.headers.get("access-control-request-headers") ||
      "content-type"
  );
  headers.set("vary", "origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

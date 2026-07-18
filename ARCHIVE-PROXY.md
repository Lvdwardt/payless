# Archive proxy

Server-side archive.today fetcher with a shared cookie jar + a real Chromium you
solve CAPTCHAs in. Exists because the browser can't do this itself: archive sends
`Access-Control-Allow-Origin: *`, so a cross-origin `fetch` from the app is
refused permission to carry the archive cookies you earn by solving the CAPTCHA.
The fetch has to happen server-side.

## Why the VPS (and the catch)

archive.today `429`s datacenter **and** commercial-VPN IPs. Tested from the VPS:
raw IP and all Surfshark exits (FR/US/UK/DE) → `429 + reCAPTCHA`. Only residential
IPs pass clean.

But the VPS isn't hard-banned — `archive.ph/` returns `200`, only content fetches
get challenged, and a `429` sets `qki=…; Max-Age=3600`. Solving the reCAPTCHA
**once from the VPS** clears that cookie → archive serves content for a warm
window (~1h, shorter on a flagged IP). Re-solve when it goes cold. That's the
whole model: one shared jar, warmed by one solve, used by every device.

## Local dev

`bun run dev` starts the app + proxy (`scripts/dev.ts`). CAPTCHA → a Chromium
window opens on your screen; solve the checkbox, the article loads. Cookie jar is
in-memory unless `COOKIE_STORE_PATH` is set.

## Production (VPS via Coolify)

Runs as its **own** Coolify resource — does not touch other services on the box.

1. **New Resource → Docker Compose**, point at this repo + `docker-compose.archive-proxy.yml`.
2. **Env vars:**
   - `VNC_PASSWORD` — **required.** Without it, anyone reaching the noVNC URL can
     drive the browser on your VPS.
   - `PUBLIC_VNC_URL` — the noVNC page, e.g.
     `https://archive.fly-n.nl/vnc.html?autoconnect=1&resize=remote&reconnect=1`
3. **Domains → container ports** (Coolify issues TLS for both):
   - `archive.fly-n.nl` → `8788` (proxy API — the app talks here)
   - `archive.fly-n.nl` → `6080` (noVNC solve UI, embedded in the solve page)
4. **Deploy.** `git push` → CI/Coolify builds the image.

Cookie jar persists to the `archive-data` volume (`/data/cookies.json`), so it
stays warm across restarts.

### Point the app at it

Set in the **Vercel** project (build-time, Vite inlines it), then redeploy:

```
VITE_ARCHIVE_PROXY_URL=https://archive.fly-n.nl
```

### Warm it once

Open a paywalled article in the app → tap the CAPTCHA prompt → the solve page
opens with the VPS browser embedded (noVNC) → tap the reCAPTCHA. The app's
silent-retry loop then loads the cleaned article. Every device stays warm until
the `qki` cookie expires.

## Endpoints

| Path | Purpose |
|---|---|
| `GET /session` | Issue a session id (`sid`). |
| `GET /fetch?url=&sid=` | Fetch archive HTML via the jar. Returns `{status, captcha, html, challengeUrl}`. |
| `GET /solve?url=&sid=` | Solve page (embeds noVNC in prod). Drives Chromium to the challenge. |
| `GET /solve-status?sid=` | Poll `idle\|solving\|done\|error` + cookie count + `warm`. |
| `GET /challenge?url=&sid=` | Reverse-proxy an archive page (link-rewritten) — used inside the solve flow. |
| `GET /health` | `{ok, cookies, warm}`. |

## Env reference

| Var | Default | Notes |
|---|---|---|
| `ARCHIVE_PROXY_PORT` | `8788` | Proxy API port. |
| `COOKIE_STORE_PATH` | _(unset)_ | Persist jar to this path. Container: `/data/cookies.json`. |
| `CROSS_SITE` | auto (`1` when `VNC_URL` set) | `sid` cookie `SameSite=None; Secure` for Vercel→VPS. |
| `VNC_URL` | _(unset)_ | Public noVNC URL embedded in the solve page. |
| `VNC_PASSWORD` | _(unset)_ | VNC auth. Required in production. |
| `CHROME_PATH` | _(unset)_ | Override Chromium binary; base image auto-detects. |

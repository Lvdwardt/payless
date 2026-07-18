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

Runs as its **own** Coolify resource — does not touch the cruisello workers.

1. **New Resource → Docker Compose**, point at this repo + `docker-compose.archive-proxy.yml`.
2. **Env vars:** none required — `VNC_INTERNAL=1` is in the compose file. No
   `VNC_PASSWORD`, no `PUBLIC_VNC_URL`.
3. **One domain → one port** (Coolify issues TLS):
   - `archive.cruisello.com` → `8788` (proxy API **and** same-origin noVNC)
   - Do **not** map `archive-vnc.*` — there is no separate VNC domain.
4. **Deploy.** `git push` → CI/Coolify builds the image.

### noVNC lockdown (no password, gated to Payless)

noVNC is not a public door. `x11vnc`/`websockify` bind **loopback only**; the proxy
serves noVNC same-origin under `/vnc/*` and only opens the websocket
(`/vnc/websockify/<token>`) when the token is unexpired **and** its solve session
is still `solving`. The token is minted per `/solve` and embedded in the solve
page — so noVNC is reachable only during a real, app-initiated solve, and there is
no password prompt.

Cookie jar persists to the `archive-data` volume (`/data/cookies.json`), so it
stays warm across restarts.

### Point the app at it

Set in the **Vercel** project (build-time, Vite inlines it), then redeploy:

```
VITE_ARCHIVE_PROXY_URL=https://archive.cruisello.com
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
| `GET /solve?url=&sid=` | Tiered solve page (auto → audio+input → noVNC). Drives reCAPTCHA server-side. |
| `GET /solve-status?sid=` | Poll `idle\|solving\|awaiting-answer\|done\|error` + `mode` + `audioTs` + cookies + `warm`. |
| `GET /solve-audio?sid=` | The captured reCAPTCHA audio clip (`audio/mpeg`), for the operator to play. |
| `POST /solve-answer?sid=` | Body `{answer}` — the operator's transcription of the audio (tier 2). |
| `GET /challenge?url=&sid=` | Reverse-proxy an archive page (link-rewritten) — used inside the solve flow. |
| `GET /vnc/*` | Same-origin noVNC static (proxied from loopback websockify) — tier-3 fallback. |
| `WS /vnc/websockify/<token>` | Gated VNC bridge — only opens for a live solve token. |
| `GET /health` | `{ok, cookies, warm}`. |

### Solve tiers

The `/solve` flow escalates automatically, worst case falling through to noVNC —
so it is never worse than a manual solve:

1. **Auto** — the server ticks the reCAPTCHA checkbox, switches to the audio
   challenge, and (if `OPENAI_API_KEY` is set) transcribes the clip with Whisper
   and submits it. No operator interaction.
2. **Manual audio** — if there's no key or transcription fails, the solve page
   plays the captured clip and takes a typed answer (`/solve-answer`), which the
   server fills into reCAPTCHA and verifies.
3. **noVNC** — if reCAPTCHA blocks the audio path (automated-queries), the gated
   same-origin browser view opens for a fully manual solve.

## Env reference

| Var | Default | Notes |
|---|---|---|
| `ARCHIVE_PROXY_PORT` | `8788` | Proxy API port. |
| `COOKIE_STORE_PATH` | _(unset)_ | Persist jar to this path. Container: `/data/cookies.json`. |
| `CROSS_SITE` | auto (`1` when `VNC_INTERNAL`/`VNC_URL` set) | `sid` cookie `SameSite=None; Secure` for Vercel→VPS. |
| `VNC_INTERNAL` | _(unset)_ | `1` = serve + gate noVNC same-origin through the proxy (production default). No password, no public VNC port. |
| `NOVNC_PORT` | `6080` | Loopback port websockify listens on inside the container. |
| `VNC_URL` | _(unset)_ | Legacy: external noVNC URL embedded in the solve page. Superseded by `VNC_INTERNAL`. |
| `OPENAI_API_KEY` | _(unset)_ | Enables tier-1 auto-transcription (Whisper) of the audio challenge. Unset = skip to manual audio. |
| `TRANSCRIBE_MODEL` | `whisper-1` | STT model used when `OPENAI_API_KEY` is set. |
| `CHROME_PATH` | _(unset)_ | Override Chromium binary; base image auto-detects. |

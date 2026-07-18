# Task: Deploy the payless archive proxy to the VPS via Coolify

You have the **Coolify MCP server**. Deploy the already-built archive proxy as a
new, isolated Coolify resource on the existing VPS. Do **not** touch the running
cruisello backend workers or monitoring stack on the same box.

## Background (why this exists)

payless cleans paywalled articles via archive.today. archive `429`s datacenter +
commercial-VPN IPs and its reCAPTCHA is server-validated (no client bypass). The
browser can't fetch archive directly either — archive sends
`Access-Control-Allow-Origin: *`, so cross-origin credentialed fetch is refused,
i.e. the app can't carry the cookie you earn by solving the CAPTCHA. So the fetch
runs server-side with a shared cookie jar, and CAPTCHAs are solved once in a real
Chromium (headful under Xvfb) reached via noVNC.

Warm-cookie model: a `429` sets `qki=…; Max-Age=3600`. Solve once from the VPS
egress IP → archive serves content for ~1h (maybe less on a flagged IP) → re-solve
when cold. Cookie is IP-bound, so it must be solved from the same IP that fetches.

Full detail: `ARCHIVE-PROXY.md` in repo root.

## Already done (in this repo, not yet committed)

- `server/archive-proxy.ts` — refactored: shared cookie jar, disk persistence,
  container Chromium, noVNC solve page, cross-site cookies. Smoke-tested locally.
- `Dockerfile.archive-proxy` — Playwright 1.61.1 base + Xvfb + fluxbox + x11vnc +
  noVNC + Bun. (Image tag matches `playwright-core@1.61.1` — do not bump one
  without the other or Chromium won't launch.)
- `docker/archive-proxy-entrypoint.sh` — boots Xvfb → x11vnc → websockify → proxy.
- `docker-compose.archive-proxy.yml` — the Coolify Compose file. Ports 8788 (API)
  + 6080 (noVNC), `/data` volume for the jar, `shm_size: 1gb`.
- `.dockerignore`, `ARCHIVE-PROXY.md`.

**First: commit these on a branch and push** (Coolify builds from git). Confirm
with the user before committing if unsure.

## VPS / infra facts

- Host: `89.144.30.194` (root SSH, keys configured). Runs cruisello via Coolify.
- Deploy pattern on this box: git push → CI builds image → Coolify redeploys.
  For this proxy, the compose uses `build:` so Coolify clones payless + builds.
- 15GB RAM, 4 cores, ~6GB free. Chromium needs ~0.5–1GB.

## Steps (Coolify MCP)

1. **DNS first** (may be manual / ask user): A records →
   - `archive.cruisello.com` → `89.144.30.194`
   - `archive-vnc.cruisello.com` → `89.144.30.194`
2. **Create resource:** new Docker Compose resource from the payless repo,
   compose file `docker-compose.archive-proxy.yml`. Its own project/stack —
   isolated from cruisello.
3. **Env vars** on the resource:
   - `VNC_PASSWORD` = <generate a strong value> — **required.** Without it noVNC
     is unauthenticated = anyone can drive the browser on the VPS. Tell the user
     the value.
   - `PUBLIC_VNC_URL` = `https://archive-vnc.cruisello.com/vnc.html?autoconnect=1&resize=remote&reconnect=1`
   - (`CROSS_SITE=1`, `COOKIE_STORE_PATH=/data/cookies.json` are already in the
     compose file — no action.)
4. **Domains → ports** (Coolify issues TLS):
   - `archive.cruisello.com` → container port `8788`
   - `archive-vnc.cruisello.com` → container port `6080`
5. **Deploy.** Watch the build (first build pulls the ~2GB Playwright base, slow).
6. **Confirm isolation:** cruisello workers + monitoring still running, untouched.

## Verify

- `curl https://archive.cruisello.com/health` → `{"ok":true,"cookies":0,"warm":false}`
- `https://archive-vnc.cruisello.com/vnc.html` loads noVNC (prompts for VNC_PASSWORD).
- CORS: `curl -sI -H 'Origin: https://<vercel-app>' https://archive.cruisello.com/health`
  → `access-control-allow-origin` echoes the origin + `allow-credentials: true`.

## Hand back to user (not Coolify)

- Set in **Vercel** project: `VITE_ARCHIVE_PROXY_URL=https://archive.cruisello.com`
  (build-time — must redeploy the frontend after).
- **Warm once:** open a paywalled article in the app → tap CAPTCHA prompt → solve
  in the embedded noVNC → article loads. Every device warm until `qki` expires.

## Watch out

- If Chromium fails to launch in the container: check `--no-sandbox` is applied
  (it is, in `getBrowser()`), `shm_size: 1gb` is set, and
  `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` is present (from base image).
- If the `sid` cookie is dropped cross-site: confirm `CROSS_SITE=1` (cookie must
  be `SameSite=None; Secure`). Non-blocking — `sid` is also passed as a query param.
- **Empirical unknown:** measure how long the warm window actually holds on this
  VPS IP after the first solve. If it goes cold in minutes (not ~1h), escalate to
  the user — fallback is a residential proxy in front of the fetch.

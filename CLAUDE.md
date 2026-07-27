# Payless

Vite + React PWA that strips paywalls, plus a server-side archive.today fetcher
(`server/archive-proxy.ts`) that runs on a VPS. Two deploy targets, one codebase.

## Branches — read this first

**`main` is the only branch you commit to.** All work happens here: frontend and
proxy alike. Branch off `main`, PR back into `main`.

**`deploy/archive-proxy` is a release pointer, not a place to work.** It exists
only so pushing frontend changes doesn't rebuild the VPS container (the image
carries Chromium — the build is slow and it restarts the shared cookie jar,
which drops the warm archive session).

The rule that keeps it unconfusing:

> `deploy/archive-proxy` only ever fast-forwards to a commit that is already on
> `main`. Never commit to it. Never merge into it. Nothing exists there that
> isn't on `main`.

So if you're changing the proxy, edit `server/archive-proxy.ts` on `main` like
any other file. `main` is always the current source of truth — including for
what's running in production.

### Releasing the proxy

```bash
git push origin main:deploy/archive-proxy   # fast-forward only; never --force
```

If that push is rejected as non-fast-forward, someone broke the rule and
committed to the deploy branch directly. Don't force it — merge that commit into
`main` first, then release again.

## Deploy targets

| Target | Watches | Deploys |
|---|---|---|
| Vercel | `main` | The PWA. `VITE_ARCHIVE_PROXY_URL` is build-time — changing it needs a redeploy. |
| Coolify (VPS) | `deploy/archive-proxy` | `docker-compose.archive-proxy.yml` — the proxy + Chromium + gated noVNC. |

## Where things are

- `ARCHIVE-PROXY.md` — why the proxy exists, the warm-cookie model, endpoints, env vars, Coolify setup. Read it before touching `server/archive-proxy.ts`.
- `.cursor/rules/project-conventions.mdc` — frontend conventions (TypeScript, Tailwind, shadcn/ui, PWA).
- `plans/`, `tasks/` — design notes and runbooks.

## Commands

```bash
bun run dev     # app + proxy together (scripts/dev.ts)
bun run build   # tsc -b && vite build
bun test
bun run lint
```

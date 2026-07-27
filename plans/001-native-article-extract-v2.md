# Plan 001: Add native article extract v2 with legacy toggle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat eaa1500..HEAD -- src/utils/getArticle.ts src/hooks/useArticle.ts src/components/article-reader.tsx src/App.tsx src/types/article.ts src/data/sites/multiple/dpg.ts src/data/sites/multiple/mediahuis.ts src/i18n.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `eaa1500`, 2026-07-18

## Why this matters

Payless currently “cleans” archived publisher HTML with brittle per-site CSS selectors (`removeRules` / `alterRules`) and then injects that foreign markup into the page. That fights layout with `html { zoom }` and forces font changes via `location.reload()`. Native extraction (Reader Mode–style) turns archive HTML into a structured article and renders it with Payless UI — truly native reading — while keeping the legacy zap pipeline for hosts not yet migrated. A localStorage toggle lets users compare v1 vs v2 without a deploy flag.

## Current state

Relevant files:

- `src/utils/getArticle.ts` — fetches archive HTML, applies `allSitesRules` + per-host `sites` rules, returns sanitized HTML string
- `src/hooks/useArticle.ts` — orchestrates archive link → `getArticle` → `ArticleState`
- `src/components/article-reader.tsx` — injects HTML via `dangerouslySetInnerHTML`, zoom-fit, font selects that reload the page
- `src/App.tsx` — `useLocalStorageState("font", …)` already used for preferences
- `src/data/sites/multiple/dpg.ts` — legacy rules for AD and sister titles
- `src/data/sites/multiple/mediahuis.ts` — legacy rules for Telegraaf and sister titles
- `src/types/article.ts` — `ArticleResult` / `ArticleState` are HTML-string oriented
- `package.json` — Bun; deps include `node-html-parser`, `isomorphic-dompurify`, `use-local-storage-state`; **no test runner script yet**
- Fixtures (already captured): `plans/fixtures/articles/` — see that folder’s `README.md`

Excerpt — legacy pipeline entry (`getArticle.ts`):

```49:71:src/utils/getArticle.ts
  const root = parse(data);
  const content = root.querySelector("#CONTENT") as unknown as HTMLElement;

  if (!content) {
    return {
      status: "error",
      message: "Archived article content was not found.",
    };
  }

  updateFontsizes(content, font);
  fixImages(content, baseURL);
  applyRules(allSitesRules, content);

  if (site in sites) {
    const rules = sites[site];
    applyRules(rules, content);
  }

  return {
    status: "ok",
    html: DOMPurify.sanitize(content.toString()),
  };
```

Excerpt — ready state is HTML-only (`useArticle.ts`):

```54:58:src/hooks/useArticle.ts
  return {
    status: "ready",
    html: article.html,
    archiveLink: archiveLink.link,
  };
```

Excerpt — preference pattern to copy (`App.tsx`):

```10:16:src/App.tsx
function App() {
  const [font, setFont] = useLocalStorageState<Font>("font", {
    defaultValue: {
      scale: 1,
      height: undefined,
    },
  });
```

**Repo conventions to match:**

- Bun package manager (`bun add`, `bun test`, `bun run lint`)
- Path alias `@/` → `src/`
- kebab-case filenames; named exports for utilities; function components
- i18n strings in `src/i18n.ts` (en + nl)
- Do **not** run `bun run dev` or `bun run build` (operator preference). Use `bunx tsc -b --pretty false`, `bun run lint`, and `bun test` for verification.

**Fixture facts the extractor must satisfy** (from `plans/fixtures/articles/README.md`):

| Host family | Sample | Article root hint | Body shape | Strip |
|-------------|--------|-------------------|------------|-------|
| DPG | AD huwelijk fixture | `#article-content` | divs @ ~18px, real `<h1>`, figures | related cards / premium chrome |
| Mediahuis | Telegraaf gardameer (`archive.ph/X1pCt`) | `#__next` / `<main>` | div text near `<h1>` | `Hier staat ingevoegde content…` embeds |

Telegraaf product URL is archived at `https://archive.ph/X1pCt` (fixtures: `telegraaf-gardameer.*.html`). Migration list must include `www.telegraaf.nl`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install deps | `bun add @mozilla/readability` and `bun add -d @types/mozilla-readability linkedom` (if types package missing, skip types and declare minimal module ambient) | exit 0; lockfile updated |
| Typecheck | `bunx tsc -b --pretty false` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test` | all pass |
| Fixture presence | `ls plans/fixtures/articles/*.content.html` | both AD + Telegraaf content fixtures listed |

## Suggested executor toolkit

- If available, run `react-doctor` after the React UI steps (native reader + toggle).
- Readability reference: https://github.com/mozilla/readability — use `DOMParser` in the browser; use `linkedom`’s `parseHTML` inside `bun test` only.

## Scope

**In scope** (create/modify):

- `package.json` (add deps + `"test": "bun test"` script)
- `src/types/article.ts` — extend result/state for native mode
- `src/types/reader-experience.ts` — `"legacy" \| "native"` (new)
- `src/data/nativeSites.ts` — migrated host allowlist + optional hints (new)
- `src/utils/extractNativeArticle.ts` — extractor (new)
- `src/utils/getNativeArticle.ts` — fetch + extract orchestration (new)
- `src/utils/getArticle.ts` — leave behavior intact; may export shared helpers (`fixImages` equivalent) only if needed without changing default export semantics
- `src/hooks/useArticle.ts` — branch on experience + migration
- `src/hooks/useReaderExperience.ts` — thin wrapper around `useLocalStorageState` (new, optional but preferred)
- `src/components/article-reader.tsx` — support both modes; add toggle; native font controls without reload
- `src/components/native-article-reader.tsx` — native layout (new)
- `src/App.tsx` — wire experience preference into `useArticle`
- `src/i18n.ts` — toggle labels (en + nl)
- `src/utils/extractNativeArticle.test.ts` — bun tests using copied fixtures (new)
- `src/utils/__fixtures__/articles/` — copies of `*.content.html` + tiny expected metadata JSON (new)
- `plans/README.md` — status row

**Out of scope** (do NOT touch):

- `server/archive-proxy.ts` and CAPTCHA solve flow
- Deleting or rewriting existing `src/data/sites/**` legacy rule files (keep for non-migrated / legacy mode)
- Zap-element visual editor
- LLM rewriting
- Changing archive provider / `ARCHIVE_BASE`
- PWA install flow, Umami event schema overhaul (additive events OK)
- Running `bun run dev` / `bun run build`

## Git workflow

- Branch: `feat/native-article-extract-v2`
- Commit style (from recent history): short imperative sentences, e.g. `Fix article zoom to stop residual horizontal overflow`
- Commit per logical unit (deps → types/extract → hook wiring → UI → tests)
- Do NOT push or open a PR unless the operator asks

## Steps

### Step 0: Drift check + fixture sanity

Run the drift check command in the executor instructions. Confirm fixtures:

```bash
ls -la plans/fixtures/articles/
test -f plans/fixtures/articles/ad-nl-huwelijk.content.html
test -f plans/fixtures/articles/telegraaf-gardameer.content.html
```

Copy fixtures into the test tree (do not import from `plans/` at runtime in the app):

```bash
mkdir -p src/utils/__fixtures__/articles
cp plans/fixtures/articles/ad-nl-huwelijk.content.html src/utils/__fixtures__/articles/
cp plans/fixtures/articles/telegraaf-gardameer.content.html src/utils/__fixtures__/articles/
```

**Verify**: both files exist under `src/utils/__fixtures__/articles/`.

### Step 1: Add dependencies and test script

1. `bun add @mozilla/readability`
2. Add DOM for tests: `bun add -d linkedom`
3. Add types if published: `bun add -d @types/mozilla-readability` — if the package 404s, create `src/types/mozilla-readability.d.ts`:

```ts
declare module "@mozilla/readability" {
  export class Readability {
    constructor(doc: Document, options?: { debug?: boolean; nbTopCandidates?: number; charThreshold?: number });
    parse(): {
      title: string;
      content: string;
      textContent: string;
      length: number;
      excerpt: string;
      byline: string;
      dir: string;
      siteName: string;
      lang: string;
      publishedTime: string | null;
    } | null;
  }
  export function isProbablyReaderable(doc: Document, options?: { minContentLength?: number }): boolean;
}
```

4. In `package.json` scripts, add: `"test": "bun test"`

**Verify**: `bunx tsc -b --pretty false` still exits 0 on the untouched codebase after ambient types (or with no new imports yet). `cat package.json | rg '"test"'` shows the script.

### Step 2: Types + migration registry

Create `src/types/reader-experience.ts`:

```ts
export type ReaderExperience = "legacy" | "native";
```

Extend `src/types/article.ts` (keep existing captcha/error shapes):

```ts
export type NativeArticleImage = {
  src: string;
  alt?: string;
  caption?: string;
};

export type NativeArticle = {
  title: string;
  byline?: string;
  publishedAt?: string;
  siteName?: string;
  excerpt?: string;
  leadImage?: NativeArticleImage;
  /** Sanitized HTML for the article body only (no site chrome). */
  contentHtml: string;
  textContent: string;
  sourceUrl: string;
};

export type ArticleResult =
  | { status: "ok"; mode: "legacy"; html: string }
  | { status: "ok"; mode: "native"; article: NativeArticle }
  | CaptchaChallenge
  | { status: "error"; message: string };

export type ArticleState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      mode: "legacy";
      html: string;
      archiveLink: string;
    }
  | {
      status: "ready";
      mode: "native";
      article: NativeArticle;
      archiveLink: string;
    }
  | { status: "captcha"; challengeUrl: string; stage: CaptchaStage }
  | { status: "error"; message: string };
```

Update every consumer that assumed `status: "ready"` always has `.html` (primarily `useArticle` return mapping and `App.tsx` / `ArticleReader` props). Prefer narrowing on `mode`.

Create `src/data/nativeSites.ts`:

```ts
export type NativeSiteHints = {
  /** Prefer this subtree before Readability (inside archive #CONTENT when present). */
  contentSelector?: string;
  /** Removed before Readability. */
  removeSelectors?: string[];
};

/** Hostnames (www-prefixed as in `new URL(originalLink).hostname`) migrated to native when experience=native. */
export const nativeMigratedHosts: Record<string, NativeSiteHints> = {
  // DPG group — share template with AD fixture
  "www.ad.nl": {
    contentSelector: "#article-content",
    removeSelectors: ['[aria-label="advert"]', 'div[style*="z-index:800"]'],
  },
  "www.bd.nl": { contentSelector: "#article-content" },
  "www.ed.nl": { contentSelector: "#article-content" },
  "www.tubantia.nl": { contentSelector: "#article-content" },
  "www.bndestem.nl": { contentSelector: "#article-content" },
  "www.pzc.nl": { contentSelector: "#article-content" },
  "www.destentor.nl": { contentSelector: "#article-content" },
  "www.gelderlander.nl": { contentSelector: "#article-content" },

  // Mediahuis — start with Telegraaf; extend later
  "www.telegraaf.nl": {
    contentSelector: "main",
    removeSelectors: [
      "[data-element=newsletterRoot]",
      "#ad_1",
      "#ad_2",
      "#ad_3",
    ],
  },
};

export function getNativeSiteHints(hostname: string): NativeSiteHints | null {
  return nativeMigratedHosts[hostname] ?? null;
}

export function isNativeMigratedHost(hostname: string): boolean {
  return hostname in nativeMigratedHosts;
}
```

Keep the host list aligned with `dpg.ts` / telegraaf entry in `mediahuis.ts`. Do **not** migrate the entire Mediahuis list in this plan — only `www.telegraaf.nl` plus the full DPG list from `dpg.ts`.

**Verify**: `bunx tsc -b --pretty false` — will fail until callers updated; that is OK if you continue immediately to Step 3–5 in the same working session, but do not leave the branch type-broken at the end.

### Step 3: Implement `extractNativeArticle`

Create `src/utils/extractNativeArticle.ts` with a pure function (no fetch):

```ts
export type ExtractNativeArticleInput = {
  html: string;
  sourceUrl: string;
  archiveBaseUrl: string; // e.g. https://archive.is
  hints?: NativeSiteHints | null;
};

export type ExtractNativeArticleResult =
  | { status: "ok"; article: NativeArticle }
  | { status: "error"; message: string };
```

Algorithm (must follow this order):

1. Parse HTML:
   - Browser / Vite client: `new DOMParser().parseFromString(html, "text/html")`
   - Detect non-DOMParser environments for tests: if `typeof DOMParser === "undefined"`, use `linkedom` `parseHTML(html)` and take `.document`
2. Root selection:
   - Let `root = doc.querySelector("#CONTENT") ?? doc.documentElement`
3. Apply hints on a **clone** of `root` (or operate on `doc` after scoping):
   - If `hints.contentSelector`, `querySelector` within root; if found, use that node as the Readability document body source (replace `doc.body` content with a clone of that node, or run Readability on a new document containing only that subtree — pick one approach and stick to it)
   - For each `hints.removeSelectors`, `querySelectorAll` + `remove()`
   - Always remove nodes whose textContent includes `Hier staat ingevoegde content` (Telegraaf embed consent)
4. Optionally call `isProbablyReaderable(doc)` — if false, still try parse once; only fail if parse returns null / empty
5. `new Readability(documentClone).parse()`
6. If `!parsed || !parsed.title || (parsed.textContent?.trim().length ?? 0) < 200` → `{ status: "error", message: "Could not extract article content" }`
7. Rewrite image/`src` and `href` that start with `/` to `archiveBaseUrl + path` (mirror `fixImages` intent; archive snapshots use root-relative asset URLs)
8. `contentHtml = DOMPurify.sanitize(parsed.content, { USE_PROFILES: { html: true } })` via `isomorphic-dompurify`
9. Build `NativeArticle` (map `byline`, `publishedTime` → `publishedAt`, `siteName`, `excerpt`)
10. Best-effort `leadImage`: first `<img>` in sanitized content with non-trivial width/src; optional caption from adjacent `<figcaption>` if present in content HTML — OK to leave `leadImage` undefined in v1 of the extractor if noisy

Export `extractNativeArticle`.

**Verify**: temporary bun REPL or unit test file compiling: `bunx tsc -b --pretty false` once the test file exists (Step 6 can land right after this).

### Step 4: Implement `getNativeArticle`

Create `src/utils/getNativeArticle.ts`:

- Same fetch/captcha/`#CONTENT` presence checks as `getArticle` (reuse `fetchArchivePage`, captcha return shape)
- Do **not** call `applyRules` / legacy site rules
- Call `extractNativeArticle` with hostname hints from `getNativeSiteHints`
- Return `ArticleResult` with `mode: "native"` on success

Keep `getArticle` returning legacy HTML, but update its success return to `{ status: "ok", mode: "legacy", html }` so the union is consistent.

**Verify**: `rg "mode: \"legacy\"" src/utils/getArticle.ts` matches; `rg "mode: \"native\"" src/utils/getNativeArticle.ts` matches.

### Step 5: Wire `useArticle` + preference hook

Create `src/hooks/useReaderExperience.ts`:

```ts
import useLocalStorageState from "use-local-storage-state";
import type { ReaderExperience } from "@/types/reader-experience";

const KEY = "readerExperience";

export function useReaderExperience() {
  return useLocalStorageState<ReaderExperience>(KEY, {
    defaultValue: "legacy",
  });
}
```

Update `resolveArticle(url, font, experience)` in `useArticle.ts`:

```ts
const hostname = new URL(url).hostname;
const useNative =
  experience === "native" && isNativeMigratedHost(hostname);

if (useNative) {
  const native = await getNativeArticle(archiveLink.link, ARCHIVE_BASE, url);
  // captcha/error passthrough
  if (native.status === "ok") {
    return {
      status: "ready",
      mode: "native",
      article: native.article,
      archiveLink: archiveLink.link,
    };
  }
  // Extraction failed → fall back to legacy for this request (do not flip the user toggle)
}
// existing getArticle path → ready mode legacy
```

Return API from the hook:

```ts
articleHtml: state.status === "ready" && state.mode === "legacy" ? state.html : "",
nativeArticle: state.status === "ready" && state.mode === "native" ? state.article : null,
mode: state.status === "ready" ? state.mode : null,
```

(or keep `article` name but type it as a discriminated union — choose one; update `App.tsx` accordingly)

When `experience` changes, reload the article (add `experience` to the `[url]` effect deps, or a dedicated effect). Do **not** require `font` reload for native mode.

**Verify**: `rg "readerExperience|useReaderExperience|getNativeArticle" src/hooks/useArticle.ts src/App.tsx` shows wiring.

### Step 6: Characterization tests

Create `src/utils/extractNativeArticle.test.ts` using `bun:test`.

Cases:

1. **AD fixture** — `extractNativeArticle` on `ad-nl-huwelijk.content.html` with DPG hints  
   - status `ok`  
   - title includes `Natasja`  
   - `textContent` includes `Lopikerkapel` or `Berlinda`  
   - `textContent` length > 500  
   - `contentHtml` does not include `id="__next"` / obvious nav chrome strings if present in full pages  
2. **Telegraaf gardameer fixture** (`telegraaf-gardameer.content.html`) — hints for telegraaf  
   - status `ok`  
   - title includes `Gardameer` (or `hagel` / `vakantie`)  
   - `textContent` does **not** include `Hier staat ingevoegde content`  
3. **Garbage HTML** — `<html><body><p>hi</p></body></html>` → `status: "error"`

Use `linkedom` inside the extractor’s test path (Step 3). Read fixtures with `Bun.file(...).text()` and paths relative to import.meta.dir.

**Verify**: `bun test src/utils/extractNativeArticle.test.ts` — 3+ tests pass.

### Step 7: Native reader UI + toggle

Create `src/components/native-article-reader.tsx`:

- Props: `article: NativeArticle`, `articleLink: string`, `font: Font`, `onFontChange`, plus experience toggle props (or compose inside `ArticleReader`)
- Layout: readable column (`max-w-prose` / ~680px), Payless background tokens from `src/index.css`
- Render: title (`h1`), byline + date line, optional lead image, then `dangerouslySetInnerHTML` **only** for `contentHtml` (already sanitized)
- Typography: apply font scale / line height via CSS variables or Tailwind style on a wrapper, e.g. `style={{ fontSize: `${font.scale}rem`, lineHeight: font.height ?? 1.6 }}` — **no `window.location.reload()`**
- Keep “View on archive.today” link + analytics pattern from `article-reader.tsx`
- Do **not** run the legacy `html { zoom }` fitting logic on native mode

Update `src/components/article-reader.tsx` to become a thin switch:

- If legacy: existing behavior (zoom + HTML inject)
- If native: render `NativeArticleReader`
- Always show a control to toggle experience:

```tsx
<label>
  <input
    type="checkbox"
    checked={experience === "native"}
    onChange={(e) => onExperienceChange(e.target.checked ? "native" : "legacy")}
  />
  {t("reader.nativeToggle")}
</label>
```

Place the toggle in the existing top toolbar next to font controls (both modes).

Wire in `App.tsx`:

```ts
const [experience, setExperience] = useReaderExperience();
const { … } = useArticle(extractedUrl, font, experience);
// pass experience + setExperience into reader
```

Add i18n keys (en + nl), e.g.:

- `reader.nativeToggle`: “Native reader (v2)” / “Native reader (v2)”
- `reader.nativeToggleHint`: short hint that non-migrated sites still use classic cleaning

When experience is `native` but host is not migrated, `useArticle` uses legacy HTML; still show the toggle as on, and optionally a small muted note `reader.nativeFallback` = “This site still uses the classic cleaner.” Only show that note when `experience==="native" && mode==="legacy" && ready`.

**Verify**: `bunx tsc -b --pretty false` exit 0; `bun run lint` exit 0.

### Step 8: Analytics (light touch)

Add optional Umami props when an article becomes ready:

- `trackEvent("reader mode", { website, mode: "native" | "legacy", experience })`

Do not rename existing events.

**Verify**: `rg "reader mode" src/hooks/useArticle.ts` matches.

### Step 9: Final verification + plans index

Run:

```bash
bunx tsc -b --pretty false
bun run lint
bun test
```

Update `plans/README.md` row for 001 to `DONE`.

**Verify**: all three commands exit 0; `git status` shows only in-scope paths (+ lockfile).

## Test plan

- New file: `src/utils/extractNativeArticle.test.ts` (bun:test)
- Cover: AD happy path, Telegraaf gardameer happy path (embed stripped), too-short failure
- Manual checks (operator, not executor-required): open AD URL with toggle native vs legacy; open a non-migrated host with toggle on → legacy content + fallback note; toggle persistence across refresh (`localStorage.readerExperience`)
- No existing test file to model after — this repo had none; keep tests small and fixture-driven

## Done criteria

- [ ] `bunx tsc -b --pretty false` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with native extraction tests for AD + Telegraaf fixtures
- [ ] `localStorage` key `readerExperience` is `"legacy" | "native"` via `useLocalStorageState`
- [ ] Native path used only when `experience === "native"` **and** host ∈ `nativeMigratedHosts`; otherwise legacy `getArticle` rules still apply
- [ ] Native UI does not use `document.documentElement.style.zoom` and does not reload on font change
- [ ] Legacy path still works unchanged when experience is `legacy`
- [ ] Fixtures exist under `src/utils/__fixtures__/articles/`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Drift check shows `getArticle` / `useArticle` / `ArticleState` reshaped differently than the excerpts (another WIP landed).
- `@mozilla/readability` cannot run with `DOMParser` in the Vite client bundle (e.g. hard Node dependency) — try dynamic import / ensure no `jsdom` in the client path; if still blocked, STOP.
- AD or Telegraaf fixtures fail extraction even after applying the documented hints — STOP with the failure output rather than inventing an LLM rewrite path.
- You believe migrating **all** Mediahuis hosts is required for Telegraaf alone — it is not; only `www.telegraaf.nl` + DPG list in this plan.
- A step’s verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Adding a newly migrated host = entry in `src/data/nativeSites.ts` (+ optional hints). Leave legacy rules in place until native is default and trusted.
- Telegraaf gardameer fixture is already the primary Mediahuis sample (`archive.ph/X1pCt`). Refresh it if the live template drifts.
- Reviewers should scrutinize: XSS surface (`DOMPurify` options), accidental double-fetch on toggle, and that fallback to legacy on extract failure does not clear the user’s native preference.
- Deferred follow-ups: block-based body model (paragraphs/figures as React nodes), zap-editor for hints, migrating remaining Mediahuis titles, making native the default.

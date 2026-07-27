# Article fixtures for native (v2) extraction

Captured 2026-07-18 for the native reader plan. Use these as characterization inputs while implementing and testing `extractNativeArticle`.

## Files

| File | Role |
|------|------|
| `ad-nl-huwelijk.archive.html` | Full archive.is snapshot for the AD sample URL |
| `ad-nl-huwelijk.content.html` | Trimmed test fixture (`#CONTENT` + `#article-content`) |
| `telegraaf-gardameer.archive.html` | Full archive.ph snapshot for the Telegraaf sample URL |
| `telegraaf-gardameer.content.html` | Trimmed test fixture (`#CONTENT` + `<main>` article region) |
| `trouw-vierdaagse.archive.html` | Full archive.is snapshot for the Trouw sample URL |
| `trouw-vierdaagse.content.html` | Trimmed test fixture (`#CONTENT` + `#article-content`) |
| `volkskrant-venezuela.archive.html` | Full archive.is snapshot for the Volkskrant sample URL |
| `volkskrant-venezuela.content.html` | Trimmed test fixture (`#CONTENT` + `#article-content`) |
| `ft-musk.archive.html` / `ft-htsi.archive.html` | Full archive.is snapshots for FT samples |
| `ft-musk.content.html` / `ft-htsi.content.html` | Trimmed fixtures (`#o-topper` + `#site-content`) |
| `quotenet-jort-kelder.archive.html` | Full archive.is snapshot for the Quote sample URL |
| `quotenet-jort-kelder.content.html` | Trimmed test fixture (`#CONTENT` + `#main-content`) |
| `nt-merwedebrug.archive.html` | Full archive.is snapshot for the NT sample URL |
| `nt-merwedebrug.content.html` | Trimmed test fixture (`#CONTENT` + `main#main`, sidebar `<aside>` dropped) |
| `manifest.json` | URLs, snapshot IDs, structural notes |

## Product sample URLs

1. **AD (DPG)**  
   `https://www.ad.nl/binnenland/bijzonder-huwelijk-natasja-51-trouwt-niet-alleen-met-erik-51-maar-ook-met-berlinda-55~a691c576/`  
   Snapshot: `https://archive.is/8TX6U`

2. **Telegraaf (Mediahuis)**  
   `https://www.telegraaf.nl/nieuws/ondanks-hagel-en-noodweer-blijft-gardameer-populair-we-laten-onze-vakantie-niet-verpesten/158897974/`  
   (archive resolves with `.html` suffix)  
   Snapshot: `https://archive.ph/X1pCt`  
   H1: *Ondanks hagel en noodweer blijft Gardameer populair: ’We laten onze vakantie niet verpesten’*

3. **Trouw (DPG template)**  
   `https://www.trouw.nl/binnenland/het-militaire-dorp-van-de-vierdaagse-is-zwaar-beveiligd-maar-geopolitiek-speelt-er-geen-rol~bcf724ac/`  
   Snapshot: `https://archive.is/0bjdC`  
   H1: *Het militaire dorp van de Vierdaagse is zwaar beveiligd, maar geopolitiek speelt er geen rol*

4. **Volkskrant (DPG template)**  
   `https://www.volkskrant.nl/buitenland/maanden-na-trumps-inval-zijn-venezolanen-ontgoocheld-en-boos-de-amerikanen-verraden-ons-nu-ook~b8ba72d0/`  
   Snapshot: `https://archive.is/zUgXu`  
   H1: *Maanden na Trumps inval zijn Venezolanen ontgoocheld en boos: ‘De Amerikanen verraden ons nu ook’*

5. **FT (Financial Times)**  
   - `https://www.ft.com/content/5ef14997-982e-4f03-8548-b5d67202623a` → `https://archive.is/iqyNt` (Musk / Roula Khalaf)  
   - `https://www.ft.com/content/85cbc4e1-24e4-4c36-8747-352258cfc038` → `https://archive.is/CXjOT` (HTSI / Jo Ellison)

6. **Quote (Hearst)**  
   `https://www.quotenet.nl/quote-500/a72610847/jort-kelder-niet-een-vrouw-op-de-quote-500-heeft-haar-eigen-geld-verdiend/`  
   Snapshot: `https://archive.is/Wdu1v`  
   H1: *Jort Kelder: ‘Niet één vrouw op de Quote 500 heeft haar eigen geld verdiend’*

7. **NT (Nieuwsblad Transport, ProMedia)**  
   `https://www.nt.nl/wegvervoer/2026/07/27/tientallen-trucks-negeren-verbod-op-merwedebrug-en-tikken-500-euro-af/`  
   Snapshot: `https://archive.is/0Esa5`  
   Headline (an `<h2>`, not `<h1>`): *Tientallen trucks negeren verbod op Merwedebrug en tikken 500 euro af*

## Structural findings (load-bearing for the extractor)

### AD / DPG (`ad-nl-huwelijk`)

- Archive wraps publisher HTML in `#CONTENT`.
- Article root is `<article id="article-content">` (not a div).
- Title is a real `<h1>`.
- Body copy is mostly **styled `<div>`s** (`font-size:18px`), not `<p>` tags.
- Lead/dek is the first bold ~18px block after the title.
- Hero `<figure>` + caption text present; related-news cards trail the body.
- JSON-LD is unreliable in the archive HTML — do not require it.
- Legacy zap rules live in `src/data/sites/multiple/dpg.ts`.

### Telegraaf / Mediahuis (`telegraaf-gardameer`)

- Has archive `#CONTENT` and publisher `#__next`.
- Article region is under `<main>`; title is `<h1>`.
- Body leans on div text, sparse/absent `<p>`.
- Social-embed consent placeholders appear, e.g. text containing `Hier staat ingevoegde content` — strip these.
- Legacy zap rules live in `src/data/sites/multiple/mediahuis.ts`.

### Trouw (`trouw-vierdaagse`)

- Same DPG `#article-content` / `#article-content-bottom` chrome as AD.
- Byline via `/auteur/` link (`Cindy Cloin` in the sample).
- Legacy zap rules live in `src/data/sites/single/trouw.ts` (not in `dpg.ts`).
- Native hints reuse the DPG template entry in `src/data/nativeSites.ts`.

### Volkskrant (`volkskrant-venezuela`)

- Same DPG `#article-content` template as AD/Trouw.
- Byline via `/auteur/` (`Marjolein van de Water` in the sample).
- Legacy zap rules live in `src/data/sites/single/volkskrant.ts`.
- Native hints reuse the DPG template entry in `src/data/nativeSites.ts`.

### FT (`ft-musk`, `ft-htsi`)

- Headline lives in `#o-topper`; body/byline in `#site-content` (siblings under `#CONTENT`).
- Byline via profile URLs like `www.ft.com/roula-khalaf` (not `/author/`).
- Strip `| Financial Times` title suffix, `(opens a new window)` link labels, newsletter CTAs.
- Legacy zap rules live in `src/data/sites/single/ft.ts`.

### Quote (`quotenet-jort-kelder`)

- Archive `#CONTENT` + publisher `#__next` / `#main-content`.
- Class names are stripped in archive HTML — prefer ids (`#main-content`, `#piano-paywall-container`).
- Dek is a large-type div after `<h1>`; Readability drops it (capture + re-inject).
- Byline via `/author/` (`Lotte Verheul` in the sample).
- Strip Piano stub, “Lees ook” related list, and `abonnement.quotenet.nl` shop cards.
- Native hints live in `src/data/nativeSites.ts` (no legacy zap file yet).

### NT (`nt-merwedebrug`)

- Archive `#CONTENT` + publisher `main#main`; the story is the **first** `<article>` in that `main`.
- **No `<h1>` in the snapshot at all** — the headline is a 40px `<h2>` inside `article > header`. Hence the `titleSelector` hint, which promotes it to `<h1>` so the title/dek/Readability heuristics keep working.
- A short uppercase kicker div ("rustiger dan normaal") sits between headline and dek; the dek is the 20px bold div after it.
- Byline is a `mailto:` link — no `/auteur/` or `/author/` profile URL — with the name in `<strong>` next to a "Stuur een e-mail" span. Hence the `bylineSelector` hint.
- Body is 20px styled divs with real `<h2>` subheads; hero `<figure>` + `<figcaption>`.
- Chrome to strip: the subscription wall that ends the archived body ("Abonneer nu …", "Kies uw abonnement", "Dit artikel gratis lezen?" — handled via `CHROME_HEADING`), the inline "Lees ook" aside, `article > footer` (topics + share row), and the `#loop-related-*` "Overig nieuws in …" trail.
- The sidebar `<aside>` carries an hCaptcha newsletter form; its `h-captcha-response`/`g-recaptcha-response` textareas are exactly the snapshot debris `archiveDetect` is written to ignore.
- No legacy zap file — native hints only.

## How to refresh a fixture

With local archive proxy (`http://localhost:8788`) warm:

```bash
SID=$(curl -s http://localhost:8788/session | python3 -c 'import sys,json;print(json.load(sys.stdin)["sid"])')
# GET /fetch?url=https://archive.ph/X1pCt&sid=$SID  (or archive.is snapshot)
# replace the .archive.html and rebuild .content.html
```

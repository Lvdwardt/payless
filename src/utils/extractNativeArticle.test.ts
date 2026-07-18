import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { extractNativeArticle } from "@/utils/extractNativeArticle";

const FIXTURES_DIR = join(import.meta.dir, "__fixtures__", "articles");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

describe("extractNativeArticle", () => {
  test("extracts the AD (DPG) fixture into a structured article", async () => {
    const html = readFixture("ad-nl-huwelijk.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.ad.nl",
      baseURL: "https://archive.is/8TX6U",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("Bijzonder huwelijk");
    expect(result.article.title).toContain("Berlinda");
    expect(result.article.title).not.toMatch(/…$/);
    expect(result.article.byline).toBe("Elisabetta Santangelo");
    expect(result.article.content).toContain('data-payless-author-name="true"');
    expect(result.article.content).toMatch(
      /data-payless-author-name="true"[^>]*>[\s\S]*?Elisabetta Santangelo[\s\S]*?Schrijft over/
    );
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("Natasja");
    expect(result.article.images.length).toBeGreaterThan(0);
    for (const image of result.article.images) {
      expect(image.src.startsWith("https://archive.is/8TX6U/")).toBe(true);
    }
    // Related-article chrome after the article-content-bottom marker must
    // not leak into the extracted body.
    expect(result.article.content).not.toContain("Veiligheidsraad leidt onderzoek");
    expect(result.article.content).not.toMatch(/<figcaption[^>]*>[\s\S]*?<svg/i);
    expect(result.article.content).not.toContain("Lees meer");
    expect(result.article.content).not.toMatch(/Volg .+ op sociale media/i);
    expect(result.article.content).not.toContain("Google-favoriet");
    expect(result.article.content).not.toContain("google.com/preferences/source");
    expect(result.article.content).not.toContain("<span></span>");
    expect(result.article.content).not.toContain("<section></section>");
  });

  test("prefers full h1 over truncated og:title and strips caption icons", async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) =>
        `<p>Paragraaf ${i} met genoeg tekst om Readability te overtuigen dat dit een echt nieuwsartikel is.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><head>
      <title>Short</title>
      <meta property="og:title" content="Bijzonder huwelijk: Natasja (51) trouwt niet alleen met Erik (51), ma…" />
      <meta name="twitter:title" content="Bijzonder huwelijk: Natasja (51) trouwt niet alleen met Erik (51), ma…" />
    </head><body>
      <div id="CONTENT">
        <article id="article-content">
          <h1>Bijzonder huwelijk: Natasja (51) trouwt niet alleen met Erik (51), maar óók met Berlinda (55)</h1>
          <a href="https://www.ad.nl/auteur/elisabetta-santangelo/">Elisabetta Santangelo</a>
          <figure>
            <img src="/photo.jpg" alt="" />
            <figcaption><span><svg width="8" height="8"><polygon points="0 0" /></svg></span><span><strong>Caption text</strong></span></figcaption>
          </figure>
          ${paragraphs}
        </article>
      </div>
    </body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.ad.nl",
      baseURL: "https://archive.is/8TX6U",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("Berlinda");
    expect(result.article.title).not.toMatch(/…$/);
    expect(result.article.byline).toBe("Elisabetta Santangelo");
    expect(result.article.content).toContain("Caption text");
    expect(result.article.content).not.toMatch(/<figcaption[^>]*>[\s\S]*?<svg/i);
  });

  test("extracts the FT Musk fixture into a structured article", async () => {
    const html = readFixture("ft-musk.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.ft.com",
      baseURL: "https://archive.is/iqyNt",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("Elon Musk");
    expect(result.article.title).not.toMatch(/Financial Times/i);
    expect(result.article.byline).toBe("Roula Khalaf");
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("Tesla");
    expect(result.article.content).not.toContain("opens a new window");
    expect(result.article.content).not.toMatch(/Promoted Content/i);
    // Hero sits beside #o-topper (empty alt) — must be re-injected as lead.
    expect(result.article.content).toContain(
      "e0e5ab99e7256766153b44517f4b2e157f4cef14"
    );
    expect(result.article.content).toContain("Seb Jarnot");
    expect(result.article.content).not.toContain("/iqyNt/iqyNt/");
    // Lunch-with-the-FT bill card kept and marked as an aside.
    expect(result.article.content).toContain("Fonda San Miguel");
    expect(result.article.content).toContain("$198.37");
    expect(result.article.content).toMatch(
      /data-payless-aside="menu"[\s\S]*Fonda San Miguel[\s\S]*\$198\.37/
    );
    for (const image of result.article.images) {
      expect(image.src.startsWith("https://archive.is/iqyNt/")).toBe(true);
    }
  });

  test("extracts the FT HTSI fixture into a structured article", async () => {
    const html = readFixture("ft-htsi.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.ft.com",
      baseURL: "https://archive.is/CXjOT",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("pull of Country");
    expect(result.article.title).not.toMatch(/Financial Times/i);
    expect(result.article.byline).toBe("Jo Ellison");
    expect(result.article.byline).not.toMatch(/Accessibility/i);
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("mudlarking");
    expect(result.article.content).not.toMatch(/newsletter/i);
    expect(result.article.textContent).not.toMatch(/newsletter/i);
    expect(result.article.content).not.toContain(
      "straight into your inbox"
    );
  });

  test("strips FT How To Spend It newsletter CTA paragraphs", async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) =>
        `<p>Paragraaf ${i} met genoeg tekst om Readability te overtuigen dat dit een echt nieuwsartikel is.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><body><div id="CONTENT">
      <div id="o-topper"><h1>HTSI editor’s letter: the pull of Country</h1></div>
      <div id="site-content">
        <a href="https://www.ft.com/jo-ellison">Jo Ellison</a>
        ${paragraphs}
        <p>For the best of How To Spend It straight into your inbox, sign&nbsp;up to our&nbsp;newsletter at <a href="https://www.ft.com/newsletters">ft.com/newsletters</a></p>
      </div>
    </div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.ft.com",
      baseURL: "https://archive.is/CXjOT",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.article.content).not.toContain("straight into your inbox");
    expect(result.article.content).not.toContain("newsletters");
  });

  test("never uses FT Accessibility help chrome as the byline", async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) =>
        `<p>Paragraaf ${i} met genoeg tekst om Readability te overtuigen dat dit een echt nieuwsartikel is.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><body><div id="CONTENT">
      <div id="o-topper"><h1>HTSI editor’s letter: the pull of Country</h1></div>
      <div id="site-content">
        <a href="https://www.ft.com/accessibility">Accessibility help</a>
        <a href="https://www.ft.com/jo-ellison">Jo Ellison</a>
        <time datetime="2022-01-29">January 29 2022</time>
        ${paragraphs}
      </div>
    </div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.ft.com",
      baseURL: "https://archive.is/CXjOT",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.article.byline).toBe("Jo Ellison");
  });

  test("extracts the Volkskrant (DPG template) fixture into a structured article", async () => {
    const html = readFixture("volkskrant-venezuela.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.volkskrant.nl",
      baseURL: "https://archive.is/zUgXu",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("Venezolanen");
    expect(result.article.title).toContain("Amerikanen");
    expect(result.article.title).not.toMatch(/…$/);
    expect(result.article.byline).toBe("Marjolein van de Water");
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("Maduro");
    expect(result.article.images.length).toBeGreaterThan(0);
    for (const image of result.article.images) {
      expect(image.src.startsWith("https://archive.is/zUgXu/")).toBe(true);
    }
    expect(result.article.content).not.toContain(
      "Dit artikel is geschreven door"
    );
    expect(result.article.content).not.toContain("Lees meer");
    expect(result.article.content).not.toContain("Google-favoriet");
    expect(result.article.content).not.toContain("nieuwsbrief");
    expect(result.article.content).not.toContain("sim_");
    expect(result.article.content).not.toContain("De Volkskrant Ochtend");
    // Mid-sentence Axios link must stay inline (not a lone <a> between <p>s).
    expect(result.article.content).not.toMatch(
      /<\/p>\s*<a[^>]*>[\s\S]*?onthulde[\s\S]*?<\/a>\s*<p/i
    );
    expect(result.article.content).toMatch(
      /Axios[\s\S]*?<a[^>]*>[\s\S]*?onthulde[\s\S]*?<\/a>[\s\S]*?vorige week/i
    );
  });

  test("merges mid-sentence links that Readability split across paragraphs", async () => {
    const paragraphs = Array.from(
      { length: 5 },
      (_, i) =>
        `<p>Paragraaf ${i} met genoeg tekst om Readability te overtuigen dat dit een echt nieuwsartikel is.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><body><div id="CONTENT">
      <article id="article-content">
        <h1>Testartikel over een gesplitste link in de zin</h1>
        ${paragraphs}
        <div>
          <p>De Amerikaanse nieuwssite <i>Axios</i></p>
          <a href="https://example.com/story"><u> onthulde</u></a>
          <p> vorige week dat Machado onderweg was.</p>
        </div>
        ${paragraphs}
      </article>
    </div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.volkskrant.nl",
      baseURL: "https://archive.is/test",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.content).not.toMatch(
      /<\/p>\s*<a[^>]*>[\s\S]*?onthulde[\s\S]*?<\/a>\s*<p/i
    );
    expect(result.article.content).toMatch(
      /Axios[\s\S]*?onthulde[\s\S]*?vorige week/i
    );
  });

  test("extracts the Trouw (DPG template) fixture into a structured article", async () => {
    const html = readFixture("trouw-vierdaagse.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.trouw.nl",
      baseURL: "https://archive.is/0bjdC",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("militaire dorp");
    expect(result.article.title).toContain("Vierdaagse");
    expect(result.article.title).not.toMatch(/…$/);
    expect(result.article.byline).toBe("Cindy Cloin");
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("Kamp Heumensoord");
    expect(result.article.images.length).toBeGreaterThan(0);
    for (const image of result.article.images) {
      expect(image.src.startsWith("https://archive.is/0bjdC/")).toBe(true);
    }
    expect(result.article.content).not.toContain("Lees meer");
    expect(result.article.content).not.toMatch(/Volg .+ op sociale media/i);
    expect(result.article.content).not.toContain("Google-favoriet");
    // Visually-hidden SR label + orphaned role line must not break the body.
    expect(result.article.content).not.toContain(
      "Dit artikel is geschreven door"
    );
    expect(result.article.content).not.toContain("correspondent Oost-Nederland");
    expect(result.article.textContent).toMatch(/blarenpost[\s\S]*Na tien minuten/);
  });

  test("extracts the Telegraaf (Mediahuis) fixture into a structured article", async () => {
    const html = readFixture("telegraaf-gardameer.content.html");

    const result = await extractNativeArticle(html, {
      host: "www.telegraaf.nl",
      baseURL: "https://archive.ph/X1pCt",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.title).toContain("Gardameer");
    expect(result.article.length).toBeGreaterThan(200);
    expect(result.article.textContent).toContain("Gardameer");
    expect(result.article.images.length).toBeGreaterThan(0);
    // Hero image lives inside a <button> in the archive HTML — must survive.
    expect(
      result.article.images.some(
        (image) =>
          (image.alt || "").includes("Gardameer") ||
          (image.alt || "").includes("Desenzano") ||
          (image.alt || "").includes("Peschiera")
      )
    ).toBe(true);
    for (const image of result.article.images) {
      expect(image.src.startsWith("https://archive.ph/X1pCt/")).toBe(true);
    }
  });

  test("keeps Telegraaf hero images from buttons and drops related teasers", async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) =>
        `<p>Paragraaf ${i} met genoeg tekst over de wedstrijd en de halftimeshow om Readability te overtuigen.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><body><div id="CONTENT"><main>
      <article>
        <h1>FIFA geeft uitsluitsel over duur halftimeshow tijdens finale WK 2026</h1>
        <figure>
          <button type="button">
            <img alt="Shakira treedt tijdens de halftimeshow op." sizes="(max-width: 479px) 100vw, 832px" src="/hero.jpg" />
          </button>
          <span>Shakira treedt tijdens de halftimeshow op. © Getty Images</span>
        </figure>
        ${paragraphs}
        <a href="https://www.telegraaf.nl/sport/other/158901000.html">
          <figure>
            <img alt="Gianni Infantino op het WK 2026." sizes="(max-width: 479px) 80px, 120px" src="/teaser.jpg" />
          </figure>
          <span>Een overweldigende meerderheid: ’Meer dan 200 landen stemden voor’</span>
        </a>
      </article>
    </main></div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.telegraaf.nl",
      baseURL: "https://archive.is/qiYpE",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.content).toContain("Shakira treedt tijdens de halftimeshow op.");
    expect(result.article.content).toContain('alt="Shakira treedt tijdens de halftimeshow op."');
    expect(result.article.content).toContain("hero.jpg");
    expect(result.article.content).not.toContain("Infantino");
    expect(result.article.content).not.toContain("teaser.jpg");
  });

  test("strips 'Hier staat ingevoegde content' embed placeholders", async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) =>
        `<p>Dit is alinea nummer ${i} met genoeg tekst om Readability te overtuigen dat dit een echt artikel is en geen bijschrift.</p>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><title>Fixture</title></head><body>
      <div id="CONTENT">
        <main>
          <article>
            <h1>Een testartikel met een ingevoegde content placeholder</h1>
            ${paragraphs}
            <div class="embed-consent">Hier staat ingevoegde content. Klik om te tonen.</div>
            ${paragraphs}
          </article>
        </main>
      </div>
    </body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.telegraaf.nl",
      baseURL: "https://archive.ph/test",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.article.content).not.toContain("Hier staat ingevoegde content");
  });

  test("returns an error when #CONTENT is missing", async () => {
    const html = `<!DOCTYPE html><html><body><div id="not-content"><p>hello</p></div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.ad.nl",
      baseURL: "https://archive.is",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.message).toContain("not found");
  });

  test("returns an error for content too short to be a real article", async () => {
    const html = `<!DOCTYPE html><html><body><div id="CONTENT"><article id="article-content"><h1>Hi</h1><p>Too short.</p></article></div></body></html>`;

    const result = await extractNativeArticle(html, {
      host: "www.ad.nl",
      baseURL: "https://archive.is",
    });

    expect(result.status).toBe("error");
  });

  test("returns an error for garbage HTML with no usable content", async () => {
    const html = `not even html`;

    const result = await extractNativeArticle(html, {
      host: "www.ad.nl",
      baseURL: "https://archive.is",
    });

    expect(result.status).toBe("error");
  });
});

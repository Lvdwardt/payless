import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  extractArchiveSnapshotLink,
  hasArchiveContent,
  isCaptchaHtml,
  isCaptchaResponse,
} from "@/utils/archiveDetect";

const ARCHIVE_FIXTURES = join(import.meta.dir, "__fixtures__", "archive");
// Full (untrimmed) snapshots — the closest thing we have to what `/fetch`
// actually hands the detector.
const SNAPSHOT_FIXTURES = join(
  import.meta.dir,
  "..",
  "..",
  "plans",
  "fixtures",
  "articles"
);

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf-8");
}

describe("archiveDetect", () => {
  test("flags a genuine archive.today challenge page", () => {
    const html = readFixture(ARCHIVE_FIXTURES, "challenge.html");

    expect(hasArchiveContent(html)).toBe(false);
    expect(isCaptchaHtml(html)).toBe(true);
    expect(isCaptchaResponse(429, html)).toBe(true);
  });

  // The bug: a readable snapshot carrying the archived site's own captcha
  // debris (`g-recaptcha-response` textarea, hcaptcha asset URLs) was treated
  // as a challenge, so the app looped through the solver forever on an article
  // it could already render.
  test("does not flag a snapshot carrying the archived site's captcha leftovers", () => {
    const html = readFixture(
      ARCHIVE_FIXTURES,
      "snapshot-with-captcha-leftovers.html"
    );

    expect(html).toContain("g-recaptcha-response");
    expect(html).toContain("hcaptcha.com");
    expect(hasArchiveContent(html)).toBe(true);
    expect(isCaptchaHtml(html)).toBe(false);
    expect(isCaptchaResponse(200, html)).toBe(false);
  });

  test("never flags a response that carries renderable archive content", () => {
    const names = readdirSync(SNAPSHOT_FIXTURES).filter((name) =>
      name.endsWith(".archive.html")
    );
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const html = readFixture(SNAPSHOT_FIXTURES, name);
      expect(hasArchiveContent(html)).toBe(true);
      expect(isCaptchaResponse(200, html)).toBe(false);
      // Even a hostile status can't hide a snapshot we can already parse.
      expect(isCaptchaResponse(429, html)).toBe(false);
    }
  });

  test("treats a content-less failure as a challenge", () => {
    expect(isCaptchaResponse(429, "")).toBe(true);
    expect(isCaptchaResponse(503, "<html><body>upstream down</body></html>")).toBe(
      true
    );
    expect(isCaptchaResponse(200, "<html><body>nothing here</body></html>")).toBe(
      false
    );
  });

  test("extracts the snapshot link from a search page", () => {
    const html = '<a href="https://archive.is/0Esa5">snapshot</a>';
    expect(extractArchiveSnapshotLink(html)).toBe("https://archive.is/0Esa5");
    expect(extractArchiveSnapshotLink('<a href="/0Esa5">x</a>')).toBe(
      "https://archive.is/0Esa5"
    );
  });
});

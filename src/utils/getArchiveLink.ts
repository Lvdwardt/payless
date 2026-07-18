import type { ArchiveLinkResult } from "@/types/article";
import {
  ARCHIVE_BASE,
  buildArchiveChallengeUrl,
  extractArchiveSnapshotLink,
} from "@/utils/archiveDetect";
import { fetchArchivePage } from "@/utils/archiveProxy";

const NOT_WORKING_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "netflix.com",
  "spotify.com",
];

export async function getArchiveLink(url: string): Promise<ArchiveLinkResult> {
  if (!url || !isValidUrl(url)) {
    return { status: "error", message: "Invalid URL" };
  }

  const domain = new URL(url).hostname.replace(/^www\./, "");
  if (
    NOT_WORKING_DOMAINS.some(
      (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
    )
  ) {
    return { status: "error", message: "This site is not supported" };
  }

  const challengeUrl = buildArchiveChallengeUrl(url);

  try {
    const page = await fetchArchivePage(`${ARCHIVE_BASE}/${url}`);

    if (page.captcha) {
      return {
        status: "captcha",
        challengeUrl: page.challengeUrl || challengeUrl,
      };
    }

    const link = extractArchiveSnapshotLink(page.html);
    if (link) {
      return { status: "ok", link };
    }

    return { status: "not_found" };
  } catch (error) {
    console.error("Error getting archive link:", error);
    return {
      status: "error",
      message:
        "Could not reach the archive. Check your connection and try again.",
    };
  }
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

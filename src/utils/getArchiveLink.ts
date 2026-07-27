import type { ArchiveLinkResult } from "@/types/article";
import { trackEvent, websiteFromUrl } from "@/hooks/useUmami";
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

  const domain = websiteFromUrl(url);
  if (
    NOT_WORKING_DOMAINS.some(
      (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
    )
  ) {
    trackEvent("not working", {
      website: domain,
      status: "not working",
    });
    return { status: "error", message: "This site is not supported" };
  }

  const challengeUrl = buildArchiveChallengeUrl(url);

  try {
    const page = await fetchArchivePage(`${ARCHIVE_BASE}/${url}`);

    if (page.captcha) {
      return {
        status: "captcha",
        challengeUrl: page.challengeUrl || challengeUrl,
        stage: "archive_link",
      };
    }

    const link = extractArchiveSnapshotLink(page.html);
    if (link) {
      trackEvent("working", {
        website: domain,
      });
      return { status: "ok", link };
    }

    trackEvent("no link found", {
      website: domain,
      status: "no link found",
    });
    return { status: "not_found" };
  } catch (error) {
    console.error("Error getting archive link:", error);
    trackEvent("error", {
      website: domain,
      stage: "archive_link",
      message:
        error instanceof Error ? error.message : "Could not reach the archive",
    });
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

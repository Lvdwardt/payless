import type { ArticleResult } from "@/types/article";
import { trackEvent, websiteFromUrl } from "@/hooks/useUmami";
import { fetchArchivePage } from "@/utils/archiveProxy";
import { extractNativeArticle } from "@/utils/extractNativeArticle";

/**
 * Native (v2) counterpart to `getArticle`: same fetch/captcha handling, but
 * hands the raw archive HTML to `extractNativeArticle` instead of applying
 * per-site zap rules.
 */
export default async function getNativeArticle(
  link: string,
  baseURL: string,
  originalLink: string
): Promise<ArticleResult> {
  baseURL = baseURL.replace(/\/$/, "");
  const site = new URL(originalLink).hostname;
  const domain = websiteFromUrl(originalLink);

  let data: string;
  try {
    const page = await fetchArchivePage(link);
    data = page.html;

    if (page.captcha) {
      return {
        status: "captcha",
        challengeUrl: page.challengeUrl || link,
        stage: "article",
      };
    }
  } catch (error) {
    console.error("Error fetching article:", error);
    trackEvent("error", {
      website: domain,
      stage: "article",
      message:
        error instanceof Error
          ? error.message
          : "Could not load the archived article",
    });
    return {
      status: "error",
      message: "Could not load the archived article.",
    };
  }

  const extracted = await extractNativeArticle(data, {
    host: site,
    baseURL,
  });

  if (extracted.status === "error") {
    return { status: "error", message: extracted.message };
  }

  return { status: "ok", mode: "native", article: extracted.article };
}

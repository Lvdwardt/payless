const UNSHORTENER_BASE = "https://url-unshortener.lvdw.workers.dev/";

export type UrlExtractionResult =
  | { status: "ok"; url: string }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Extracts an HTTP(S) URL from shared text that may include a title.
 */
function extractHttpUrl(query: string): string {
  const match = query.match(/https?:\/\/\S+/i);
  return match ? match[0].replace(/[)\],.;]+$/, "") : query.trim();
}

async function unshorten(url: string): Promise<string> {
  const response = await fetch(
    `${UNSHORTENER_BASE}?url=${encodeURIComponent(url)}`
  );
  const body = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`Unshortener failed (${response.status})`);
  }

  if (body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as { error?: string; message?: string };
      throw new Error(parsed.message || parsed.error || "Unshortener error");
    } catch (error) {
      if (error instanceof SyntaxError) {
        return body;
      }
      throw error;
    }
  }

  return body;
}

function isFinalArticleUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  try {
    const hostname = new URL(url).hostname;
    return (
      !hostname.includes("google.com") &&
      !hostname.includes("share.google") &&
      hostname !== "share.google"
    );
  } catch {
    return false;
  }
}

/**
 * Processes search.app URLs to extract the actual link.
 */
async function processSearchAppUrl(query: string): Promise<string> {
  const linkMatch = query.match(/[?&]link=([^&]+)/);
  if (linkMatch) {
    return decodeURIComponent(linkMatch[1]);
  }

  const urlPart = query.split(/\s+/)[0];
  return unshorten(urlPart);
}

/**
 * Resolves share.google / www.google.com/share.google short links.
 */
async function processGoogleShareUrl(query: string): Promise<string> {
  const shareIdMatch = query.match(
    /(?:https?:\/\/)?(?:www\.)?share\.google\/([a-zA-Z0-9]+)/i
  );
  const intermediateMatch = query.match(
    /https?:\/\/(?:www\.)?google\.com\/share\.google\?q=([a-zA-Z0-9]+)/i
  );

  const shareId = shareIdMatch?.[1] || intermediateMatch?.[1];
  if (!shareId) {
    throw new Error("No Google share link found");
  }

  if (shareId.toLowerCase() === "error") {
    throw new Error("This Google share link is invalid or expired");
  }

  const intermediateUrl = `https://www.google.com/share.google?q=${shareId}`;
  const resolvedUrl = await unshorten(intermediateUrl);

  if (isFinalArticleUrl(resolvedUrl)) {
    return resolvedUrl;
  }

  // Some resolutions stop at the intermediate Google URL — hop once more.
  if (
    resolvedUrl.includes("google.com/share.google") ||
    resolvedUrl.includes("share.google/")
  ) {
    const secondHop = await unshorten(resolvedUrl);
    if (isFinalArticleUrl(secondHop)) {
      return secondHop;
    }
  }

  throw new Error("Could not resolve Google share link");
}

/**
 * Removes tracking query parameters from the final article URL.
 */
function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    if (url.includes("?")) {
      return url.substring(0, url.indexOf("?"));
    }
    return url;
  }
}

/**
 * Extract and resolve a readable article URL from shared text / path input.
 */
export async function extractUrlFromQuery(
  query: string
): Promise<UrlExtractionResult> {
  if (!query.trim()) {
    return { status: "empty" };
  }

  try {
    let processedUrl = extractHttpUrl(query);

    if (processedUrl.includes("search.app")) {
      processedUrl = await processSearchAppUrl(processedUrl);
    }

    if (
      processedUrl.includes("share.google") ||
      /google\.com\/share\.google/i.test(processedUrl)
    ) {
      processedUrl = await processGoogleShareUrl(processedUrl);
    }

    if (!processedUrl.startsWith("http")) {
      return {
        status: "error",
        message: "No share link found in the shared text",
      };
    }

    if (
      processedUrl.includes("share.google") ||
      /google\.com\/share\.google/i.test(processedUrl)
    ) {
      return {
        status: "error",
        message: "Could not resolve Google share link",
      };
    }

    return { status: "ok", url: cleanUrl(processedUrl) };
  } catch (error) {
    console.error("Error extracting URL:", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not process share link",
    };
  }
}

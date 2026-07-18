/**
 * Extracts and processes URLs from query strings
 */

/**
 * Extracts HTTP URL from a query string if it contains one
 */
function extractHttpUrl(query: string): string {
  if (query.includes("http")) {
    return query.substring(query.indexOf("http"));
  }
  return query;
}

/**
 * Processes search.app URLs to extract the actual link
 */
async function processSearchAppUrl(query: string): Promise<string> {
  // Look for link parameter in search.app URLs
  const linkMatch = query.match(/link=([^&]+)/);
  if (linkMatch) {
    return decodeURIComponent(linkMatch[1]);
  }

  // If no link parameter, try to unshorten the URL
  const urlPart = query.split(" ")[0];
  try {
    const response = await fetch(
      `https://url-unshortener.lvdw.workers.dev/?url=${urlPart}`
    );
    return await response.text();
  } catch (error) {
    console.error("Error processing search.app URL:", error);
    return query;
  }
}

/**
 * Processes Google share URLs to extract the actual URL
 */
async function processGoogleShareUrl(query: string): Promise<string> {
  const googleShareMatch = query.match(
    /https:\/\/share\.google\/([a-zA-Z0-9]+)/
  );

  if (!googleShareMatch) {
    return query;
  }

  const shareId = googleShareMatch[1];
  const intermediateUrl = `https://www.google.com/share.google?q=${shareId}`;

  try {
    const unshortenerUrl = `https://url-unshortener.lvdw.workers.dev/?url=${intermediateUrl}`;
    const response = await fetch(unshortenerUrl);
    const resolvedUrl = await response.text();

    // Return resolved URL if it's valid and not still a Google URL
    if (
      resolvedUrl &&
      resolvedUrl.startsWith("http") &&
      !resolvedUrl.includes("google.com") &&
      !resolvedUrl.includes("share.google")
    ) {
      return resolvedUrl;
    }
  } catch (error) {
    console.error("Error resolving Google share URL:", error);
  }

  return query;
}

/**
 * Cleans up a URL by removing query parameters
 */
function cleanUrl(url: string): string {
  if (url.includes("?")) {
    return url.substring(0, url.indexOf("?"));
  }
  return url;
}

/**
 * Main function to extract and process a URL from a query string
 */
export async function extractUrlFromQuery(query: string): Promise<string> {
  if (!query) return "";

  let processedUrl = extractHttpUrl(query);

  // Handle search.app URLs
  if (processedUrl.includes("search.app")) {
    processedUrl = await processSearchAppUrl(processedUrl);
  }

  // Handle Google share URLs
  if (processedUrl.includes("share.google")) {
    processedUrl = await processGoogleShareUrl(processedUrl);
  }

  // Clean up the final URL
  processedUrl = cleanUrl(processedUrl);

  return processedUrl;
}

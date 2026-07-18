/**
 * Extracts the original URL from an archive.is link
 * @param archiveUrl - The archive.is URL to extract from
 * @returns The original URL if found, null otherwise
 */
export function extractOriginalUrlFromArchive(
  archiveUrl: string
): string | null {
  try {
    const url = new URL(archiveUrl);

    // Check if it's an archive.is domain
    if (!isArchiveDomain(url.hostname)) {
      return null;
    }

    const extractedUrl =
      extractFromTimestampPattern(url.pathname) ||
      extractFromAlternativeTimestampPattern(url.pathname) ||
      extractFromHttpPattern(url.pathname) ||
      extractFromPathParts(url.pathname);

    if (!extractedUrl) {
      return null;
    }

    return validateAndDecodeUrl(extractedUrl);
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a URL is an archive.is link
 * @param url - The URL to check
 * @returns True if it's an archive.is link
 */
export function isArchiveUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return isArchiveDomain(urlObj.hostname);
  } catch {
    return false;
  }
}

// Helper functions for pattern matching
function isArchiveDomain(hostname: string): boolean {
  return (
    hostname.includes("archive.is") ||
    hostname.includes("archive.today") ||
    hostname.includes("archive.ph")
  );
}

function extractFromTimestampPattern(pathname: string): string | null {
  const match = pathname.match(/^\/[\d]{4}\.[\d]{2}\.[\d]{2}\/(.+)$/);
  return match ? match[1] : null;
}

function extractFromAlternativeTimestampPattern(
  pathname: string
): string | null {
  const match = pathname.match(/^\/[\d]{4}\.[\d]{2}\.[\d]{2}-(.+)$/);
  return match ? match[1] : null;
}

function extractFromHttpPattern(pathname: string): string | null {
  const match = pathname.match(/(https?:\/\/.+)$/);
  return match ? match[1] : null;
}

function extractFromPathParts(pathname: string): string | null {
  const pathParts = pathname.split("/");
  for (const part of pathParts) {
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return part;
    }
  }
  return null;
}

function validateAndDecodeUrl(url: string): string | null {
  try {
    // Try to decode the URL in case it's URL-encoded
    const decodedUrl = decodeURIComponent(url);
    new URL(decodedUrl);
    return decodedUrl;
  } catch {
    // If decoding fails, try the original
    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }
}

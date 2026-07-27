/**
 * Extracts the original URL from an archive.is / archive.today / archive.ph link.
 */
export function extractOriginalUrlFromArchive(
  archiveUrl: string
): string | null {
  try {
    const url = new URL(archiveUrl);

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
  } catch {
    return null;
  }
}

export function isArchiveUrl(url: string): boolean {
  try {
    return isArchiveDomain(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isArchiveDomain(hostname: string): boolean {
  return (
    hostname.includes("archive.is") ||
    hostname.includes("archive.today") ||
    hostname.includes("archive.ph") ||
    hostname.includes("archive.vn") ||
    hostname.includes("archive.fo")
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
    const decodedUrl = decodeURIComponent(url);
    new URL(decodedUrl);
    return decodedUrl;
  } catch {
    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }
}

export async function getUrlFromGoogleShare(query: string): Promise<string> {
  console.log("getUrlFromGoogleShare called with query:", query);

  // Extract the Google share URL from the query
  const googleShareMatch = query.match(
    /https:\/\/share\.google\/([a-zA-Z0-9]+)/
  );
  console.log("Google share match:", googleShareMatch);

  if (!googleShareMatch) {
    console.log("No Google share URL found in query");
    return query;
  }

  const googleShareUrl = googleShareMatch[0];
  const shareId = googleShareMatch[1];
  console.log("Extracted Google share URL:", googleShareUrl);
  console.log("Share ID:", shareId);

  // Transform share.google URL to the intermediate Google URL format
  // This skips the first redirect and allows the unshortener to follow just one redirect
  const intermediateUrl = `https://www.google.com/share.google?q=${shareId}`;
  console.log("Transformed to intermediate URL:", intermediateUrl);

  try {
    // Use the URL unshortener service to resolve the intermediate Google URL
    const unshortenerUrl = `https://url-unshortener.lvdw.workers.dev/?url=${intermediateUrl}`;
    console.log("Calling unshortener with:", unshortenerUrl);

    const response = await fetch(unshortenerUrl);
    const resolvedUrl = await response.text();
    console.log("Unshortener response:", resolvedUrl);

    // Return the resolved URL if it's valid and not still a Google URL
    if (
      resolvedUrl &&
      resolvedUrl.startsWith("http") &&
      !resolvedUrl.includes("google.com") &&
      !resolvedUrl.includes("share.google")
    ) {
      console.log("Using resolved URL:", resolvedUrl);
      return resolvedUrl;
    } else {
      console.log(
        "Resolved URL is not valid or still contains Google domains, falling back to original query"
      );
    }
  } catch (error) {
    console.error("Error resolving Google share URL:", error);
  }

  // Fallback: return the original query if resolution fails
  console.log("Returning original query as fallback");
  return query;
}

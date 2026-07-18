import { useEffect, useState } from "react";
import { extractUrlFromQuery } from "../utils/urlExtractor";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Build the raw share payload from PWA share-target params or the path.
 * Android/Chrome often put the link in `url` and the title in `text`.
 */
function getRawShareQuery(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const text = urlParams.get("text")?.trim() || "";
  const sharedUrl = urlParams.get("url")?.trim() || "";
  const title = urlParams.get("title")?.trim() || "";

  const parts = [text, sharedUrl, title].filter(Boolean);
  if (parts.length > 0) {
    // Prefer a combined payload so titled shares still include the URL.
    const unique = [...new Set(parts.map(safeDecode))];
    return unique.join(" ");
  }

  const pathQuery = window.location.pathname.slice(1);
  return pathQuery ? safeDecode(pathQuery) : "";
}

/**
 * Hook to extract and process URL queries from search parameters or path.
 */
export function useQuery() {
  const [query, setQuery] = useState("");
  const [extractedUrl, setExtractedUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const processQuery = async () => {
      const rawQuery = getRawShareQuery();
      if (cancelled) return;

      setQuery(rawQuery);

      if (!rawQuery) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await extractUrlFromQuery(rawQuery);
        if (cancelled) return;

        if (result.status === "ok") {
          setExtractedUrl(result.url);
          setError(null);
        } else if (result.status === "error") {
          setExtractedUrl("");
          setError(result.message);
        } else {
          setExtractedUrl("");
          setError(null);
        }
      } catch (extractError) {
        console.error("Error extracting URL:", extractError);
        if (!cancelled) {
          setExtractedUrl("");
          setError("Could not process share link");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void processQuery();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    query,
    extractedUrl,
    error,
    isLoading,
    hasQuery: query !== "",
    hasUrl: extractedUrl !== "",
  };
}

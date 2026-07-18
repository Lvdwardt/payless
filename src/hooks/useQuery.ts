import { useEffect, useState } from "react";
import { extractUrlFromQuery } from "../utils/urlExtractor";

/**
 * Hook to extract and process URL queries from search parameters or path
 */
export function useQuery() {
  const [query, setQuery] = useState<string>("");
  const [extractedUrl, setExtractedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const processQuery = async () => {
      // First check for 'text' parameter in URL search params
      const urlParams = new URLSearchParams(window.location.search);
      let rawQuery = urlParams.get("text") || "";

      // If no 'text' parameter, check the pathname
      if (!rawQuery) {
        rawQuery = window.location.pathname.slice(1);
      }

      // Decode the raw query
      if (rawQuery) {
        rawQuery = decodeURIComponent(rawQuery);
      }

      setQuery(rawQuery);

      // Extract URL from the query if it exists
      if (rawQuery) {
        try {
          const url = await extractUrlFromQuery(rawQuery);
          setExtractedUrl(url);
        } catch (error) {
          console.error("Error extracting URL:", error);
          setExtractedUrl("");
        }
      }

      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    };

    processQuery();
  }, []);

  return {
    query,
    extractedUrl,
    isLoading,
    hasQuery: query !== "",
    hasUrl: extractedUrl !== "",
  };
}

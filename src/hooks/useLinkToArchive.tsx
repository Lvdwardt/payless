import { useEffect, useState, startTransition } from "react";
import { getArchive } from "../utils/getArchive";
import useLocalStorageState from "use-local-storage-state";
import getArticle from "../utils/getArticle";
import { Font } from "@/types";
import { getProcessedQuery } from "../utils/urlProcessor";
import { ARCHIVE_CONFIG, APP_CONFIG } from "../lib/constants";

function useLinkToArchive(font: Font) {
  const [query, setQuery] = useState("");
  const [isInstalled] = useLocalStorageState("isInstalled", {
    defaultValue: false,
  });

  const [articleLink, setArticleLink] = useState("");
  const [article, setArticle] = useState("");
  const [error, setError] = useState("");

  const hasQuery = query !== "";
  const showAd = import.meta.env.VITE_SHOW_AD === "true";

  const timeBeforeRedirect = showAd
    ? Number(import.meta.env.VITE_TIME_BEFORE_REDIRECT) ||
      APP_CONFIG.DEFAULT_TIME_BEFORE_REDIRECT
    : 0;

  useEffect(() => {
    startTransition(() => {
      async function fetchData() {
        try {
          const encodedQuery = await getProcessedQuery();
          const decodedQuery = decodeURIComponent(encodedQuery);

          if (!decodedQuery) {
            return;
          }

          setQuery(decodedQuery);
          setError("");

          const link = await getArchive(decodedQuery, ARCHIVE_CONFIG.BASE_URL);

          if (link && link !== "No link found" && link !== "Not working") {
            setTimeout(() => {
              setArticleLink(link);

              getArticle(link, ARCHIVE_CONFIG.BASE_URL, decodedQuery, font)
                .then((articleContent) => {
                  if (articleContent) {
                    setArticle(articleContent);
                  } else {
                    setError("Failed to load article content");
                  }
                })
                .catch((articleError) => {
                  console.error("Article fetch error:", articleError);
                  setError("Failed to load article. Please try again.");
                });
            }, timeBeforeRedirect);
          } else if (link === "No link found") {
            setTimeout(() => {
              window.location.replace(
                `${ARCHIVE_CONFIG.BASE_URL}?run=1&url=${decodedQuery}`
              );
            }, timeBeforeRedirect);
          } else if (link === "Not working") {
            try {
              const domain = new URL(decodedQuery).hostname;
              setError(`I'm sorry, ${domain} is not working via this method.`);
            } catch (urlError) {
              setError(`Invalid URL format: ${decodedQuery}`);
            }
          }
        } catch (fetchError) {
          console.error("Fetch data error:", fetchError);
          setError("An unexpected error occurred. Please try again.");
        }
      }

      fetchData();
    });
  }, [font, timeBeforeRedirect]);

  return { isInstalled, hasQuery, article, articleLink, error, query };
}

export default useLinkToArchive;

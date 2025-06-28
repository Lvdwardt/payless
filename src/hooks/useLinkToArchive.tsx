import { useEffect, useState } from "react";
import { getArchive } from "@/utils/getArchive";
import useLocalStorageState from "use-local-storage-state";
import getArticle from "@/utils/getArticle";
import { Font } from "@/types";
import { getProcessedQuery } from "@/utils/urlProcessor";
import { ARCHIVE_CONFIG, APP_CONFIG } from "@/lib/constants";

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
    async function fetchData() {
      const encodedQuery = await getProcessedQuery();
      const query = decodeURIComponent(encodedQuery);

      if (!query) {
        return;
      }

      setQuery(query);
      const link = await getArchive(query, ARCHIVE_CONFIG.BASE_URL);

      if (link && link !== "No link found" && link !== "Not working") {
        setTimeout(() => {
          setArticleLink(link);
          getArticle(link, ARCHIVE_CONFIG.BASE_URL, query, font).then(
            (article) => {
              setArticle(article);
            }
          );
        }, timeBeforeRedirect);
      } else if (link === "No link found") {
        setTimeout(() => {
          window.location.replace(
            `${ARCHIVE_CONFIG.BASE_URL}?run=1&url=${query}`
          );
        }, timeBeforeRedirect);
      } else if (link === "Not working") {
        const domain = new URL(query).hostname;
        setError(`I'm sorry, ${domain} is not working via this method.`);
      }
    }

    fetchData();
  }, [font, timeBeforeRedirect]);

  return { isInstalled, hasQuery, article, articleLink, error, query };
}

export default useLinkToArchive;

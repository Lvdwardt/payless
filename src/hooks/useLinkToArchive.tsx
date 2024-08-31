const BASE_URL = "https://archive.is/";
import { useEffect, useState } from "react";
import { getArchive } from "@/utils/getArchive";
import useLocalStorageState from "use-local-storage-state";
import getArticle from "@/utils/getArticle";
import { Font } from "@/types";

export default function useLinkToArchive(font: Font) {
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
    ? Number(import.meta.env.VITE_TIME_BEFORE_REDIRECT) || 500
    : 0;

  useEffect(() => {
    async function fetchData() {
      const params = new URLSearchParams(window.location.search);
      let query = params.get("text") || "";
      if (query.includes("http")) {
        query = query.slice(query.indexOf("http"));
      }
      if (query.includes("?")) {
        query = query.slice(0, query.indexOf("?"));
      }

      if (query === "") {
        query = window.location.pathname.slice(1);
      }

      if (query === "") {
        return;
      }
      setQuery(query);
      const link = await getArchive(query, BASE_URL);
      if (link && link !== "No link found" && link !== "Not working") {
        setTimeout(() => {
          setArticleLink(link);
          getArticle(link, BASE_URL, query, font).then((article) => {
            setArticle(article);
          });
        }, timeBeforeRedirect);
      } else if (link === "No link found") {
        setTimeout(() => {
          window.location.replace(`${BASE_URL}?run=1&url=${query}`);
        }, timeBeforeRedirect);
      } else if (link === "Not working") {
        // website user wants to archive is not working
        setError(
          `I'm sorry, ${query.split("/")[2]} is not working via this method.`
        );
      }
    }
    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isInstalled, hasQuery, article, articleLink, error };
}

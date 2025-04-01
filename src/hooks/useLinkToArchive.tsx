import { useEffect, useState } from "react";
import { getArchive } from "@/utils/getArchive";
import useLocalStorageState from "use-local-storage-state";
import getArticle from "@/utils/getArticle";
import { Font } from "@/types";
import { getUrlFromSearchApp } from "@/utils/getUrlFromSearchApp";

const BASE_URL = "https://archive.is/";

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
      const encodedQuery = await getQuery();
      const query = decodeURIComponent(encodedQuery);

      if (!query) {
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
        const domain = new URL(query).hostname;
        setError(`I'm sorry, ${domain} is not working via this method.`);
      }
    }

    fetchData();
  }, []);

  async function getQuery() {
    let query = getQueryParam("text");

    if (!query) {
      query = await extractHrefFromWindow();
    }
    query = await processQuery(query);

    return query;
  }

  function getQueryParam(paramName: string) {
    const params = new URLSearchParams(window.location.search);
    return params.get(paramName) || "";
  }

  async function extractHrefFromWindow() {
    return window.location.pathname.slice(1);
  }

  async function processQuery(query: string) {
    if (query.includes("http")) {
      query = query.substring(query.indexOf("http"));
    }

    if (query.includes("search.app")) {
      query = await getUrlFromSearchApp(query);
    }

    if (query.includes("?")) {
      query = query.substring(0, query.indexOf("?"));
    }

    return query;
  }

  return { isInstalled, hasQuery, article, articleLink, error, query };
}

const BASE_URL = "https://archive.is/";
import { useEffect, useState } from "react";
import { getArchive } from "../utils/getArchive";
import useLocalStorageState from "use-local-storage-state";

export default function useLinkToArchive() {
  const [query, setQuery] = useState("");
  const [isInstalled] = useLocalStorageState("isInstalled", {
    defaultValue: false,
  });

  const hasQuery = query !== "";
  const showAd = import.meta.env.VITE_SHOW_AD === "true";

  const timeBeforeRedirect = showAd
    ? Number(import.meta.env.VITE_TIME_BEFORE_REDIRECT) || 500
    : 0;

  useEffect(() => {
    async function fetchData() {
      const params = new URLSearchParams(window.location.search);

      let query = params.get("text") || "";

      if (query === "") {
        query = window.location.pathname.slice(1);
      }

      setQuery(query);
      const link = await getArchive(query, BASE_URL);
      if (link && link !== "No link found") {
        setTimeout(() => {
          window.location.replace(link);
        }, timeBeforeRedirect);
      } else if (link === "No link found") {
        setTimeout(() => {
          window.location.replace(`${BASE_URL}?run=1&url=${query}`);
        }, timeBeforeRedirect);
      } else {
        return;
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isInstalled, hasQuery };
}

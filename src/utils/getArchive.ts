import { parse } from "node-html-parser";
import { notWorkingList } from "@/data/notWorkingList";
import { trackEvent } from "@/hooks/useUmami";

export async function getArchive(query: string, archive: string) {
  function validURL(str: string) {
    const pattern = new RegExp(
      "^(https?:\\/\\/)?" + // protocol
        "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
        "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
        "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
        "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
        "(\\#[-a-z\\d_]*)?$",
      "i"
    ); // fragment locator
    return !!pattern.test(str);
  }

  if (!query || !validURL(query)) {
    alert(`invalid query: ${query}`);
    return "";
  }

  const website = query.split("/")[2];

  if (notWorkingList.includes(website)) {
    trackEvent("not working", {
      website: website,
    });

    return "Not working";
  }

  const url = `${archive}${query}`;
  try {
    const data = await fetch(url).then((res) => res.text());
    const root = parse(data);

    const link = root.querySelector(".TEXT-BLOCK a")?.getAttribute("href");
    if (link) {
      trackEvent("working", {
        website: website,
      });
      return link;
    } else {
      trackEvent("no link found", {
        website: website,
      });
      return "No link found";
    }
  } catch (error) {
    trackEvent("error", {
      website: website,
      error: error,
    });
    console.log(error);
    return "No link found";
  }
}

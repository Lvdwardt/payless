import { parse } from "node-html-parser";
import { notWorkingList } from "../data/notWorkingList";
import { trackEvent } from "../hooks/useUmami";
import { SELECTORS } from "../lib/constants";

export async function getArchive(query: string, archive: string) {
  console.log("getArchive called with query:", query);
  console.log("Archive base URL:", archive);

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
    console.log("Invalid query:", query);
    alert(`invalid query: ${query}`);
    return "";
  }

  const website = query.split("/")[2];
  console.log("Website domain:", website);

  if (notWorkingList.includes(website)) {
    console.log("Website in not working list:", website);
    trackEvent("not working", {
      website: website,
    });

    return "Not working";
  }

  const url = `${archive}${query}`;
  console.log("Fetching archive URL:", url);

  try {
    console.log("Starting fetch...");
    const response = await fetch(url);
    console.log("Fetch response status:", response.status);

    const data = await response.text();
    console.log("Fetch response data length:", data.length);
    console.log("First 500 chars of response:", data.substring(0, 500));

    const root = parse(data);

    const link = root
      .querySelector(SELECTORS.ARCHIVE_LINK)
      ?.getAttribute("href");

    console.log(
      "Found link with selector:",
      SELECTORS.ARCHIVE_LINK,
      "->",
      link
    );

    if (link) {
      console.log("Archive link found:", link);
      trackEvent("working", {
        website: website,
      });
      return link;
    } else {
      console.log(
        "No archive link found, looking for alternative selectors..."
      );

      // Try alternative selectors
      const alternatives = [
        "a[href*='archive.is']",
        "a[href*='archive.today']",
        "a[href*='archive.ph']",
        ".TEXT-BLOCK",
        "a",
      ];

      for (const selector of alternatives) {
        const altLink = root.querySelector(selector)?.getAttribute("href");
        if (altLink) {
          console.log(
            `Found link with alternative selector ${selector}:`,
            altLink
          );
          break;
        }
      }

      trackEvent("no link found", {
        website: website,
      });
      return "No link found";
    }
  } catch (error) {
    console.error("Error in getArchive:", error);
    trackEvent("error", {
      website: website,
      error: error,
    });
    return "No link found";
  }
}

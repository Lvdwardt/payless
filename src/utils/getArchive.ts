import * as cheerio from "cheerio";

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
    return "";
  }

  const url = `${archive}${query}`;
  try {
    const data = await fetch(url).then((res) => res.text());
    const $ = cheerio.load(data);
    const firstLink = $(".TEXT-BLOCK a").first().attr("href");
    return firstLink || "No link found";
  } catch (error) {
    console.log(error);
    return "No link found";
  }
}

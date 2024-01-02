import * as cheerio from "cheerio";

export async function getArchiveToday(query: string) {
  if (!query) {
    return "";
  }

  const url = `https://archive.is/${query}`;
  try {
    const data = await fetch(url).then((res) => res.text());
    const $ = cheerio.load(data);
    const firstLink = $(".TEXT-BLOCK a").first().attr("href");
    return firstLink || "";
  } catch (error) {
    console.log(error);
    return "";
  }
}

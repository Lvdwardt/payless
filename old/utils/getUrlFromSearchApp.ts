export async function getUrlFromSearchApp(query: string) {
  const linkMatch = query.match(/link=([^&]+)/);
  if (linkMatch) {
    return linkMatch[1];
  }

  const urlPart = query.split(" ")[0];

  const url = await fetch(
    `https://url-unshortener.lvdw.workers.dev/?url=${urlPart}`
  );
  const data = await url.text();

  return data;
}

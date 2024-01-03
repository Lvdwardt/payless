export function getQuery(param: string = "text") {
  const params = new URLSearchParams(window.location.search);
  return params.get(param) || "";
}

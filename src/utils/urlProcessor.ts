import { getUrlFromSearchApp } from "./getUrlFromSearchApp";
import { getUrlFromGoogleShare } from "./getUrlFromGoogleShare";

/**
 * Gets query parameter from URL
 */
export function getQueryParam(paramName: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(paramName) || "";
}

/**
 * Extracts query from window pathname
 */
export function extractQueryFromPath(): string {
  return window.location.pathname.slice(1);
}

/**
 * Processes and cleans up query URL
 */
export async function processQueryUrl(query: string): Promise<string> {
  console.log("processQueryUrl called with:", query);
  let processedQuery = query;

  // Extract HTTP URL if embedded in query
  if (processedQuery.includes("http")) {
    console.log("Query contains http, extracting URL part");
    processedQuery = processedQuery.substring(processedQuery.indexOf("http"));
    console.log("Extracted URL:", processedQuery);
  }

  // Handle search.app URLs
  if (processedQuery.includes("search.app")) {
    console.log("Processing search.app URL");
    processedQuery = await getUrlFromSearchApp(processedQuery);
  }

  // Handle Google share URLs
  if (processedQuery.includes("share.google")) {
    console.log("Processing Google share URL");
    processedQuery = await getUrlFromGoogleShare(processedQuery);
    console.log("After Google share processing:", processedQuery);
  }

  // Remove query parameters
  if (processedQuery.includes("?")) {
    console.log("Removing query parameters");
    processedQuery = processedQuery.substring(0, processedQuery.indexOf("?"));
  }

  console.log("Final processed URL:", processedQuery);
  return processedQuery;
}

/**
 * Gets and processes the main query from URL parameters or path
 */
export async function getProcessedQuery(): Promise<string> {
  console.log("getProcessedQuery called");
  let query = getQueryParam("text");
  console.log("Raw text parameter:", query);

  if (!query) {
    console.log("No text parameter, extracting from path");
    query = extractQueryFromPath();
    console.log("Path query:", query);
  }

  console.log("Processing query URL...");
  query = await processQueryUrl(query);
  console.log("Processed query:", query);

  const encodedQuery = encodeURIComponent(query);
  console.log("Final encoded query:", encodedQuery);
  return encodedQuery;
}

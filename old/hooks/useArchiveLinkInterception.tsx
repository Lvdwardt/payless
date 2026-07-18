import { useEffect, RefObject } from "react";
import { trackEvent } from "./useUmami";
import {
  extractOriginalUrlFromArchive,
  isArchiveUrl,
} from "../utils/extractOriginalUrl";

interface UseArchiveLinkInterceptionProps {
  contentRef: RefObject<HTMLElement | null>;
  isEnabled: boolean;
}

export function useArchiveLinkInterception({
  contentRef,
  isEnabled,
}: UseArchiveLinkInterceptionProps) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleLinkClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const contentElement = contentRef.current;

      // Only handle clicks within our article content
      if (!contentElement || !contentElement.contains(target)) {
        return;
      }

      const anchor = target.closest("a");
      if (!anchor?.href || !isArchiveUrl(anchor.href)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const originalUrl = extractOriginalUrlFromArchive(anchor.href);

      if (originalUrl) {
        // Track the event
        try {
          trackEvent("archive link intercepted", {
            archiveUrl: anchor.href,
            originalUrl: originalUrl,
          });
        } catch (error) {
          console.error("Error tracking archive link event:", error);
        }

        // Navigate to payless with the original URL
        const paylessUrl = `${
          window.location.origin
        }/?text=${encodeURIComponent(originalUrl)}`;
        window.location.href = paylessUrl;
      } else {
        // If we can't extract the original URL, open in new tab
        window.open(anchor.href, "_blank");
      }
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [contentRef, isEnabled]);
}

import { useEffect, type RefObject } from "react";
import { trackEvent } from "@/hooks/useUmami";
import {
  extractOriginalUrlFromArchive,
  isArchiveUrl,
} from "@/utils/extractOriginalUrl";

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
        try {
          trackEvent("archive link intercepted", {
            archiveUrl: anchor.href,
            originalUrl,
          });
        } catch (error) {
          console.error("Error tracking archive link event:", error);
        }

        window.location.href = `${window.location.origin}/?text=${encodeURIComponent(originalUrl)}`;
        return;
      }

      window.open(anchor.href, "_blank");
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [contentRef, isEnabled]);
}

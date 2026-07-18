import { useEffect, useRef, startTransition } from "react";
import { trackEvent } from "@/hooks/useUmami";
import { useArchiveLinkInterception } from "@/hooks/useArchiveLinkInterception";
import { APP_CONFIG } from "@/lib/constants";
import type { Font } from "@/types/font";

interface ArticleReaderProps {
  article: string;
  articleLink: string;
  font: Font;
  onFontChange: (font: Font) => void;
}

export function ArticleReader({
  article,
  articleLink,
  font,
  onFontChange,
}: ArticleReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useArchiveLinkInterception({
    contentRef,
    isEnabled: !!article,
  });

  useEffect(() => {
    if (!article || !contentRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        try {
          const contentElement = contentRef.current;
          if (!contentElement) return;

          const contentRect = contentElement.getBoundingClientRect();
          const viewportWidth = document.documentElement.clientWidth;
          const availableWidth = viewportWidth - 32;

          const html = document.querySelector("html");
          if (!html) return;

          if (contentRect.width > availableWidth) {
            const zoomLevel = availableWidth / contentRect.width;
            html.style.zoom = `${Math.max(0.45, Math.min(1, zoomLevel))}`;
          } else {
            html.style.zoom = "1";
          }
        } catch (error) {
          console.error("Error adjusting article zoom:", error);
        }
      });
    }, 100);

    return () => {
      window.clearTimeout(timeoutId);
      const html = document.querySelector("html");
      if (html) {
        html.style.zoom = "1";
      }
    };
  }, [article]);

  const handleFontScaleChange = (scale: number) => {
    startTransition(() => {
      onFontChange({ ...font, scale });
      window.location.reload();
    });
  };

  const handleLineHeightChange = (height: number | undefined) => {
    startTransition(() => {
      onFontChange({ ...font, height });
      window.location.reload();
    });
  };

  const handleViewArchiveClick = () => {
    try {
      trackEvent("go to article", {
        articleLink,
      });
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  };

  return (
    <>
      <link rel="canonical" href={articleLink} />
      <meta property="og:url" content={articleLink} />

      <div className="w-fit mx-auto" ref={contentRef}>
        <div className="flex justify-between items-center gap-4 p-4">
          <a
            href={articleLink}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline transition-colors"
            onClick={handleViewArchiveClick}
          >
            View on archive.today
          </a>

          <div className="flex flex-col items-end gap-2 text-sm text-foreground">
            <div className="flex items-center">
              <label htmlFor="font-scale" className="mr-2">
                Font size:
              </label>
              <select
                id="font-scale"
                className="rounded border border-border bg-background px-2 py-1 text-foreground"
                value={font.scale}
                onChange={(e) => handleFontScaleChange(Number(e.target.value))}
                aria-label="Select font scale"
              >
                {APP_CONFIG.FONT_SCALE_OPTIONS.map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}x
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label htmlFor="line-height" className="mr-2">
                Line height:
              </label>
              <select
                id="line-height"
                className="rounded border border-border bg-background px-2 py-1 text-foreground"
                value={font.height || ""}
                onChange={(e) =>
                  handleLineHeightChange(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                aria-label="Select line height"
              >
                <option value="">unset</option>
                {APP_CONFIG.FONT_SCALE_OPTIONS.map((height) => (
                  <option key={height} value={height}>
                    {height}x
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <article
          className="flex lg:justify-center revert-box-sizing"
          dangerouslySetInnerHTML={{ __html: article }}
          role="main"
          aria-label="Article content"
        />
      </div>
    </>
  );
}

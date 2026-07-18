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

    const html = document.documentElement;
    let cancelled = false;
    let frameId = 0;
    let orientationTimeoutId = 0;

    const getViewportWidth = () =>
      window.visualViewport?.width ?? document.documentElement.clientWidth;

    const applyZoom = () => {
      if (cancelled) return;

      const contentElement = contentRef.current;
      if (!contentElement) return;

      // Reset before measuring so widths are in unscaled layout pixels.
      html.style.zoom = "1";

      const contentWidth = Math.max(
        contentElement.scrollWidth,
        contentElement.getBoundingClientRect().width
      );
      const availableWidth = getViewportWidth() - 8;

      if (contentWidth > availableWidth) {
        // Slight under-zoom avoids residual horizontal overflow from
        // subpixels / late layout that still forces a pinch zoom-out.
        const zoomLevel = (availableWidth / contentWidth) * 0.98;
        html.style.zoom = `${Math.max(0.45, Math.min(1, zoomLevel))}`;
      } else {
        html.style.zoom = "1";
      }
    };

    const scheduleZoom = () => {
      frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(() => {
          startTransition(() => {
            try {
              applyZoom();
            } catch (error) {
              console.error("Error adjusting article zoom:", error);
            }
          });
        });
      });
    };

    const waitForImages = (element: HTMLElement) => {
      const images = [...element.querySelectorAll("img")];
      if (images.length === 0) return Promise.resolve();

      return Promise.race([
        Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
          )
        ),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1500);
        }),
      ]).then(() => undefined);
    };

    const run = async () => {
      try {
        const contentElement = contentRef.current;
        if (!contentElement) return;

        await waitForImages(contentElement);
        if (cancelled) return;

        scheduleZoom();
      } catch (error) {
        console.error("Error adjusting article zoom:", error);
      }
    };

    void run();

    const onOrientationChange = () => {
      window.clearTimeout(orientationTimeoutId);
      orientationTimeoutId = window.setTimeout(() => {
        scheduleZoom();
      }, 250);
    };

    window.addEventListener("orientationchange", onOrientationChange);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(orientationTimeoutId);
      window.removeEventListener("orientationchange", onOrientationChange);
      html.style.zoom = "1";
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

import { useEffect, useRef, startTransition } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "@/hooks/useUmami";
import { useArchiveLinkInterception } from "@/hooks/useArchiveLinkInterception";
import { Button } from "@/components/ui/button";
import { NativeArticleReader } from "@/components/native-article-reader";
import type { NativeArticle } from "@/types/article";
import type { ReaderExperience } from "@/types/reader-experience";

interface ArticleReaderProps {
  mode: "legacy" | "native";
  articleHtml: string;
  nativeArticle: NativeArticle | null;
  articleLink: string;
  experience: ReaderExperience;
  onExperienceChange: (experience: ReaderExperience) => void;
}

export function ArticleReader({
  mode,
  articleHtml,
  nativeArticle,
  articleLink,
  experience,
  onExperienceChange,
}: ArticleReaderProps) {
  const { t } = useTranslation();
  const showNativeFallbackNote = experience === "native" && mode === "legacy";

  return (
    <>
      <link rel="canonical" href={articleLink} />
      <meta property="og:url" content={articleLink} />

      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-4">
        <div
          role="group"
          aria-label={t("reader.experienceToggleLabel")}
          className="inline-flex rounded-md border border-border p-0.5"
        >
          <Button
            type="button"
            size="sm"
            variant={experience === "legacy" ? "default" : "ghost"}
            onClick={() => onExperienceChange("legacy")}
          >
            {t("reader.legacy")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={experience === "native" ? "default" : "ghost"}
            onClick={() => onExperienceChange("native")}
          >
            {t("reader.native")}
          </Button>
        </div>
      </div>

      {showNativeFallbackNote && (
        <p className="mx-auto max-w-3xl px-4 pt-2 text-xs text-muted-foreground">
          {t("reader.nativeFallbackNote")}
        </p>
      )}

      {mode === "native" && nativeArticle ? (
        <NativeArticleReader
          article={nativeArticle}
          articleLink={articleLink}
        />
      ) : (
        <LegacyArticleReader article={articleHtml} articleLink={articleLink} />
      )}
    </>
  );
}

interface LegacyArticleReaderProps {
  article: string;
  articleLink: string;
}

function LegacyArticleReader({
  article,
  articleLink,
}: LegacyArticleReaderProps) {
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
      </div>

      <article
        className="flex lg:justify-center revert-box-sizing"
        dangerouslySetInnerHTML={{ __html: article }}
        role="main"
        aria-label="Article content"
      />
    </div>
  );
}

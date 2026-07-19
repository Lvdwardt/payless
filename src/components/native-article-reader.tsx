import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/hooks/useUmami";
import { useArchiveLinkInterception } from "@/hooks/useArchiveLinkInterception";
import { useReaderFontSize } from "@/hooks/useReaderFontSize";
import {
  READER_FONT_SIZES,
  stepReaderFontSize,
} from "@/lib/reader-font";
import type { NativeArticle } from "@/types/article";

interface NativeArticleReaderProps {
  article: NativeArticle;
  articleLink: string;
}

/**
 * Gotham draws U+00A0 (NBSP) with a ~450px advance — it looks like a hole in
 * the line ("verduidelijken······dat"). Collapse every NBSP form to a normal space.
 */
function prepareContentHtml(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00A0/g, " ");
}

/**
 * Native (v2) reader: renders a `NativeArticle` with Payless's own layout
 * instead of injecting foreign markup. There is no page-level zoom hack.
 */
export function NativeArticleReader({
  article,
  articleLink,
}: NativeArticleReaderProps) {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useReaderFontSize();
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useArchiveLinkInterception({
    contentRef,
    isEnabled: true,
  });

  // Belt-and-suspenders: even if an NBSP slips past HTML prep, scrub it from
  // live text nodes so Gotham cannot paint a 450px-wide "space".
  useLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue?.includes("\u00A0")) {
        node.nodeValue = node.nodeValue.replace(/\u00A0/g, " ");
      }
      node = walker.nextNode();
    }
  }, [article.content]);

  const handleViewArchiveClick = () => {
    try {
      trackEvent("go to article", { articleLink });
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  };

  const minFontSize = READER_FONT_SIZES[0];
  const maxFontSize = READER_FONT_SIZES[READER_FONT_SIZES.length - 1];

  return (
    <div className="mx-auto max-w-2xl px-4" ref={contentRef}>
      <div className="flex justify-between items-center gap-4 py-4">
        <a
          href={articleLink}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline transition-colors"
          onClick={handleViewArchiveClick}
        >
          View on archive.today
        </a>

        <div
          role="group"
          aria-label={t("reader.fontSizeLabel")}
          className="inline-flex items-center rounded-md border border-border p-0.5"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 px-0"
            disabled={fontSize <= minFontSize}
            onClick={() => setFontSize(stepReaderFontSize(fontSize, -1))}
            aria-label={t("reader.fontSizeDecrease")}
          >
            <span className="text-[11px] font-semibold leading-none">A</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 px-0"
            disabled={fontSize >= maxFontSize}
            onClick={() => setFontSize(stepReaderFontSize(fontSize, 1))}
            aria-label={t("reader.fontSizeIncrease")}
          >
            <span className="text-[15px] font-semibold leading-none">A</span>
          </Button>
        </div>
      </div>

      <article
        className="pb-12 [&_p]:my-4 [&_p]:leading-relaxed [&_figure]:my-6 [&_figure]:text-center [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_picture]:mx-auto [&_picture]:block [&_picture]:w-auto [&_picture]:max-w-full [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold [&_a]:text-primary [&_a]:underline [&_section]:m-0 [&_section]:p-0 [&_[data-payless-dek]]:text-[1.15em] [&_[data-payless-dek]]:leading-snug [&_[data-payless-dek]]:text-foreground/90 [&_[data-payless-aside]]:my-6 [&_[data-payless-aside]]:rounded-lg [&_[data-payless-aside]]:border [&_[data-payless-aside]]:border-border/60 [&_[data-payless-aside]]:bg-muted/40 [&_[data-payless-aside]]:px-4 [&_[data-payless-aside]]:py-3 [&_[data-payless-aside]]:text-[0.92em] [&_[data-payless-aside]]:leading-snug [&_[data-payless-aside]_p]:my-2 [&_[data-payless-author]]:my-6 [&_[data-payless-author]]:flex [&_[data-payless-author]]:items-center [&_[data-payless-author]]:gap-3 [&_[data-payless-author]]:text-left [&_[data-payless-author]_figure]:my-0 [&_[data-payless-author]_img]:m-0 [&_[data-payless-author]_img]:h-12 [&_[data-payless-author]_img]:w-12 [&_[data-payless-author]_img]:rounded-full [&_[data-payless-author]_img]:object-cover [&_[data-payless-author-meta]_p]:my-0 [&_[data-payless-author-name]]:text-base [&_[data-payless-author-name]]:font-medium [&_[data-payless-author-name]]:text-foreground [&_[data-payless-author-meta]_p:not([data-payless-author-name])]:text-sm [&_[data-payless-author-meta]_p:not([data-payless-author-name])]:text-muted-foreground"
        role="main"
        aria-label="Article content"
      >
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground text-pretty wrap-break-word">
          {article.title}
        </h1>
        {article.byline ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("reader.bylinePrefix")}{" "}
            <span className="font-medium text-foreground">{article.byline}</span>
          </p>
        ) : null}
        <div
          ref={bodyRef}
          className="mt-6"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{
            __html: prepareContentHtml(article.content),
          }}
        />
      </article>
    </div>
  );
}

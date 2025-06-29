import { useEffect, useRef } from "react";
import { trackEvent } from "../hooks/useUmami";
import { Font } from "@/types";
import { APP_CONFIG } from "../lib/constants";

interface ArticleReaderProps {
  article: string;
  articleLink: string;
  font: Font;
  onFontChange: (font: Font) => void;
}

export default function ArticleReader({
  article,
  articleLink,
  font,
  onFontChange,
}: ArticleReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Fit article to screen
  useEffect(() => {
    if (!article || !contentRef.current) {
      return;
    }

    const contentWidth = contentRef.current.getBoundingClientRect().width;
    const viewportWidth = document.documentElement.clientWidth;

    if (viewportWidth > contentWidth) {
      return;
    }

    const html = document.querySelector("html");
    if (html) {
      html.style.zoom = `${viewportWidth / contentWidth}`;
    }
  }, [article]);

  const handleFontScaleChange = (scale: number) => {
    onFontChange({ ...font, scale });
    window.location.reload();
  };

  const handleLineHeightChange = (height: number | undefined) => {
    onFontChange({ ...font, height });
    window.location.reload();
  };

  return (
    <div className="w-fit mx-auto" ref={contentRef}>
      {/* Article Controls */}
      <div className="flex justify-between items-center p-4">
        <a
          href={articleLink}
          target="_blank"
          rel="noreferrer"
          className="text-white"
          onClick={() => {
            trackEvent("go to article", {
              articleLink,
            });
          }}
        >
          View on archive.today
        </a>

        <div className="flex flex-col items-end">
          <div className="flex items-center">
            <label className="text-white mr-2">Font size:</label>
            <select
              className="text-black"
              value={font.scale}
              onChange={(e) => handleFontScaleChange(Number(e.target.value))}
            >
              {APP_CONFIG.FONT_SCALE_OPTIONS.map((scale) => (
                <option key={scale} value={scale}>
                  {scale} x
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <label className="text-white mr-2">Line height:</label>
            <select
              className="text-black"
              value={font.height || ""}
              onChange={(e) =>
                handleLineHeightChange(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            >
              <option value="">unset</option>
              {APP_CONFIG.FONT_SCALE_OPTIONS.map((height) => (
                <option key={height} value={height}>
                  {height} x
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div
        className="flex lg:justify-center revert-box-sizing"
        dangerouslySetInnerHTML={{ __html: article }}
      />
    </div>
  );
}

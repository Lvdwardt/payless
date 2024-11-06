import useLocalStorageState from "use-local-storage-state";
import Timer from "./components/timer";
import useLinkToArchive from "./hooks/useLinkToArchive";
import usePwa from "./hooks/usePwa";
import { useEffect, useRef } from "react";
import { trackEvent } from "./hooks/useUmami";
import Loader from "./components/loader";

export default function App() {
  const [font, setFont] = useLocalStorageState("font", {
    defaultValue: {
      scale: 1,
      height: undefined as number | undefined,
    },
  });

  const { isInstalled, hasQuery, article, articleLink, error, query } =
    useLinkToArchive(font);

  // fit article to screen
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!article) {
      return;
    }
    if (contentRef.current) {
      const contentWidth = contentRef.current.getBoundingClientRect().width;
      const viewportWidth = document.documentElement.clientWidth;
      if (viewportWidth > contentWidth) {
        return;
      }
      const html = document.querySelector("html");
      if (html) {
        html.style.zoom = `${viewportWidth / contentWidth}`;
      }
    }
  }, [article]);

  const showAd = import.meta.env.VITE_SHOW_AD === "true";
  // render the article if it exists
  if (article !== "") {
    return (
      <div className="w-fit mx-auto" ref={contentRef}>
        {/* //go to article */}
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
                onChange={(e) => {
                  setFont((prev) => ({
                    ...prev,
                    scale: Number(e.target.value),
                  }));
                  window.location.reload();
                }}
              >
                {Array.from(Array(7).keys()).map((i) => {
                  return (
                    <option key={i} value={0.5 + i * 0.25}>
                      {0.5 + i * 0.25} x
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-center">
              <label className="text-white mr-2">Line height:</label>

              <select
                className="text-black"
                value={font.height}
                onChange={(e) => {
                  setFont((prev) => ({
                    ...prev,
                    height: Number(e.target.value),
                  }));
                  window.location.reload();
                }}
              >
                <option value={undefined}>unset</option>

                {Array.from(Array(7).keys()).map((i) => {
                  return (
                    <option key={i} value={0.5 + i * 0.25}>
                      {0.5 + i * 0.25} x
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <div
          className="flex lg:justify-center revert-box-sizing"
          dangerouslySetInnerHTML={{ __html: article }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-bold p-8 bg-[#1f295b] font-sans text-white tailwind-base">
      <nav className="flex justify-between items-center pb-8">
        <img src="/payless_small.png" alt="logo" className="w-20" />
      </nav>
      <div className="w-full lg:px-32">
        <h1 className="text-2xl sm:text-5xl">Welcome to PayLess!</h1>
        <h2 className="text-xl sm:text-3xl pt-4 pb-8">
          The easiest way to skip the paywall.
        </h2>
        {hasQuery && <Loader />}
        {hasQuery && (
          <div className="flex flex-col">
            <span className="text-balance text-sm mt-4">loading: {query}</span>
            <span className="text-sm mt-4">
              view on archive.is{" "}
              <a href={`https://archive.is/${query}`}>here</a>
            </span>
          </div>
        )}
        {/* {hasQuery && <div>Advertisement</div>} */}
        {hasQuery && error && <h2>{error}</h2>}
        {hasQuery && showAd && (
          <p className="text-xl sm:text-3xl pt-4 pb-8">
            <Timer />
          </p>
        )}
        {!isInstalled && !hasQuery && <DownloadPWA />}
        <div className="lg:hidden">
          {isInstalled && !hasQuery && (
            <>
              <h3 className="text-lg sm:text-2xl pb-4">
                PayLess is installed! Here is how to use it:
              </h3>
              <ol className="text-base sm:text-xl pl-4">
                <li>1. go to the article you want to read.</li>
                <li>2. if you encounter a paywall, press the share button.</li>
                <li>3. find and tap the "PayLess" icon.</li>
                <li>4. read the article!</li>
              </ol>
              <p className="pt-2">
                If you don't see the PayLess button in the share menu, try
                installing PayLess inside the Google Chrome app. If you're
                already on Chrome, try refreshing the page. You might find the
                "install app" button by pressing the three dots in the top right
                corner of your screen.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export const DownloadPWA = () => {
  const { onClick } = usePwa();

  return (
    <div>
      <h3 className="text-lg sm:text-2xl pb-4">how to install:</h3>
      <ol className="text-base sm:text-xl pl-4 pb-8">
        <li>1. On your phone, open this page in the Google Chrome browser</li>
        <li className="flex flex-col">
          <p>2. clik on the button below.</p>
          <button
            className="my-2 bg-[#A96CDA] text-white px-4 py-2 rounded-lg w-fit "
            id="setup_button"
            aria-label="Install app"
            title="Install app"
            onClick={onClick}
          >
            Install
          </button>
        </li>
        <li>3. Tap "Add to Home Screen".</li>
      </ol>
    </div>
  );
};

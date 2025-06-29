import useLocalStorageState from "use-local-storage-state";
import useLinkToArchive from "./hooks/useLinkToArchive";
import ArticleReader from "./components/ArticleReader";
import LoadingState from "./components/LoadingState";
import InstallationGuide from "./components/InstallationGuide";
import { COLORS } from "./lib/constants";
import { Font } from "./types";

export default function App() {
  const [font, setFont] = useLocalStorageState<Font>("font", {
    defaultValue: {
      scale: 1,
      height: undefined,
    },
  });

  const { isInstalled, hasQuery, article, articleLink, error, query } =
    useLinkToArchive(font);

  const showAd = import.meta.env.VITE_SHOW_AD === "true";

  // Render article if it exists
  if (article !== "") {
    return (
      <ArticleReader
        article={article}
        articleLink={articleLink}
        font={font}
        onFontChange={setFont}
      />
    );
  }

  return (
    <div
      className="min-h-screen font-bold p-8 font-sans text-white tailwind-base"
      style={{ backgroundColor: COLORS.PRIMARY }}
    >
      <nav className="flex justify-between items-center pb-8">
        <img src="/payless_small.png" alt="PayLess logo" className="w-20" />
      </nav>

      {hasQuery ? (
        <LoadingState query={query} error={error} showAd={showAd} />
      ) : (
        <div className="w-full lg:px-32">
          <h1 className="text-2xl sm:text-5xl">Welcome to PayLess!</h1>
          <h2 className="text-xl sm:text-3xl pt-4 pb-8">
            The easiest way to skip the paywall.
          </h2>
          <InstallationGuide isInstalled={isInstalled} />
        </div>
      )}
    </div>
  );
}

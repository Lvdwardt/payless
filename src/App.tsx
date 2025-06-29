import { Suspense } from "react";
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

  const pageTitle = article
    ? "PayLess - Article Reader"
    : "PayLess - Skip the Paywall";
  const pageDescription = article
    ? "Reading article with PayLess paywall bypass tool"
    : "The easiest way to skip the paywall and read articles for free";

  // Render article if it exists
  if (article !== "") {
    return (
      <>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        <Suspense
          fallback={
            <LoadingState query="Loading article..." error="" showAd={false} />
          }
        >
          <ArticleReader
            article={article}
            articleLink={articleLink}
            font={font}
            onFontChange={setFont}
          />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />

      <div
        className="min-h-screen font-bold p-8 font-sans text-white tailwind-base"
        style={{ backgroundColor: COLORS.PRIMARY }}
      >
        <nav className="flex justify-between items-center pb-8">
          <img
            src="/payless_small.webp"
            alt="PayLess logo"
            className="w-20"
            width="80"
            height="80"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </nav>

        {hasQuery ? (
          <Suspense
            fallback={<div className="text-center">Preparing article...</div>}
          >
            <LoadingState query={query} error={error} showAd={showAd} />
          </Suspense>
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
    </>
  );
}

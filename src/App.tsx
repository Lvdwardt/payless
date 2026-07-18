import useLocalStorageState from "use-local-storage-state";
import { IntroductionCard } from "./components/introductionCard";
import { CaptchaGate } from "./components/captcha-gate";
import { ArticleReader } from "./components/article-reader";
import { useQuery } from "./hooks/useQuery";
import { useArticle } from "./hooks/useArticle";
import { PacmanLoader } from "react-spinners";
import type { Font } from "./types/font";

function App() {
  const [font, setFont] = useLocalStorageState<Font>("font", {
    defaultValue: {
      scale: 1,
      height: undefined,
    },
  });

  const {
    extractedUrl,
    error: queryError,
    isLoading: isQueryLoading,
    hasQuery,
  } = useQuery();
  const {
    article,
    articleLink,
    isLoading: isArticleLoading,
    captchaUrl,
    error,
    openCaptcha,
    openArchive,
    retry,
  } = useArticle(extractedUrl, font);

  const pageTitle = article
    ? "PayLess - Article Reader"
    : "PayLess - Skip the Paywall";
  const pageDescription = article
    ? "Reading article with PayLess paywall bypass tool"
    : "The easiest way to skip the paywall and read articles for free";

  if (article) {
    return (
      <>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        <ArticleReader
          article={article}
          articleLink={articleLink}
          font={font}
          onFontChange={setFont}
        />
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

      <div className="min-h-screen bg-background">
        <main className="min-h-screen -mt-20 p-4 grid place-items-center">
          {!hasQuery && !queryError && (
            <IntroductionCard isLoading={isQueryLoading} />
          )}
          {hasQuery && isQueryLoading && (
            <PacmanLoader
              color="var(--accent-foreground)"
              className="mr-34 relative"
            />
          )}
          {queryError && !isQueryLoading && (
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {queryError}
            </p>
          )}
          {extractedUrl && isArticleLoading && (
            <PacmanLoader
              color="var(--accent-foreground)"
              className="mr-34 relative"
            />
          )}
          {extractedUrl && captchaUrl && !isArticleLoading && (
            <CaptchaGate
              onOpenCaptcha={openCaptcha}
              onOpenArchive={openArchive}
              onRetry={retry}
            />
          )}
          {extractedUrl && error && !isArticleLoading && !captchaUrl && (
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {error}
            </p>
          )}
        </main>
      </div>
    </>
  );
}

export default App;

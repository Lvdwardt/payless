import { IntroductionCard } from "./components/introductionCard";
import { CaptchaGate } from "./components/captcha-gate";
import { ArticleReader } from "./components/article-reader";
import { useQuery } from "./hooks/useQuery";
import { useArticle } from "./hooks/useArticle";
import { useReaderExperience } from "./hooks/useReaderExperience";
import { CenteredPacmanLoader } from "./components/centered-pacman-loader";

function App() {
  const [experience, setExperience] = useReaderExperience();

  const {
    extractedUrl,
    error: queryError,
    isLoading: isQueryLoading,
    hasQuery,
  } = useQuery();
  const {
    mode,
    articleHtml,
    nativeArticle,
    articleLink,
    isLoading: isArticleLoading,
    captchaUrl,
    error,
    openCaptcha,
    openArchive,
    retry,
  } = useArticle(extractedUrl, experience);

  const hasArticle = mode === "native" ? !!nativeArticle : !!articleHtml;

  const pageTitle = hasArticle
    ? "PayLess - Article Reader"
    : "PayLess - Skip the Paywall";
  const pageDescription = hasArticle
    ? "Reading article with PayLess paywall bypass tool"
    : "The easiest way to skip the paywall and read articles for free";

  if (hasArticle && mode) {
    return (
      <>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        <ArticleReader
          mode={mode}
          articleHtml={articleHtml}
          nativeArticle={nativeArticle}
          articleLink={articleLink}
          experience={experience}
          onExperienceChange={setExperience}
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
          {hasQuery && isQueryLoading && <CenteredPacmanLoader />}
          {queryError && !isQueryLoading && (
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {queryError}
            </p>
          )}
          {extractedUrl && isArticleLoading && <CenteredPacmanLoader />}
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

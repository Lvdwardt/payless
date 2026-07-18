import { IntroductionCard } from "./components/introductionCard";
import { CaptchaGate } from "./components/captcha-gate";
import { useQuery } from "./hooks/useQuery";
import { useArticle } from "./hooks/useArticle";
import { PacmanLoader } from "react-spinners";

function App() {
  const { extractedUrl, isLoading: isQueryLoading } = useQuery();
  const {
    article,
    isLoading: isArticleLoading,
    captchaUrl,
    error,
    openCaptcha,
    openArchive,
    retry,
  } = useArticle(extractedUrl);

  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-screen -mt-20 p-4 grid place-items-center">
        {!extractedUrl && <IntroductionCard isLoading={isQueryLoading} />}
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
        {article && (
          <div
            className="pt-14"
            dangerouslySetInnerHTML={{ __html: article }}
          />
        )}
      </main>
    </div>
  );
}

export default App;

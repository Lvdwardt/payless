import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Share, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PacmanLoader } from "react-spinners";

export function IntroductionCard({
  isLoading: isDataLoading = false,
}: {
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const {
    isInstalled,
    isInstallable,
    requestInstall,
    isInstalling,
    isLoading,
  } = usePWAInstall();

  if (isLoading || isDataLoading) {
    return <PacmanLoader color="var(--primary)" className="mr-14" />;
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-balance">
          {t("intro.title")}
        </CardTitle>
        <CardDescription className="text-base">
          {t("intro.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">{t("intro.howItWorks")}</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {isInstalled ? (
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <span className="font-semibold text-sm">1</span>
                </div>
              )}
              <div>
                <p className="font-medium">{t("intro.step1.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("intro.step1.description")}
                </p>
                <div className="mt-3">
                  {!isInstalled && isInstallable && (
                    <Button
                      onClick={requestInstall}
                      className=""
                      disabled={isInstalling}
                    >
                      {isInstalling
                        ? t("install.installing")
                        : t("install.button")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                {isInstalled ? (
                  <Smartphone className="h-4 w-4" />
                ) : (
                  <span className="font-semibold text-sm">2</span>
                )}
              </div>
              <div>
                <p className="font-medium">{t("intro.step2.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("intro.step2.description")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <Share className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{t("intro.step3.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("intro.step3.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

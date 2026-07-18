import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type CaptchaGateProps = {
  onOpenCaptcha: () => void;
  onOpenArchive: () => void;
  onRetry: () => void;
};

export function CaptchaGate({
  onOpenCaptcha,
  onOpenArchive,
  onRetry,
}: CaptchaGateProps) {
  const { t } = useTranslation();

  return (
    <section className="w-full max-w-md px-2 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="size-7" aria-hidden />
      </div>
      <h1 className="font-serif text-2xl tracking-tight text-foreground">
        {t("captcha.title")}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t("captcha.description")}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Button type="button" size="lg" onClick={onOpenCaptcha}>
          {t("captcha.open")}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onRetry}>
          {t("captcha.retry")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onOpenArchive}>
          {t("captcha.readOnArchive")}
        </Button>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        {t("captcha.hint")}
      </p>
    </section>
  );
}

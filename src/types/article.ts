export type CaptchaStage = "archive_link" | "article";

export type CaptchaChallenge = {
  status: "captcha";
  challengeUrl: string;
  stage: CaptchaStage;
};

export type ArchiveLinkResult =
  | { status: "ok"; link: string }
  | CaptchaChallenge
  | { status: "not_found" }
  | { status: "error"; message: string };

export type NativeArticleImage = {
  src: string;
  alt?: string;
};

export type NativeArticle = {
  title: string;
  byline?: string;
  content: string;
  textContent: string;
  length: number;
  siteName?: string;
  images: NativeArticleImage[];
};

export type ArticleResult =
  | { status: "ok"; mode: "legacy"; html: string }
  | { status: "ok"; mode: "native"; article: NativeArticle }
  | CaptchaChallenge
  | { status: "error"; message: string };

export type ArticleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; mode: "legacy"; html: string; archiveLink: string }
  | {
      status: "ready";
      mode: "native";
      article: NativeArticle;
      archiveLink: string;
    }
  | { status: "captcha"; challengeUrl: string; stage: CaptchaStage }
  | { status: "error"; message: string };

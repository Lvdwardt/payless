export type CaptchaChallenge = {
  status: "captcha";
  challengeUrl: string;
};

export type ArchiveLinkResult =
  | { status: "ok"; link: string }
  | CaptchaChallenge
  | { status: "not_found" }
  | { status: "error"; message: string };

export type ArticleResult =
  | { status: "ok"; html: string }
  | CaptchaChallenge
  | { status: "error"; message: string };

export type ArticleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; html: string; archiveLink: string }
  | { status: "captcha"; challengeUrl: string }
  | { status: "error"; message: string };

import { useEffect, useRef, useState } from "react";
import { getArchiveLink } from "@/utils/getArchiveLink";
import getArticle from "@/utils/getArticle";
import {
  ARCHIVE_BASE,
  buildArchiveChallengeUrl,
} from "@/utils/archiveDetect";
import { trackEvent, websiteFromUrl } from "@/hooks/useUmami";
import type { ArticleState, CaptchaStage } from "@/types/article";
import type { Font } from "@/types/font";

const RETRY_INTERVAL_MS = 4000;
const FAST_RETRY_INTERVAL_MS = 2000;
const FAST_RETRY_WINDOW_MS = 90_000;

async function resolveArticle(url: string, font: Font): Promise<ArticleState> {
  const archiveLink = await getArchiveLink(url);

  if (archiveLink.status === "captcha") {
    return {
      status: "captcha",
      challengeUrl: archiveLink.challengeUrl,
      stage: archiveLink.stage,
    };
  }

  if (archiveLink.status === "error") {
    return { status: "error", message: archiveLink.message };
  }

  if (archiveLink.status === "not_found") {
    return { status: "error", message: "No archive link found" };
  }

  const article = await getArticle(
    archiveLink.link,
    ARCHIVE_BASE,
    url,
    font
  );

  if (article.status === "captcha") {
    return {
      status: "captcha",
      challengeUrl: article.challengeUrl,
      stage: article.stage,
    };
  }

  if (article.status === "error") {
    return { status: "error", message: article.message };
  }

  return {
    status: "ready",
    html: article.html,
    archiveLink: archiveLink.link,
  };
}

function captchaVia(challengeUrl: string): "proxy" | "direct" {
  return challengeUrl.includes("/solve") ? "proxy" : "direct";
}

/**
 * Fetch article content from archive, staying in-app through CAPTCHA challenges.
 */
export function useArticle(url: string, font: Font) {
  const [state, setState] = useState<ArticleState>({ status: "idle" });
  const captchaWindowRef = useRef<Window | null>(null);
  const inFlightRef = useRef(false);
  const stateRef = useRef(state);
  const captchaOpenedAtRef = useRef<number | null>(null);
  const captchaSeenAtRef = useRef<number | null>(null);
  const captchaStageRef = useRef<CaptchaStage | null>(null);
  const fontRef = useRef(font);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fontRef.current = font;
  }, [font]);

  function applyState(next: ArticleState) {
    const prev = stateRef.current;
    const domain = url ? websiteFromUrl(url) : "unknown";

    if (next.status === "captcha" && prev.status !== "captcha") {
      captchaSeenAtRef.current = Date.now();
      captchaStageRef.current = next.stage;
      trackEvent("captcha hit", {
        website: domain,
        stage: next.stage,
        via: captchaVia(next.challengeUrl),
      });
    }

    // Fire even if we briefly went through `loading` (manual retry).
    if (
      captchaSeenAtRef.current !== null &&
      (next.status === "ready" || next.status === "error")
    ) {
      const seenAt = captchaSeenAtRef.current;
      const stage =
        captchaStageRef.current ||
        (prev.status === "captcha" ? prev.stage : undefined);
      const via =
        prev.status === "captcha"
          ? captchaVia(prev.challengeUrl)
          : undefined;
      trackEvent(
        next.status === "ready" ? "captcha cleared" : "captcha failed",
        {
          website: domain,
          stage,
          via,
          ms: Date.now() - seenAt,
          opened: captchaOpenedAtRef.current !== null,
        }
      );
      captchaSeenAtRef.current = null;
      captchaStageRef.current = null;
    }

    if (next.status === "ready") {
      captchaWindowRef.current?.close();
      captchaWindowRef.current = null;
      captchaOpenedAtRef.current = null;
    }

    setState(next);
  }

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      captchaSeenAtRef.current = null;
      captchaStageRef.current = null;
      captchaOpenedAtRef.current = null;
      return;
    }

    let cancelled = false;
    captchaOpenedAtRef.current = null;
    captchaSeenAtRef.current = null;
    captchaStageRef.current = null;

    async function load() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState({ status: "loading" });

      try {
        const next = await resolveArticle(url, fontRef.current);
        if (!cancelled) {
          applyState(next);
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // applyState closes over url; reload when url changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // After CAPTCHA, archive often clears access for this device/IP — retry
  // silently while the challenge UI stays visible.
  useEffect(() => {
    if (state.status !== "captcha" || !url) return;

    let cancelled = false;

    async function silentRetry() {
      if (cancelled || inFlightRef.current) return;
      if (stateRef.current.status !== "captcha") return;
      if (document.visibilityState !== "visible") return;

      inFlightRef.current = true;
      try {
        const next = await resolveArticle(url, fontRef.current);
        if (cancelled || stateRef.current.status !== "captcha") return;

        if (next.status === "captcha") {
          return;
        }

        applyState(next);
      } finally {
        inFlightRef.current = false;
      }
    }

    const onFocus = () => {
      void silentRetry();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void silentRetry();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const tick = () => {
      const openedAt = captchaOpenedAtRef.current;
      const fast =
        openedAt !== null && Date.now() - openedAt < FAST_RETRY_WINDOW_MS;
      void silentRetry();
      intervalId = window.setTimeout(
        tick,
        fast ? FAST_RETRY_INTERVAL_MS : RETRY_INTERVAL_MS
      );
    };
    let intervalId = window.setTimeout(tick, FAST_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, url]);

  function openCaptcha() {
    if (state.status !== "captcha" || !url) return;

    captchaOpenedAtRef.current = Date.now();
    trackEvent("captcha open", {
      website: websiteFromUrl(url),
      stage: state.stage,
      via: captchaVia(state.challengeUrl),
    });
    captchaWindowRef.current?.close();
    captchaWindowRef.current = window.open(
      state.challengeUrl || buildArchiveChallengeUrl(url),
      "payless-archive-captcha"
    );
  }

  function openArchive() {
    if (!url) return;
    trackEvent("captcha fallback", {
      website: websiteFromUrl(url),
      stage: state.status === "captcha" ? state.stage : undefined,
    });
    window.open(
      `https://archive.ph/${url}`,
      "payless-archive-read",
      "noopener,noreferrer"
    );
  }

  function retry() {
    if (!url || inFlightRef.current) return;

    trackEvent("captcha retry", {
      website: websiteFromUrl(url),
      stage: state.status === "captcha" ? state.stage : undefined,
    });

    void (async () => {
      inFlightRef.current = true;
      setState({ status: "loading" });
      try {
        const next = await resolveArticle(url, fontRef.current);
        applyState(next);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }

  return {
    state,
    isLoading: state.status === "loading",
    article: state.status === "ready" ? state.html : "",
    articleLink: state.status === "ready" ? state.archiveLink : "",
    captchaUrl: state.status === "captcha" ? state.challengeUrl : null,
    error: state.status === "error" ? state.message : null,
    openCaptcha,
    openArchive,
    retry,
  };
}

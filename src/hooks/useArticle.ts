import { useEffect, useRef, useState } from "react";
import { getArchiveLink } from "@/utils/getArchiveLink";
import getArticle from "@/utils/getArticle";
import {
  ARCHIVE_BASE,
  buildArchiveChallengeUrl,
} from "@/utils/archiveDetect";
import type { ArticleState } from "@/types/article";

const RETRY_INTERVAL_MS = 4000;
const FAST_RETRY_INTERVAL_MS = 2000;
const FAST_RETRY_WINDOW_MS = 90_000;

async function resolveArticle(url: string): Promise<ArticleState> {
  const archiveLink = await getArchiveLink(url);

  if (archiveLink.status === "captcha") {
    return {
      status: "captcha",
      challengeUrl: archiveLink.challengeUrl,
    };
  }

  if (archiveLink.status === "error") {
    return { status: "error", message: archiveLink.message };
  }

  if (archiveLink.status === "not_found") {
    return { status: "error", message: "No archive link found" };
  }

  const article = await getArticle(archiveLink.link, ARCHIVE_BASE, url);

  if (article.status === "captcha") {
    return {
      status: "captcha",
      challengeUrl: article.challengeUrl,
    };
  }

  if (article.status === "error") {
    return { status: "error", message: article.message };
  }

  return { status: "ready", html: article.html };
}

/**
 * Fetch article content from archive, staying in-app through CAPTCHA challenges.
 */
export function useArticle(url: string) {
  const [state, setState] = useState<ArticleState>({ status: "idle" });
  const captchaWindowRef = useRef<Window | null>(null);
  const inFlightRef = useRef(false);
  const stateRef = useRef(state);
  const captchaOpenedAtRef = useRef<number | null>(null);

  stateRef.current = state;

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    captchaOpenedAtRef.current = null;

    async function load() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState({ status: "loading" });

      try {
        const next = await resolveArticle(url);
        if (!cancelled) {
          if (next.status === "ready") {
            captchaWindowRef.current?.close();
            captchaWindowRef.current = null;
            captchaOpenedAtRef.current = null;
          }
          setState(next);
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
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
        const next = await resolveArticle(url);
        if (cancelled || stateRef.current.status !== "captcha") return;

        if (next.status === "captcha") {
          return;
        }

        if (next.status === "ready") {
          captchaWindowRef.current?.close();
          captchaWindowRef.current = null;
          captchaOpenedAtRef.current = null;
        }

        setState(next);
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
  }, [state.status, url]);

  function openCaptcha() {
    if (state.status !== "captcha" || !url) return;

    captchaOpenedAtRef.current = Date.now();
    captchaWindowRef.current?.close();
    captchaWindowRef.current = window.open(
      state.challengeUrl || buildArchiveChallengeUrl(url),
      "payless-archive-captcha"
    );
  }

  function openArchive() {
    if (!url) return;
    window.open(
      `https://archive.ph/${url}`,
      "payless-archive-read",
      "noopener,noreferrer"
    );
  }

  function retry() {
    if (!url || inFlightRef.current) return;

    void (async () => {
      inFlightRef.current = true;
      setState({ status: "loading" });
      try {
        const next = await resolveArticle(url);
        if (next.status === "ready") {
          captchaWindowRef.current?.close();
          captchaWindowRef.current = null;
          captchaOpenedAtRef.current = null;
        }
        setState(next);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }

  return {
    state,
    isLoading: state.status === "loading",
    article: state.status === "ready" ? state.html : "",
    captchaUrl: state.status === "captcha" ? state.challengeUrl : null,
    error: state.status === "error" ? state.message : null,
    openCaptcha,
    openArchive,
    retry,
  };
}

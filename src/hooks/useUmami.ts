declare global {
  interface Window {
    umami?: {
      track: (payload: UmamiPayload) => void;
    };
  }
}

type UmamiPayload = {
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
  website?: string;
  name?: string;
  data?: Record<string, unknown>;
};

const WEBSITE_ID = "68fd502a-c9e4-4a63-a9a8-5ad1c14a0ac9";

if (import.meta.env.DEV) {
  window.umami = {
    track: () => {},
  };
}

function getDefaultProperties(): UmamiPayload {
  return {
    hostname: window.location.hostname,
    website: WEBSITE_ID,
    language: window.navigator.language,
    referrer: document.referrer,
    screen: `${window.screen.width}x${window.screen.height}`,
    title: document.title,
    url: window.location.pathname,
  };
}

export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>
): void {
  if (!window.umami) return;

  window.umami.track({
    ...getDefaultProperties(),
    name: eventName,
    data: eventData,
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck

type UmamiPayload = {
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
  website?: string;
  name?: string;
  data?: Record<string, any>;
};

// disable in dev mode
if (import.meta.env.DEV) {
  window.umami = {
    track: () => {},
  };
}

const trackEvent = (
  eventName: string,
  eventData?: Record<string, any>
): void => {
  if (window.umami) {
    const defaultPayload = {
      // Default properties included in the payload
      ...getDefaultProperties(),
      name: eventName,
      data: eventData,
    };

    window.umami.track(defaultPayload);
  }
};

// Helper function to get default properties
const getDefaultProperties = (): UmamiPayload => ({
  hostname: window.location.hostname,
  website: "68fd502a-c9e4-4a63-a9a8-5ad1c14a0ac9",
  language: window.navigator.language,
  referrer: document.referrer,
  screen: `${window.screen.width}x${window.screen.height}`,
  title: document.title,
  url: window.location.pathname,
});

export { trackEvent };

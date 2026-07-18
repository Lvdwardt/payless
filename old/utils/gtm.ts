/* eslint-disable @typescript-eslint/no-explicit-any */
type WindowWithDataLayer = Window & {
  dataLayer: Record<string, any>[];
};

declare const window: WindowWithDataLayer;

export const pageview = (url: string) => {
  window.dataLayer.push({
    event: "pageview",
    page: url,
  });
};

export const event = ({ action, category, label, value }: any) => {
  window.dataLayer.push({
    event: action,
    category,
    label,
    value,
  });
};

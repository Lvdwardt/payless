import type { Rules } from "@/types";

export const allSitesRules: Rules = {
  removeRules: [
    // global
    "#hashtags",
    // instagram
    "#facebook > div > div > div > div > div > div:nth-child(2) > a > div",
    "#facebook > div > div > div > div > div > div:nth-child(3)",
  ],
  alterRules: [
    // global
    {
      selector: "global",
      style: "min-width: 1024px;",
    },
  ],
};

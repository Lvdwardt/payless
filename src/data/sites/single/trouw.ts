import { Site } from "@/types";

export const trouw: Site = {
  "www.trouw.nl": {
    removeRules: [
      "footer",
      "div.html1 > div > div > div:nth-child(3) > header",
    ],
    alterRules: [],
    addRules: [
      {
        selector: "#main",
        style: "background:white",
      },
    ],
  },
};

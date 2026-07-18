import { Site } from "@/types";

export const wt2: Site = {
  "www.washingtonpost.com": {
    removeRules: ["#__next > div:nth-child(3) > main > div:nth-child(3)"],
    alterRules: [
      {
        selector: "#__next > div:nth-child(3) > main > article",
        style:
          "box-sizing:border-box;display:block;grid-column-end: 3;grid-column-start:1;margin-bottom:64px;",
      },
      {
        selector:
          "#__next > div:nth-child(3) > main > article > div:nth-child(2)",
        style:
          "box-sizing:border-box;display:block;margin-left:auto;margin-right:auto;width:100%;",
      },
    ],
    replaceAll: [
      {
        find: "max-width:640px",
        replace: "max-width:900px",
      },
      {
        find: "margin-right:192px",
        replace: "margin-right:auto",
      },
      {
        find: "margin-left:192px",
        replace: "margin-left:auto",
      },
      // interactive opinion articles
      // {
      //   find: "max-width:672px",
      //   replace: "max-width:900px",
      // },
    ],
  },
};

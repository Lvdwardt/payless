import { Site } from "@/types";

export const ft: Site = {
  "www.ft.com": {
    removeRules: [
      "#site-content > div:nth-child(7) > div:nth-child(1)",
      "div.html1 > div > div > div > div:nth-child(7)",
      "#site-content > div:nth-child(8)",
      "#site-content > div:nth-child(7)",
      "div.html1 > div > div > div:nth-child(2)",
      "#article-body > aside",
      "div.html1 > div > div > div:nth-child(2)",
      "#site-content > div:nth-child(2)",
      "#site-content > div:nth-child(5)",
    ],
    alterRules: [
      {
        selector: "#site-content",
        style: "display: block;",
      },
      {
        selector: "#site-content > div:nth-child(3)",
        style:
          "display:block;grid-column-end:content;grid-column-start:content;grid-row-end:content;grid-row-start:content;margin-bottom:24px;position:relative;width:100%;",
      },
      {
        selector:
          "div.html1 > div > div > div:nth-child(1) > div:nth-child(6) > div > div > div:nth-child(3) > div > div",
        style: "display: block; margin-bottom: 24px",
      },
      {
        selector: "#site-content > div:nth-child(1) > figure > picture > img",
        style: "width: 100%; opacity: 1",
      },
      {
        selector: "div.html1 > div > div > div > div:nth-child(6)",
        style: "display: block",
      },
      {
        selector: "div.html1 > div > div > div",
        style: "display: block",
      },
      {
        selector:
          "div.html1 > div > div > div > div:nth-child(6) > div > div > div:nth-child(3)",
        style: "display: block",
      },
      {
        selector: "#site-content > div:nth-child(2)",
        style:
          "display:block;grid-column-end:content;grid-column-start:content;grid-row-end:content;grid-row-start:content;margin-bottom:24px;position:relative;width:100%;margin-left: 16px;margin-right: 16px;",
      },
      {
        selector: "div.html1 > div",
        style:
          "overflow-x:visible;overflow-y:visible;color:rgb(51, 48, 46);font-family:sans-serif;font-size: 13px;text-rendering:optimizelegibility;-webkit-font-smoothing:antialiased;-webkit-locale:&quot;en-GB&quot;;margin-bottom:0px;margin-top:0px;text-size-adjust:100%;padding: 16px;",
      },
    ],
  },
};

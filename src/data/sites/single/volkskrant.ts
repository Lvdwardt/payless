import { Site } from "@/types";

export const volkskrant: Site = {
  "www.volkskrant.nl": {
    removeRules: [
      "div.html1 > div > div > div:nth-child(3) > div:nth-child(2)",
      "#article-content > section > div:nth-child(1) > div:nth-child(11)",
      "div.html1 > div > div > div:nth-child(3) > footer",
      "div.html1 > div > div > div:nth-child(3) > div > div",
      "div:nth-child(2)",
      "#article-content > section > div:nth-child(2)",
      "div.html1 > div > div > div:nth-child(2) > div",
      "#article-content > div",
      "#article-content > section > div > div:nth-child(28)",
      "div.html1 > div > div > div:nth-child(2) > header > div:nth-child(1) > div > button",
      "div.html1 > div > div > div:nth-child(2) > header > div:nth-child(1) > div > ul",
      "div.html1 > div > div > div:nth-child(2) > header > div:nth-child(1) > nav",
    ],
    alterRules: [
      {
        selector: "#main",
        style: "background:white",
      },
      {
        selector: "#article-content > header > figure > img",
        style:
          "width:100%; height:auto;cursor:pointer;display:inline-block;max-width:100%;object-fit:contain;position:relative;width:100%;aspect-ratio:auto 3600 / 2400;opacity: 1;",
      },
      {
        selector: "div.html1",
        style: "max-width: 100%",
      },
      {
        selector: "global",
        style: "width: 714px;",
      },
      {
        selector: "div.html1 > div > div > div:nth-child(3)",
        style: "box-sizing:border-box;min-height:768px;width: 100%;",
      },
      {
        selector: "div.html1 > div > div",
        style:
          "margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:0px;/* */overflow-x:visible;overflow-y:visible;-webkit-font-smoothing:antialiased;display:block;padding-bottom:0px;padding-left:0px;padding-right:0px;padding-top:0px;",
      },
      {
        selector: "div.html1 > div > div > div:nth-child(2)",
        style: "",
      },
      {
        selector: "#article-content",
        style:
          "box-sizing:border-box;display:block;margin-left:auto;margin-right:auto;margin-top:0px;position:relative;",
      },
      {
        selector: "#article-content > section",
        style:
          "box-sizing:border-box;display:block;margin-left:auto;margin-right:auto;max-width:600px;padding-bottom:0px;padding-left:0px;padding-right:0px;padding-top:0px;width:100%;",
      },
      {
        selector:
          "div.html1 > div > div > div:nth-child(2) > header > div:nth-child(1) > div",
        style:
          "align-items:center;box-sizing:border-box;display:flex;justify-content:center;min-height:56px;position:relative;",
      },
    ],
  },
};

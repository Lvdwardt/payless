import { Site } from "@/types";

export const emerce: Site = {
  "www.emerce.nl": {
    removeRules: [
      "div.html1 > div > div > main > span:nth-child(1)",
      "div.html1 > div > div > main > div > aside",
    ],
    alterRules: [
      {
        selector: "div.html1 > div > div > main > div > article",
        style:
          "box-sizing:border-box;display:block;float:left;margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:50px;padding-bottom:0px;padding-left:40px;padding-right:40px;padding-top:30px;",
      },
      {
        selector: "div.html1 > div > div",
        style: "display: block;",
      },
    ],
  },
};

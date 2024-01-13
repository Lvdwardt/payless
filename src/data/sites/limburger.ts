import { Site } from "../../types";

export const limburger: Site = {
  "www.limburger.nl": {
    removeRules: [
      "div.html1 > div > div > div:nth-child(4) > div:nth-child(1) > div > main > div > div > div > article > div:nth-child(2)",
      "div.html1 > div > div > header",
      "div.html1 > div > div > div:nth-child(3) > div:nth-child(1) > div > nav",
      "div.html1 > div > div > div:nth-child(3) > div:nth-child(1) > div > footer",
      "div.html1 > div > div > div:nth-child(3) > div:nth-child(1) > div > main > div > div > div > div:nth-child(1)",
    ],
    alterRules: [
      {
        selector: "div.html1 > div > div > div:nth-child(3)",
        style:
          "backgroundcolor:red;box-sizing:border-box;display:block;margin-bottom:0px;margin-left:auto;margin-right:auto;position:relative;",
      },
      {
        class: "body",
        style:
          "margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:0px; /*cni=406*/;overflow-x:visible;overflow-y:visible;font-size: 16px;box-sizing:border-box;display:block;line-height:1.4285714286;",
      },
      {
        selector:
          "div.html1 > div > div > div:nth-child(3) > div:nth-child(1) > div > main > div > div > div > article > div",
        style:
          "direction:ltr;font-size: 14px;text-rendering:auto;box-sizing:border-box;display:inline-block;letter-spacing:normal;margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:0px;text-align:left;vertical-align:top;width:100%;word-spacing:0px;",
      },
      {
        selector: "div.html1 > div > div > div:nth-child(3) > div:nth-child(1)",
        style:
          "box-sizing:border-box;display:block;margin-bottom:0px;margin-left:auto;margin-right:auto;margin-top:0px;max-width:663px;position:relative;",
      },
      {
        selector:
          "div.html1 > div > div > div:nth-child(3) > div:nth-child(1) > div",
        style:
          "border-bottom-color:rgb(220, 220, 220);border-bottom-style:solid;border-bottom-width:0px;border-image-outset:0;border-image-repeat:stretch;border-image-slice:100%;border-image-source:none;border-image-width:1;border-left-color:rgb(220, 220, 220);border-left-style:solid;border-left-width:0px;border-right-color:rgb(220, 220, 220);border-right-style:solid;border-right-width:0px;border-top-color:rgb(220, 220, 220);border-top-style:solid;border-top-width:0px;box-sizing:border-box;display:block;",
      },
    ],
  },
};

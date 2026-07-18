import { Site } from "@/types";

export const washingtonpost: Site = {
  "www.washingtonpost.com": {
    removeRules: [
      "#__next > div:nth-child(3) > main > article > div > div:nth-child(3)",
      "#__next > div:nth-child(4)",
      "#__next > div:nth-child(3) > main > div:nth-child(3)",
    ],
    alterRules: [
      {
        selector: ".body",
        style:
          "color:rgb(17, 17, 17);margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:0px;overflow-x:visible;overflow-y:visible;-webkit-background-clip:border-box;font-family:Franklin, Arial, Helvetica, sans-serif;background-attachment:scroll;background-clip:border-box;background-origin:padding-box;box-sizing:border-box;display:block;",
      },
      {
        selector: "#__next > div:nth-child(3) > main",
        style:
          "box-sizing:border-box;column-gap:0px;display:grid;grid-column-end:auto;grid-column-start:span 3;grid-template-columns: 512px 512px;",
      },
      {
        selector: "#default-topper",
        style:
          "box-sizing:border-box;display:block;margin-bottom:24px;width: 1024px;",
      },

      {
        selector: "#__next > div:nth-child(3) > main > div > header",
        style: "box-sizing:border-box;display:block;width: 1024px;",
      },

      {
        selector: "#__next > div:nth-child(3)",
        style: "",
      },

      {
        selector:
          "#__next > div:nth-child(3) > main > article > div > div:nth-child(1)",
        style:
          "box-sizing:border-box;display:flex;margin-bottom:24px;margin-left:162px;margin-right:162px;max-width:640px;",
      },
      {
        selector:
          "#__next > div:nth-child(3) > main > article > div > div:nth-child(2) > div:nth-child(1) > div",
        style: "box-sizing:border-box;display:block;max-width:640px;",
      },
      {
        selector:
          "#__next > div:nth-child(3) > main > article > div > div:nth-child(2) > div",
        style:
          "box-sizing:border-box;display:block;margin-left:162px;margin-right:162px;max-width:640px;",
      },
    ],
    addRules: [
      {
        selector: "#main",
        style: "background:white",
      },
    ],
  },
};

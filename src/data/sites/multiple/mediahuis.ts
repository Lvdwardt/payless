import type { MultipleSites } from "@/types";

export const mediahuis: MultipleSites = {
  sites: [
    "www.telegraaf.nl",
    "noordhollandsdagblad.nl",
    "www.haarlemsdagblad.nl",
    "www.leidschdagblad.nl",
    "www.ijmuidercourant.nl",
    "www.gooieneemlander.nl",
    "www.lc.nl",
    "www.dvhn.nl",
    "frieschdagblad.nl",
    "www.standaard.be",
  ],
  rules: {
    removeRules: [
      "#content > div:nth-child(2) > div:nth-child(2)",
      "[data-element=newsletterRoot]",
      "#page > footer",
      "#content > div:nth-child(2) > div > section:nth-child(2) > div:nth-child(5)",
      "#content > div:nth-child(2) > div > section:nth-child(2) > div:nth-child(5)",
      "#content > div:nth-child(2) > div > section:nth-child(2) > div:nth-child(5)",
      "#content > div:nth-child(2) > div > section:nth-child(1) > div:nth-child(1) > div:nth-child(1)",
      "#__next > header",
      "#__next > div:nth-child(1) > div:nth-child(2)",
      "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > div > main > aside",
      "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(3)",
      "#__next > footer",
      "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(2)",
      "#ad_1",
      "#ad_2",
      "#ad_3",
    ],
    alterRules: [
      {
        selector: "#content > div:nth-child(2)",
        style:
          "box-sizing:border-box;display:grid;grid-column-end:auto;grid-column-start:2;grid-row-end:auto;grid-row-start:4;grid-template-columns:992px;margin-bottom:20px;margin-left:auto;margin-right:auto;margin-top:20px;max-width:1344px;padding-bottom:0px;padding-left:0px;padding-right:0px;padding-top:0px;width:100%;",
      },
      {
        selector: "#content > div:nth-child(2) > div > section:nth-child(1)",
        style:
          "display:block;margin-bottom:auto;auto;margin-top:auto;max-width:700px",
      },
      {
        selector: "#content > div:nth-child(2)",
        style:
          "box-sizing:border-box;margin-top:20px;max-width:700px;padding-bottom:0px;padding-left:0px;padding-right:0px;padding-top:0px;width:100%;",
      },
      {
        selector: "#content",
        style: "column-gap:4px;padding-top:20px;padding-inline:20px;",
      },
      {
        selector: "#content > div:nth-child(2) > div > section:nth-child(2)",
        style:
          "display:block;margin-bottom:auto;auto;margin-top:auto;max-width:700px",
      },
      {
        class: "body",
        style:
          "color:rgb(58, 62, 63);margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:0px;overflow-x:visible;overflow-y:visible;font-family:Roboto, sans-serif;font-weight:400;box-sizing:border-box;display:block;line-height:1.2;",
      },
      {
        selector: "#page > header",
        style: "display:none;",
      },
      {
        selector: "global",
        style: "width: 700px;",
      },

      {
        selector: "#__next > div:nth-child(1)",
        style:
          "font-family:&quot;Times New Roman&quot;;font-size: 24px;font-stretch:100%;font-style:normal;font-variant-caps:normal;font-variant-east-asian:normal;font-variant-ligatures:normal;font-variant-numeric:normal;font-weight:400;border-bottom-color:rgb(0, 0, 0);border-bottom-style:none;border-bottom-width:0px;border-image-outset:0;border-image-repeat:stretch;border-image-slice:100%;border-image-source:none;border-image-width:1;border-left-color:rgb(0, 0, 0);border-left-style:none;border-left-width:0px;border-right-color:rgb(0, 0, 0);border-right-style:none;border-right-width:0px;border-top-color:rgb(0, 0, 0);border-top-style:none;border-top-width:0px;box-sizing:border-box;display:grid;grid-template-columns:700px;line-height: 16px;margin-bottom:0px;margin-left:0px;margin-right:0px;margin-top:20px;padding-bottom:0px;padding-left:0px;padding-right:0px;padding-top:0px;vertical-align:baseline;",
      },
      {
        selector:
          "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > div > main",
        style:
          "box-sizing:border-box;column-gap:32px;display:grid;grid-auto-rows:auto;grid-template-areas:&quot;article&quot;;grid-template-columns:1fr;margin-inline-end:0px;margin-inline-start:0px;max-width:700px;padding-inline-end:16px;padding-inline-start:16px;row-gap:32px;width:100%;",
      },
      {
        selector:
          "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > div > main > aside",
        style: "display: none;",
      },
      {
        selector:
          "#__next > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div",
        style: "max-width: 700px;",
      },
      {
        selector: "#__next > div:nth-child(1) > div:nth-child(2)",
        style: "width: 700px;",
      },
    ],
    addRules: [
      {
        selector: "main > :nth-child(3) > :nth-child(2)",
        style: "display: none;",
      },
    ],
  },
};

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
    ],
    addRules: [
      {
        selector: "main > :nth-child(3) > :nth-child(2)",
        style: "display: none;",
      },
    ],
  },
};

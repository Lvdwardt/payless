import type { MultipleSites } from "../../types";

export const dpg: MultipleSites = {
  sites: [
    "www.ad.nl",
    "www.bd.nl",
    "www.ed.nl",
    "www.tubantia.nl",
    "www.bndestem.nl",
    "www.pzc.nl",
    "www.destentor.nl",
    "www.gelderlander.nl",
  ],
  rules: {
    removeRules: [
      "#page-main-content > div:nth-child(2) > div:nth-child(1) > div:nth-child(3) > div > div:nth-child(2)",
    ],
    alterRules: [
      {
        selector:
          "#page-main-content > div:nth-child(2) > div:nth-child(1) > div:nth-child(3) > div",
        style:
          "box-sizing:border-box;display:flex;flex-direction:row;padding-top:10px;width:100%;",
      },
      {
        selector: "global",
        style: "width: 714px;",
      },
    ],
  },
};

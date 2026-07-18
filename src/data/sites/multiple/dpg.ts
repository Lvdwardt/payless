import type { MultipleSites } from "@/types/siteRules";

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
      'div[style*="z-index:800"]',
      "div.html1 > div > div > header:nth-child(3) > section",
      "div.html1 > div > div > header:nth-child(2)",
      'div[aria-label="advert"]',
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
    // checkRules: [
    //   {
    //     condition: {
    //       type: "content",
    //       selector: 'div[style*="font-size:9px"] div',
    //       value: "(200)",
    //       contains: true,
    //     },
    //     removeSelector:
    //       '#article-content > section > div:has(article div div:contains("(200)"))',
    //   },
    //   {
    //     condition: {
    //       type: "style",
    //       selector: "article div div div div div div",
    //       value: "background-color:rgb(34, 34, 34)",
    //       contains: true,
    //     },
    //     removeSelector:
    //       '#article-content > section > div:has(article div[style*="background-color:rgb(34, 34, 34)"])',
    //   },
    // ],
  },
};

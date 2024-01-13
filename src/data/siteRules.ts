import type { MultipleSites, Site } from "../types";
import { limburger } from "./sites/limburger";
import { dpg } from "./sites/dpg";
import { mediahuis } from "./sites/mediahuis";

export const sites: Site = {
  // multiple sites
  ...getRulesForMultipleSites(dpg),
  ...getRulesForMultipleSites(mediahuis),

  // single sites
  ...limburger,
};

function getRulesForMultipleSites(siteGroup: MultipleSites): Site {
  const { sites, rules } = siteGroup;
  const siteRules: Site = {};
  sites.forEach((site) => {
    siteRules[site] = rules;
  });
  return siteRules;
}

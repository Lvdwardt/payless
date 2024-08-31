import type { MultipleSites, Site } from "@/types";
import { singleSites } from "./sites/single";
import { multipleSites } from "./sites/multiple";

export const sites: Site = {
  // multiple sites
  ...multipleSites.reduce(
    (acc, site) => ({ ...acc, ...getRulesForMultipleSites(site) }),
    {}
  ),
  // single sites
  ...singleSites,
};

function getRulesForMultipleSites(siteGroup: MultipleSites): Site {
  const { sites, rules } = siteGroup;
  const siteRules: Site = {};
  sites.forEach((site) => {
    siteRules[site] = rules;
  });
  return siteRules;
}

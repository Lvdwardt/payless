export type CheckCondition = {
  type: "content" | "style";
  selector: string;
  value: string;
  contains?: boolean; // if true, checks if value is contained in content/style, if false checks exact match
};

export type CheckRule = {
  condition: CheckCondition;
  removeSelector: string; // selector for element to remove if condition is met
};

export type Rules = {
  removeRules?: string[];
  alterRules?: {
    selector?: string;
    class?: string;
    style: string;
  }[];
  addRules?: {
    selector: string;
    class?: string;
    style: string;
  }[];
  replaceAll?: {
    find: string;
    replace: string;
  }[];
  checkRules?: CheckRule[];
};

export type Site = {
  [key: string]: Rules;
};

export type MultipleSites = {
  sites: string[];
  rules: Rules;
};

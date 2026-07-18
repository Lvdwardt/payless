import DOMPurify from "isomorphic-dompurify";
import parse from "node-html-parser";
import { sites } from "@/data/siteRules";
import { allSitesRules } from "@/data/allSites";
import { Rules, CheckRule } from "@/types/siteRules";
import type { ArticleResult } from "@/types/article";
import type { Font } from "@/types/font";
import { trackEvent, websiteFromUrl } from "@/hooks/useUmami";
import { fetchArchivePage } from "@/utils/archiveProxy";

export default async function getArticle(
  link: string,
  baseURL: string,
  originalLink: string,
  font: Font = { scale: 1 }
): Promise<ArticleResult> {
  baseURL = baseURL.replace(/\/$/, "");
  const site = new URL(originalLink).hostname;
  const domain = websiteFromUrl(originalLink);

  let data: string;
  try {
    const page = await fetchArchivePage(link);
    data = page.html;

    if (page.captcha) {
      return {
        status: "captcha",
        challengeUrl: page.challengeUrl || link,
        stage: "article",
      };
    }
  } catch (error) {
    console.error("Error fetching article:", error);
    trackEvent("error", {
      website: domain,
      stage: "article",
      message:
        error instanceof Error
          ? error.message
          : "Could not load the archived article",
    });
    return {
      status: "error",
      message: "Could not load the archived article.",
    };
  }

  const root = parse(data);
  const content = root.querySelector("#CONTENT") as unknown as HTMLElement;

  if (!content) {
    return {
      status: "error",
      message: "Archived article content was not found.",
    };
  }

  updateFontsizes(content, font);
  fixImages(content, baseURL);
  applyRules(allSitesRules, content);

  if (site in sites) {
    const rules = sites[site];
    applyRules(rules, content);
  }

  return {
    status: "ok",
    html: DOMPurify.sanitize(content.toString()),
  };
}

function updateFontsizes(content: HTMLElement, font: Font) {
  const elements = content.querySelectorAll("*");

  elements.forEach((element) => {
    const style = element.getAttribute("style");
    if (!style) return;

    let newStyle = style;
    let updated = false;

    if (font.height && style.includes("line-height:")) {
      const lineHeight = style.match(/line-height: ?(\d+)px/);
      if (lineHeight) {
        const height = parseInt(lineHeight[1]);
        newStyle = newStyle.replace(
          lineHeight[0],
          `line-height: ${height * font.height}px`
        );
        updated = true;
      }
    }

    if (style.includes("font-size:")) {
      const fontSize = style.match(/font-size: ?(\d+)px/);
      if (fontSize) {
        const size = parseInt(fontSize[1]);
        newStyle = newStyle.replace(
          fontSize[0],
          `font-size: ${size * font.scale}px`
        );
        updated = true;
      }
    }

    if (updated) {
      element.setAttribute("style", newStyle);
    }
  });
}

function applyRules(rules: Rules, content: HTMLElement) {
  if (rules.removeRules) {
    rules.removeRules.forEach((rule) => {
      removeElementsBySelector(content, rule);
    });
  }
  if (rules.alterRules) {
    rules.alterRules.forEach(
      (rule: { selector?: string; class?: string; style: string }) => {
        if (rule.selector === "global") {
          alterGlobal(content, rule.style);
          return;
        }
        if (rule.class) {
          alterElementsByClass(content, rule.class, rule.style);
          return;
        }
        if (rule.selector) {
          alterElementsBySelector(content, rule.selector, rule.style);
          return;
        }
      }
    );
  }
  if (rules.addRules) {
    rules.addRules.forEach((rule) => {
      content.querySelector(rule.selector)?.setAttribute("style", rule.style);
    });
  }
  if (rules.replaceAll) {
    rules.replaceAll.forEach((rule) => {
      replaceAllInStyles(content, rule.find, rule.replace);
    });
  }
  if (rules.checkRules) {
    rules.checkRules.forEach((rule) => {
      applyCheckRule(content, rule);
    });
  }
}

function fixImages(content: HTMLElement, baseURL: string) {
  const images = content.querySelectorAll("img");
  images.forEach((image) => {
    const src = image.getAttribute("src");
    if (src && src.startsWith("/")) {
      image.setAttribute("src", `${baseURL}${src}`);
    }
    image.setAttribute(
      "style",
      (image.getAttribute("style") || "") + "opacity: 1;"
    );

    if (image.getAttribute("alt")?.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/)) {
      image.setAttribute("style", "width: 1em; height: 1em; display: inline");
    }
  });
}

function removeElementsBySelector(content: HTMLElement, selector: string) {
  const elements = content.querySelectorAll(selector);
  elements.forEach((element) => {
    element.remove();
  });
}

function alterElementsBySelector(
  content: HTMLElement,
  selector: string,
  style: string
) {
  const elements = content.querySelectorAll(selector);
  elements.forEach((element) => {
    element.setAttribute("style", style);
  });
}

function alterElementsByClass(
  content: HTMLElement,
  className: string,
  style: string
) {
  const elements = content.querySelectorAll(`.${className}`);
  elements.forEach((element) => {
    element.setAttribute("style", style);
  });
}

function alterGlobal(content: HTMLElement, style: string) {
  content.setAttribute("style", style);
}

function replaceAllInStyles(
  content: HTMLElement,
  find: string,
  replace: string
) {
  const elements = content.querySelectorAll("*");
  elements.forEach((element) => {
    const style = element.getAttribute("style");
    if (style && style.includes(find)) {
      const newStyle = style.replace(
        new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        replace
      );
      element.setAttribute("style", newStyle);
    }
  });
}

function applyCheckRule(content: HTMLElement, rule: CheckRule) {
  const { condition, removeSelector } = rule;
  const checkElements = content.querySelectorAll(condition.selector);
  let conditionMet = false;

  checkElements.forEach((element) => {
    if (conditionMet) return;

    if (condition.type === "content") {
      const elementContent = element.textContent?.trim() || "";
      if (condition.contains !== false) {
        conditionMet = elementContent.includes(condition.value);
      } else {
        conditionMet = elementContent === condition.value;
      }
    } else if (condition.type === "style") {
      const elementStyle = element.getAttribute("style") || "";
      if (condition.contains !== false) {
        conditionMet = elementStyle.includes(condition.value);
      } else {
        conditionMet = elementStyle === condition.value;
      }
    }
  });

  if (conditionMet) {
    const elementsToRemove = content.querySelectorAll(removeSelector);
    elementsToRemove.forEach((element) => {
      element.remove();
    });
  }
}

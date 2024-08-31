import DOMPurify from "isomorphic-dompurify";
import parse from "node-html-parser";
import { sites } from "@/data/siteRules";
import { Font, Rules } from "@/types";
import { allSitesRules } from "@/data/allSites";

export default async function getArticle(
  link: string,
  baseURL: string,
  originalLink: string,
  font: Font
) {
  baseURL = baseURL.replace(/\/$/, "");
  const site = new URL(originalLink).hostname;
  console.log(site);

  const data = await fetch(link).then((res) => res.text());
  const root = parse(data);

  const content = root.querySelector("#CONTENT") as unknown as HTMLElement;

  if (!content) {
    window.location.replace(link);
    return "";
  }

  updateFontsizes(content, font);

  //fix images
  fixImages(content, baseURL);

  //all sites logic
  applyRules(allSitesRules, content);

  //newspaper specific logic.
  if (site in sites) {
    const rules = sites[site];
    applyRules(rules, content);
  }

  return DOMPurify.sanitize(content.toString());
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
}

function fixImages(content: HTMLElement, baseURL: string) {
  const images = content.querySelectorAll("img");
  images.forEach((image) => {
    const src = image.getAttribute("src");
    // starts with /, so it's relative
    if (src && src.startsWith("/")) {
      image.setAttribute("src", `${baseURL}${src}`);
    }
    // set opacity to 1, update the style, don't override the style
    image.setAttribute(
      "style",
      (image.getAttribute("style") || "") + "opacity: 1;"
    );

    // if the alt text is an emoji, make it inline
    if (image.getAttribute("alt")?.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/)) {
      image.setAttribute("style", "width: 1em; height: 1em; display: inline");
    }
  });
}

function updateFontsizes(content: HTMLElement, font: Font) {
  //   find all the elements with font size, and scale them up
  const elements = content.querySelectorAll("*");
  elements.forEach((element) => {
    const style = element.getAttribute("style");
    if (style && style.includes("font-size:")) {
      const fontSize = style.match(/font-size: ?(\d+)px/);
      if (fontSize) {
        const size = parseInt(fontSize[1]);
        element.setAttribute(
          "style",
          style.replace(fontSize[0], `font-size: ${size * font.scale}px`)
        );
      }
    }
    if (font.height && style && style.includes("line-height:")) {
      const lineHeight = style.match(/line-height: ?(\d+)px/);
      if (lineHeight) {
        const height = parseInt(lineHeight[1]);
        element.setAttribute(
          "style",
          style.replace(lineHeight[0], `line-height: ${height * font.height}px`)
        );
      }
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

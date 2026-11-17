/** Structural and navigational checks for an already rendered illustrated lesson.
 * These checks do not prove the truth of rules or the correctness of road geometry.
 * HTML references are site-root relative in generated lesson fragments.
 */
import { existsSync } from "node:fs";
import nodePath from "node:path";

const attributes = (html, name) =>
  [...html.matchAll(new RegExp('\\b' + name + '=["\\\']([^"\\\']+)["\\\']', 'g'))].map(match => match[1]);

export function inspectVisualHtml(html, { id = "visual", siteRoot, rewritten = false } = {}) {
  const problems = [];
  const tagCount = (tag) => (html.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
  // The lesson renderer places captions in <p class="figcap"> after each figure.
  const figures = tagCount("figure");
  const externalCaptions = (html.match(/<p\\b[^>]*class=["'][^"']*\\bfigcap\\b[^"']*["']/g) || []).length;
  const captions = tagCount("figcaption") + externalCaptions;
  const svgs = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(match => match[0]);

  if (figures && captions < figures) {
    problems.push(`${id}: ${figures} figures but only ${captions} captions`);
  }

  // An SVG is a meaningful instructional illustration, not decoration.
  for (const [index, svg] of svgs.entries()) {
    if (!/\brole=["']img["']/.test(svg) || !/\baria-label=["'][^"']+["']/.test(svg)) {
      problems.push(`${id}: SVG ${index + 1} lacks accessible description`);
    }
    if (!/\bviewBox=["'][^"']+["']/.test(svg)) {
      problems.push(`${id}: SVG ${index + 1} lacks a viewBox for scaling`);
    }
  }

  const ids = attributes(html, "id");
  if (new Set(ids).size < ids.length) problems.push(`${id}: duplicate HTML/SVG ids`);
  for (const anchor of attributes(html, "href").filter(link => link.startsWith("#") && link.length > 1)) {
    if (!ids.includes(decodeURIComponent(anchor.slice(1)))) {
      problems.push(`${id}: unresolved fragment ${anchor}`);
    }
  }

  if (rewritten) {
    if (/<div\s+class=["']scene["']|class=["']scene-tabs["']|type=["']radio["']/.test(html)) {
      problems.push(`${id}: obsolete interactive scene controls`);
    }
    if (!figures) problems.push(`${id}: no illustrated scenes`);
    // Visual lessons are articles, not question-answer panels.
    if (/class=["'](?:answers|ansbtn|question-options)["']/.test(html)) {
      problems.push(`${id}: inline test controls in illustrated article`);
    }
  }

  // The generated pages treat links to norm/ and practice.html as site-root-relative.
  // Relative links are checked against site/, not against site/lessons/.
  if (siteRoot) {
    for (const url of attributes(html, "href")) {
      if (/^(?:https?:|mailto:|tel:|\/\/|#)/i.test(url)) continue;
      const target = url.split(/[?#]/, 1)[0];
      if (!target || target.startsWith("/") || target.startsWith("../")) continue;
      if (!existsSync(nodePath.join(siteRoot, target))) {
        problems.push(`${id}: broken local link ${url}`);
      }
    }
  }

  return { problems, figures, svgs: svgs.length, links: attributes(html, "href").length };
}

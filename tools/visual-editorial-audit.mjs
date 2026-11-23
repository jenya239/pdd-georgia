/**
 * Deterministic structural review for visual lessons.
 * Not a substitute for legal, literary or graphical review.
 * Run with Node.js 24.22+: node tools/visual-editorial-audit.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorld } from "./load-ontology.mjs";
import { inspectVisualHtml } from "./editorial/visual-html-check.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");
const links = (html) => [...html.matchAll(/\bhref=["']([^"']+)["']/g)].map((match) => match[1]);
const figures = (html) => (html.match(/<figure\b/g) || []).length;
const svgBlocks = (html) => [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]);

function localTarget(link) {
  if (!link || /^(?:[a-z]+:|\/\/|#)/i.test(link)) return null;
  const file = link.split(/[?#]/, 1)[0];
  if (!file || file.startsWith("../") || file.startsWith("/")) return null;
  return file;
}

export function auditVisualEditorial(root = defaultRoot, world = loadWorld(root)) {
  const problems = [];
  const metadata = JSON.parse(read(root, "content/plan/visual-editorial-review.json"));
  const assigned = world.deriveAssignment().assigned;
  const ids = new Set();
  for (const item of metadata.episodes) {
    if (ids.has(item.id)) problems.push(`duplicate episode ${item.id}`);
    ids.add(item.id);
    if (!existsSync(path.join(root, item.published))) {
      problems.push(`${item.id}: missing published page ${item.published}`);
      continue;
    }
    const html = read(root, item.published);
    const structural = inspectVisualHtml(html, { id: item.id, siteRoot: path.join(root, "site"), rewritten: item.status === "rewritten" });
    problems.push(...structural.problems);
    if (figures(html) < item.minFigures) {
      problems.push(`${item.id}: ${figures(html)} figures, expected at least ${item.minFigures}`);
    }
    const hrefs = links(html);
    for (const link of hrefs) {
      if (!link.startsWith("norm/")) continue;
      const target = localTarget(link);
      if (target && !existsSync(path.join(root, "site", target))) {
        problems.push(`${item.id}: dead norm link ${link}`);
      }
    }
    for (const required of item.requiredNormLinks) {
      if (!hrefs.includes(required)) problems.push(`${item.id}: norm citation not shown ${required}`);
    }
    for (const ticket of [...item.integratedTickets, ...item.candidateTickets]) {
      if (!world.questions.has(ticket)) problems.push(`${item.id}: unknown official ticket ${ticket}`);
      if (assigned[ticket] !== item.id) {
        problems.push(`${item.id}: ticket ${ticket} derived assignment is ${assigned[ticket] ?? "blocked/unassigned"}`);
      }
    }
    if (item.status !== "planned") {
      for (const ticket of item.integratedTickets) {
        if (!html.includes(`№${ticket}`)) {
          problems.push(`${item.id}: integrated ticket ${ticket} missing from published narrative`);
        }
      }
    }
    if (item.status === "rewritten" && /<div class="scene">|class="scene-tabs"|type="radio"/.test(html)) {
      problems.push(`${item.id}: interactive scene controls remain in visual article`);
    }
    for (const svg of svgBlocks(html)) {
      if (!/role="img"/.test(svg) || !/aria-label="/.test(svg)) {
        problems.push(`${item.id}: SVG without accessible role and label`);
      }
    }
    const idsWithin = [...html.matchAll(/\bid="(ep0[1-8]-[^"]+)"/g)].map((m) => m[1]);
    if (new Set(idsWithin).size !== idsWithin.length) {
      problems.push(`${item.id}: duplicate SVG or input ids`);
    }
  }
  for (const [a, b] of [["web/index.html", "site/index.html"], ["web/course.html", "site/course.html"]]) {
    if (!existsSync(path.join(root, a)) || !existsSync(path.join(root, b)) || read(root, a) !== read(root, b)) {
      problems.push(`static source/published mismatch: ${a} <-> ${b}`);
    }
  }
  const retired = [
    "site/visual.html",
    "web/visual.html",
    "site/lessons/ep04.html",
    "site/lessons/ep05.html",
    "site/lessons/ep06.html",
    "site/media/ep01.mp4",
    "site/media/ep02.mp4",
    "site/media/ep03.mp4",
    "site/media/ep04.mp4",
    "site/media/ep04-tickets.mp4",
  ];
  for (const rel of retired) {
    if (existsSync(path.join(root, rel))) problems.push(`retired material still published: ${rel}`);
  }
  for (const rel of ["site/index.html", "site/course.html"]) {
    const page = read(root, rel);
    if (/visual\.html|С диалогом|Без персонажей/.test(page)) problems.push(`${rel}: old edition or prototype link`);
  }
  return { problems, covered: metadata.episodes.length, rewritten: metadata.episodes.filter(x => x.status === "rewritten").length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditVisualEditorial();
  for (const problem of result.problems) process.stderr.write(`ERROR ${problem}\n`);
  if (result.problems.length) process.exitCode = 1;
  else process.stdout.write(`Visual editorial structure OK: ${result.rewritten}/${result.covered} rewritten, citations and ticket assignments checked.\n`);
}

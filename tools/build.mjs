import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { citedNorms } from "../packages/domain/ontology.ts";
import { ticketHash } from "../packages/domain/ticket-hash.ts";
import { lessonBundle, lessonFiles } from "../packages/lesson/files.ts";
import {
  coreTicketIds,
  episodeKind,
  lessonTicketIds,
  linkedTicketIds,
} from "../packages/build/episodes.ts";
import { breakdownRecords } from "../packages/build/breakdowns.ts";
import { exportItems } from "../packages/build/items.ts";
import { parseAnnex, parseLaw } from "../packages/build/law-ru.ts";
import { applyTranslations } from "../packages/build/mt-apply.ts";
import { linkCourse } from "../packages/build/normlink.ts";
import { parsePlan, withCounts } from "../packages/build/plan.ts";
import { dumps } from "../packages/build/pyjson.ts";
import { buildTicketRecords } from "../packages/build/ticket-record.ts";
import {
  asMap,
  episodeQuotes,
  lawQuotes,
  lessonAssetRefs,
  lessonAssetSource,
  linkedTotal,
  matchStats,
  mediaSource,
  normPairs,
  plain,
  planCopies,
  signImage,
  ticketImageSource,
  unlinkedBreakdown,
} from "../packages/build/static-copy.ts";
import { loadItems, loadWorld } from "./load-ontology.mjs";
import { renderNormPages } from "./render-norm-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const META = "teoria.on.ge (кат. B/B1), выгрузка 20.10.2026; закон: Matsne, ред. 25.06.2026";
const SOURCE_KEYS = new Set(["ticket_refs", "ticket_ids", "quote_refs", "annex_quotes", "teaches", "pitfalls", "linked", "edition_labels"]);

const readText = (rel) => readFileSync(path.join(root, rel), "utf8");
const readJson = (rel) => JSON.parse(readText(rel));

export function buildSite() {
  const world = loadWorld(root);
  const questions = readJson("data/tickets/tickets_ru.json").questions;
  const sourceEpisodes = readJson("content/episodes.json");
  const ru = parseLaw(readText("data/sources/law_ru_matsne_pub36_2026-06-25.txt"));
  const ka = parseLaw(readText("data/sources/law_ka_matsne_pub36_2026-06-25.txt"));
  const annexRu = parseAnnex(readText("data/sources/annexes_ru_matsne_pub36.txt"));
  const annexKa = parseAnnex(readText("data/sources/annexes_ka_matsne_pub36_2026.txt"));
  const assigned = world.deriveAssignment().assigned;
  const pitfalls = {};
  for (const episode of sourceEpisodes) pitfalls[episode.id] = episode.pitfalls ?? {};
  const records = buildTicketRecords({ questions, ru, ka, annexRu, annexKa, assigned, pitfalls });
  const breakdownItems = loadBreakdowns();
  const linkedBr = new Map(breakdownRecords(breakdownItems, world));
  applyTranslations(records, questions, readJson("content/translations/explanations_ru.json").items);
  const stats = matchStats(questions, ru, ka, annexRu, annexKa);
  stats.set("tickets_with_quotes", records.filter((record) => record.get("law").length).length);
  const rawItems = loadItems(root);
  const episodes = sourceEpisodes.map((episode) => assembleEpisode(episode, questions, assigned, rawItems, ru, annexRu));
  const itemDoc = plain(exportItems(rawItems, world));
  const bundle = lessonBundle();
  const lessons = {};
  const plains = {};
  for (const episode of sourceEpisodes) {
    if (bundle.raw[episode.id]) lessons[episode.id] = bundle.raw[episode.id];
    if (bundle.raw[`${episode.id}-plain`]) plains[episode.id] = bundle.raw[`${episode.id}-plain`];
  }
  const laws = lawQuotes(records, ru, annexRu);
  const cache = readJson("content/translations/explanations_ru.json").items;
  const skipExRu = new Set(questions.filter((question) => cache[`${question.id}:ex`]?.masked === false).map((question) => question.id));
  const rawBr = new Map(breakdownItems.map((item) => [item.ticket, unlinkedBreakdown(item, world, assigned)]));
  const shadows = records.map((record) => ({
    id: record.get("id"),
    lesson: record.get("lesson"),
    ex: record.get("ex"),
    ex_ru: record.get("ex_ru"),
    why: record.get("why"),
    br: rawBr.get(record.get("id")),
  }));
  const normList = readJson("content/ontology/generated/norms.json").norms;
  const report = linkCourse({
    norms: normList,
    episodes,
    lessons,
    plains: { ...plains },
    laws: [...laws],
    tickets: shadows,
    banks: questions.map((question) => citedNorms(question, world.normIds, world.normText, world.annotation(question.id).norms || [])),
    items: itemDoc.items,
    misconceptions: itemDoc.misconceptions,
    skipExRu,
  });
  stats.set("norm_links", linkedTotal(report));
  const byNorm = new Map(normList.map((norm) => [norm.id, norm]));
  const tickets = records.map((record, index) => finishTicket(record, linkedBr.get(record.get("id")), shadows[index]._r, world, byNorm));
  for (const item of itemDoc.items) {
    const src = rawItems.find((row) => row.id === item.id);
    item.nm = { m: normPairs(src.norms ?? [], byNorm) };
    item.cn = [...(src.concepts ?? [])];
  }
  const files = new Map([
    ["data/tickets.json", dumps(ticketDocument(questions, tickets, itemDoc.items, laws, stats, world, episodes))],
    ["data/items.json", dumps(asMap(itemDoc))],
    ["data/episodes.json", dumps(episodeDocument(questions, episodes), { indent: 1 })],
  ]);
  for (const [rel, html] of Object.entries(lessonFiles())) files.set(rel, html);
  for (const [rel, html] of Object.entries(renderNormPages())) files.set(rel, html);
  for (const [name, text] of Object.entries(domainFiles()).sort(([left], [right]) => left < right ? -1 : 1)) {
    files.set(`assets/domain/${name}`, text);
  }
  files.set(".nojekyll", "");
  return { files, copies: copyMap(episodes, records, bundle.raw, normList) };
}

function ticketDocument(questions, tickets, items, laws, stats, world, episodes) {
  const topics = new Map();
  for (const question of questions) topics.set(String(question.topic_id), question.topic_ru);
  const used = new Set();
  for (const ticket of tickets) for (const id of ticket.get("cn") ?? []) used.add(id);
  for (const item of items) for (const id of item.cn ?? []) used.add(id);
  const concepts = new Map();
  for (const id of [...used].sort()) {
    const concept = world.concepts[id];
    if (concept) concepts.set(id, concept.label);
  }
  const lessons = new Map(episodes.map((episode) => [episode.id, `Выпуск ${episode.num}. ${episode.title}`]));
  return new Map([
    ["meta", new Map([
      ["built_from", META],
      ["count", tickets.length],
      ["topics", topics],
      ["stats", stats],
      ["concepts", concepts],
      ["lessons", lessons],
    ])],
    ["tickets", tickets],
    ["laws", new Map([...laws].map(([key, quote]) => [key, asMap(quote)]))],
  ]);
}

function episodeDocument(questions, episodes) {
  const plan = withCounts(parsePlan(readText("content/plan/structure.md")), questions.map((question) => question.episodes));
  return new Map([
    ["plan", plan.map((row) => new Map([["e", row.e], ["block", row.block], ["title", row.title], ["src", row.src], ["n", row.n]]))],
    ["released", episodes.map((episode) => asMap(episode))],
  ]);
}

function assembleEpisode(episode, questions, assigned, items, ru, annexRu) {
  const built = {};
  for (const [key, value] of Object.entries(episode)) if (!SOURCE_KEYS.has(key)) built[key] = value;
  const kind = episodeKind(episode);
  built.kind = kind;
  const own = items.filter((item) => item.lesson === episode.id).map((item) => item.id);
  if (own.length) built.own_items = own;
  const lessonIds = lessonTicketIds(episode.id, assigned);
  const core = coreTicketIds(episode, questions);
  built.tickets_lesson = lessonIds;
  built.tickets_core = core;
  built.tickets_linked = linkedTicketIds(episode, questions, core, lessonIds);
  built.law_quotes = episodeQuotes(episode, ru, annexRu);
  return withEditions(built, episode, kind);
}

function withEditions(built, episode, kind) {
  const plain = hasPlain(episode.id);
  if (plain && kind !== "text") {
    built.editions = [
      { id: "dialogue", label: "Ролик", href: episode.video },
      { id: "plain", label: "Без персонажей", href: `lessons/${episode.id}-plain.html` },
    ];
  }
  if (kind === "text" && plain) built.editions = textEditions(episode);
  return built;
}

function hasPlain(id) {
  return existsSync(path.join(root, "content/lessons", id, "plain.mjs")) || Object.hasOwn(lessonBundle().raw, `${id}-plain`);
}

function textEditions(episode) {
  const labels = episode.edition_labels;
  if (Array.isArray(labels) && labels.length === 2) {
    return [
      { id: "full", label: labels[0], href: episode.lesson },
      { id: "short", label: labels[1], href: `lessons/${episode.id}-plain.html` },
    ];
  }
  return [
    { id: "dialogue", label: "С диалогом", href: episode.lesson },
    { id: "plain", label: "Без персонажей", href: `lessons/${episode.id}-plain.html` },
  ];
}

function finishTicket(record, br, ann, world, byNorm) {
  const out = new Map();
  let placed = false;
  const place = () => {
    if (placed) return;
    if (br) out.set("br", br);
    placed = true;
  };
  for (const [key, value] of record) {
    if (key === "ex_ru" || key === "mt") place();
    out.set(key, value);
  }
  place();
  if (ann && Object.keys(ann).length) out.set("_r", asMap(ann));
  const norms = world.ticketNorms(record.get("id"));
  const checked = normPairs(norms.norms ?? [], byNorm);
  const nm = new Map([["m", checked]]);
  if (norms.context?.length) nm.set("x", normPairs(norms.context, byNorm));
  if (checked.length || nm.has("x")) out.set("nm", nm);
  const concepts = world.ticketConcepts(record.get("id"));
  if (concepts.length) out.set("cn", concepts);
  out.set("hash", ticketHash({
    q: { ru: record.get("q").get("ru") },
    a: { ru: record.get("a").get("ru") },
    c: record.get("c"),
  }));
  return out;
}

function copyMap(episodes, records, raw, normList) {
  const lessonAssets = [];
  const media = [];
  for (const episode of episodes) {
    if (episode.kind === "text") {
      const prefix = `lessons/${episode.id}/`;
      const names = new Set([
        ...lessonAssetRefs(raw[episode.id] ?? "", prefix),
        ...lessonAssetRefs(raw[`${episode.id}-plain`] ?? "", prefix),
      ]);
      for (const name of [...names].sort()) {
        const inLesson = existsSync(path.join(root, "content/lessons", episode.id, name));
        lessonAssets.push({ dest: prefix + name, source: lessonAssetSource(episode.id, name, inLesson) });
      }
    }
    for (const key of ["poster", "video", "tickets_video"]) {
      const rel = episode[key];
      const source = typeof rel === "string" ? mediaSource(rel) : null;
      if (source) media.push({ dest: rel, source });
    }
  }
  const ticketImages = [];
  for (const record of records) {
    const img = record.get("img");
    if (typeof img === "string") ticketImages.push({ dest: img, source: ticketImageSource(img) });
  }
  const signs = [];
  const seen = new Set();
  for (const norm of normList) {
    const name = signImage(norm.id);
    if (!name || seen.has(name) || !existsSync(path.join(root, "content/assets/signs", name))) continue;
    seen.add(name);
    signs.push(name);
  }
  const copies = new Map();
  for (const spec of planCopies({ lessonAssets, media, ticketImages, webFiles: walkFiles(path.join(root, "web")), signs })) {
    copies.set(spec.dest, path.join(root, spec.source));
  }
  return copies;
}

function domainFiles() {
  const run = spawnSync(process.execPath, ["tools/emit-domain.mjs"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(run.stderr || "emit-domain failed");
  return JSON.parse(run.stdout);
}

function loadBreakdowns() {
  const dir = path.join(root, "content/breakdowns");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => Number(left.slice(0, -".json".length)) - Number(right.slice(0, -".json".length)))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")));
}

function walkFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return walkFiles(dir);
}

function mismatch(rel, expected, actual) {
  const length = Math.min(expected.length, actual.length);
  let index = 0;
  while (index < length && expected[index] === actual[index]) index += 1;
  return `changed ${rel} at ${index} expected ${JSON.stringify(expected.slice(index, index + 80))} actual ${JSON.stringify(actual.slice(index, index + 80))}`;
}

function checkTree(outDir, files, copies) {
  const problems = [];
  for (const [rel, text] of files) {
    const full = path.join(outDir, rel);
    if (!existsSync(full)) problems.push(`missing ${rel}`);
    else {
      const actual = readFileSync(full, "utf8");
      if (actual !== text) problems.push(mismatch(rel, text, actual));
    }
  }
  for (const [rel, source] of copies) {
    const full = path.join(outDir, rel);
    if (!existsSync(full)) problems.push(`missing ${rel}`);
    else if (!readFileSync(full).equals(readFileSync(source))) problems.push(`changed ${rel}`);
  }
  const known = new Set([...files.keys(), ...copies.keys()]);
  for (const rel of filesUnder(outDir)) if (!known.has(rel)) problems.push(`extra ${rel}`);
  return problems;
}

function writeTree(outDir, files, copies) {
  rmSync(outDir, { recursive: true, force: true });
  for (const [rel, text] of files) {
    const full = path.join(outDir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  for (const [rel, source] of copies) {
    const full = path.join(outDir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    copyFileSync(source, full);
  }
}

function main() {
  const check = process.argv.includes("--check");
  const outArg = process.argv.find((arg) => arg.startsWith("--out="));
  const out = outArg ? outArg.slice("--out=".length) : path.join(root, "site");
  const { files, copies } = buildSite();
  for (const dest of copies.keys()) if (files.has(dest)) throw new Error(`${dest} is both generated and copied`);
  const missing = [...copies].filter(([, source]) => !existsSync(source)).map(([dest]) => dest);
  if (missing.length) {
    console.error("missing source files:", missing);
    return 2;
  }
  if (check) {
    const problems = checkTree(out, files, copies);
    for (const problem of problems.slice(0, 50)) console.log(problem);
    console.log(`${out}: ${problems.length ? `OUT OF DATE (${problems.length} differences)` : "up to date"}`);
    return problems.length ? 1 : 0;
  }
  writeTree(out, files, copies);
  console.log(`wrote ${files.size + copies.size} files`);
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

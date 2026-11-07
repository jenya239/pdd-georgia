import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { citedNorms } from "../../packages/domain/ontology.ts";
import { occurrences } from "../../packages/build/normref-find.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("norm occurrences match Python across the corpus", () => {
  const jobs = corpus();
  const got = occurrences(jobs, ids, kaText);
  const oracle = pythonOccurrences(jobs);
  assert.equal(got.length, oracle.length);
  for (let i = 0; i < got.length; i += 1) {
    const left = JSON.stringify(got[i]);
    const right = JSON.stringify(oracle[i]);
    assert.equal(left === right, true, `${jobs[i].id}\n${left}\n${right}`);
  }
});

const norms = readJson("content/ontology/generated/norms.json").norms;
const ids = new Set(norms.map((norm) => norm.id));
const normText = new Map(norms.map((norm) => [norm.id, norm.ru || ""]));
const kaText = new Map(norms.map((norm) => [norm.id, norm.ka || ""]));

function corpus() {
  const jobs = [];
  const questions = readJson("data/tickets/tickets_ru.json").questions;
  const annotated = readJson("content/ontology/tickets.json");
  for (const question of questions) {
    const cited = citedNorms(question, ids, normText, annotated[String(question.id)]?.norms || []);
    push(jobs, `ticket:${question.id}:ex`, "ka", question.explanation_ka, {
      confirmed: cited.norms,
      strict: cited.unresolved.length > 0,
    });
    push(jobs, `ticket:${question.id}:q`, "ru", question.question);
    question.answers.forEach((answer, index) => push(jobs, `ticket:${question.id}:a${index}`, "ru", answer.text));
    push(jobs, `ticket:${question.id}:kaq`, "ka", question.ka?.question);
    question.ka?.answers?.forEach((answer, index) => push(jobs, `ticket:${question.id}:kaa${index}`, "ka", answer.text));
  }
  for (const norm of norms) {
    push(jobs, `norm:${norm.id}:ru`, "ru", norm.ru, { ownArticle: norm.article ?? null });
    push(jobs, `norm:${norm.id}:ka`, "ka", norm.ka);
  }
  walk(readJson("content/episodes.json"), "episodes", "ru", jobs);
  walk(readJson("content/ontology/misconceptions.json"), "misconceptions", "ru", jobs);
  for (const name of readdirSync(path.join(root, "content/breakdowns")).filter((file) => file.endsWith(".json")).sort()) {
    walk(readJson(path.join("content/breakdowns", name)), `breakdown:${name}`, "ru", jobs);
  }
  for (const name of readdirSync(path.join(root, "content/checkitems")).filter((file) => file.endsWith(".json")).sort()) {
    walk(readJson(path.join("content/checkitems", name)), `item:${name}`, "ru", jobs);
  }
  for (const name of readdirSync(path.join(root, "site/lessons")).filter((file) => file.endsWith(".html")).sort()) {
    push(jobs, `lesson:${name}`, "ru", readFileSync(path.join(root, "site/lessons", name), "utf8"));
  }
  return jobs;
}

function push(jobs, id, lang, text, extra = {}) {
  if (text) jobs.push({ id, lang, text, ...extra });
}

function walk(value, id, lang, jobs) {
  if (typeof value === "string") {
    push(jobs, id, lang, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${id}:${index}`, lang, jobs));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) walk(item, `${id}:${key}`, lang, jobs);
  }
}

function pythonOccurrences(jobs) {
  const dir = mkdtempSync(path.join(tmpdir(), "pdd-normref-"));
  const input = path.join(dir, "jobs.json");
  const output = path.join(dir, "out.json");
  writeFileSync(input, JSON.stringify(jobs));
  const script = `
import json
from pdd.normref import explicit_cites, find_ka, find_ru, resolve_ka, resolve_ru
norms = json.load(open("content/ontology/generated/norms.json", encoding="utf-8"))["norms"]
ids = {n["id"] for n in norms}
ka = {n["id"]: n.get("ka") or "" for n in norms}
jobs = json.load(open(${JSON.stringify(input)}, encoding="utf-8"))
out = []
for job in jobs:
    if job["lang"] == "ru":
        refs = find_ru(job["text"])
        resolve_ru(refs, ids, [explicit_cites(refs), *job.get("scopes", [])], job.get("ownArticle"))
    else:
        refs = resolve_ka(find_ka(job["text"]), ids, ka, job.get("confirmed") or [], bool(job.get("strict")))
    out.append([[r.start, r.end, r.norm if r.status == "linked" else r.status] for r in refs])
json.dump(out, open(${JSON.stringify(output)}, "w", encoding="utf-8"), ensure_ascii=False)
`;
  const run = spawnSync(".venv/bin/python", ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: "tools" },
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
  return JSON.parse(readFileSync(output, "utf8"));
}

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

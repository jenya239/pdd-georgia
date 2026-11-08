import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function nextLesson(ids, done) {
  const finished = new Set(done);
  const pending = ids.filter((id) => !finished.has(id));
  if (pending.length) return pending[0];
  const last = ids.reduce((max, id) => Math.max(max, Number(id.slice(2)) || 0), 0);
  return `ep${String(last + 1).padStart(2, "0")}`;
}

export function missingIds(pairs, lesson, files) {
  return pairs
    .filter(([ticket, id]) => id === lesson && !files.has(String(ticket)))
    .map(([ticket]) => String(ticket))
    .sort((a, b) => Number(a) - Number(b));
}

export function readDone(stateText) {
  const line = String(stateText).split("\n").find((row) => row.startsWith("done:"));
  if (!line) return [];
  return line.slice("done:".length).split(",").map((item) => item.trim()).filter(Boolean);
}

export function readStatus(stateText) {
  const line = String(stateText).split("\n").find((row) => row.startsWith("status:"));
  return line ? line.slice("status:".length).trim() : "ready";
}

export function readNext(stateText) {
  const line = String(stateText).split("\n").find((row) => row.startsWith("next_lesson:"));
  return line ? line.slice("next_lesson:".length).trim() : "";
}

function breakdownFiles(repo) {
  return new Set(
    readdirSync(path.join(repo, "content/breakdowns"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length)),
  );
}

export function queueReport(repo, stateText) {
  const world = loadWorld(repo);
  const done = readDone(stateText);
  const status = readStatus(stateText);
  const pinned = readNext(stateText);
  const next = status === "in_progress" && pinned ? pinned : nextLesson(world.lessonOrder, done);
  const pairs = Object.entries(world.deriveAssignment().assigned);
  const assigned = pairs.filter(([, lesson]) => lesson === next).map(([ticket]) => String(ticket));
  const missing = missingIds(pairs, next, breakdownFiles(repo));
  return { next, status, assigned: assigned.sort((a, b) => Number(a) - Number(b)), missing };
}

function printReport(report) {
  console.log(`next: ${report.next}`);
  console.log(`status: ${report.status}`);
  console.log(`assigned: ${report.assigned.length}`);
  console.log(`missing: ${report.missing.length ? report.missing.join(", ") : "нет"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const statePath = path.join(root, "docs/agent/PDD_LESSON_STATE.md");
  const report = queueReport(root, readFileSync(statePath, "utf8"));
  printReport(report);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coversId } from "../../packages/domain/ontology.mjs";
import { assignmentText, loadItems, loadWorld, reportText } from "../../tools/load-ontology.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const world = loadWorld(repo);

test("coversId matches a norm and its dotted children, not a longer sibling", () => {
  assert.equal(coversId("37.6", "37.6.а.а"), true);
  assert.equal(coversId("37.6.а.а", "37.6.а.а"), true);
  assert.equal(coversId("5.1", "5.12"), false);
  assert.equal(coversId("A1:5.2", "A1:5.23"), false);
  assert.equal(coversId("A1:1.прим", "A1:1.прим.а"), true);
  assert.equal(coversId("A1:1.прим", "A1:1.прим2"), false);
});

test("Georgian annex-note citations become Russian norm ids", () => {
  const notes = (id) => world.noteCitations(id);
  assert.deepEqual(notes(611), ["A1:1.прим.а"]);
  assert.deepEqual(notes(618), ["A1:1.прим.а", "A1:1.прим.б", "A1:1.прим.е"]);
  assert.deepEqual(notes(745), ["A1:3.прим2.в.а"]);
  assert.deepEqual(notes(1262), ["A1:3.прим2.д"]);
  assert.deepEqual(notes(13), ["A1:2.прим.а"]);
  assert.deepEqual(notes(187), ["A1:5.прим.б"]);
});

test("a ticket's norms keep the bank primary and add the cited note", () => {
  const stop = world.ticketNorms(314);
  assert.equal(stop.primary, "37.6.а.а");
  assert.ok(stop.norms.includes("37.6.а.а"));
  assert.deepEqual(stop.unresolved, []);
  assert.ok(world.ticketNorms(611).norms.includes("A1:1.прим.а"));
});

test("assignment is the earliest lesson that teaches the primary norm and already knows every concept", () => {
  const { assigned, blocked } = world.deriveAssignment();
  assert.deepEqual(blocked["224"].missing, ["min-speed-sign"]);
  assert.deepEqual(blocked["1262"].missing, ["sign-zone-of-action"]);
  for (const id of [611, 670, 671, 515]) assert.equal(assigned[id], "ep04");
  for (const id of [21, 59, 256, 605, 614, 618, 794]) assert.ok(blocked[id], String(id));
  assert.deepEqual(world.lessonOrder, ["ep01", "ep02", "ep03", "ep04", "ep05", "ep06"]);
  assert.deepEqual(world.integrityErrors(), []);
});

test("context norms are cited scenery, not the primary rule", () => {
  const norms = world.ticketNorms(515);
  assert.deepEqual(world.annotation(515).context_norms, ["A1:5.21"]);
  assert.equal(norms.norms.includes("A1:5.21"), false);
  assert.ok(norms.norms.includes("33.6"));
  assert.deepEqual(norms.context, ["A1:5.21"]);
  assert.equal(world.ticketConcepts(515).includes("living-zone"), false);
  const broken = world.withTicketAnnotation(515, { context_norms: ["33.6", "5.58"] });
  const errors = broken.integrityErrors();
  assert.ok(errors.includes("ticket 515: context norm 33.6 is its primary norm"));
  assert.ok(errors.includes("ticket 515: context norm 5.58 is not cited by the bank"));
});

test("the published assignment is the map whose counts the report lists", () => {
  const assigned = JSON.parse(assignmentText(repo));
  const report = JSON.parse(reportText(repo));
  for (const [lesson, count] of Object.entries(report.assignment.derived)) {
    assert.equal(Object.values(assigned).filter((value) => value === lesson).length, count);
  }
  assert.equal(Object.keys(assigned).length, Object.values(report.assignment.derived).reduce((sum, n) => sum + n, 0));
});

test("the report matches the committed ontology report, including our check items", () => {
  const committedPath = path.join(repo, "content/ontology/generated/report.json");
  const committedText = readFileSync(committedPath, "utf8");
  assert.equal(reportText(repo), committedText);
  assert.deepEqual(world.report(loadItems(repo)), JSON.parse(committedText));
});

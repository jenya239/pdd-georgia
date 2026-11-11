import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentPair } from "../../content/eval/present.mjs";

const rubric = JSON.parse(readFileSync("content/eval/rubric.json", "utf8"));
const set = JSON.parse(readFileSync("content/eval/pairs.json", "utf8"));
const checkIds = ["premature", "new-decision", "swap-breaks", "method", "extra-condition"];

function fileAt(commit, path) {
  return execSync(`git show ${commit}:${path}`, { encoding: "utf8" });
}

test("editorial pairs keep published text and an empty diagnostic label", () => {
  assert.ok(set.items.length >= 8 && set.items.length <= 20);
  const seen = new Set();
  for (const item of set.items) {
    assert.equal(seen.has(item.id), false);
    seen.add(item.id);
    assert.notEqual(item.earlier.trim(), item.later.trim());
    assert.ok(fileAt(item.dropped.commit, item.dropped.path).includes(item.earlier));
    assert.ok(fileAt(item.kept.commit, item.kept.path).includes(item.later));
    if (item.context) {
      const where = item.context_in === "dropped" ? item.dropped : item.kept;
      assert.ok(fileAt(where.commit, where.path).includes(item.context));
    }
    for (const id of checkIds) assert.equal(item.checks[id], null);
    if (item.quote) {
      const where = item.quote_in === "dropped" ? item.dropped : item.kept;
      assert.ok(fileAt(where.commit, where.path).includes(item.quote));
    }
    if (item.status === "gold") {
      assert.equal(item.preferred, "later");
      const message = execSync(`git log -1 --format=%B ${item.kept.commit}`, { encoding: "utf8" });
      assert.ok(message.includes(item.decision));
    } else {
      assert.equal(item.preferred, null);
      assert.ok(item.status === "blind" || item.status === "unlabeled");
    }
  }
  assert.equal(set.items.filter((item) => item.status === "gold").length, 4);
});

test("a presented pair hides which side was published", () => {
  const kinds = new Map(rubric.questions.map((question) => [question.id, question.kind]));
  const orders = new Set();
  for (const item of set.items) {
    const payload = presentPair(item, rubric);
    const packed = JSON.stringify(payload);
    for (const leak of ["preferred", "earlier", "later", "gold", "commit", "dropped", "kept", item.kept.commit]) {
      assert.equal(packed.includes(leak), false, item.id);
    }
    assert.deepEqual(payload.input.options.map((option) => option.text).sort(), [item.earlier, item.later].sort());
    orders.add(payload.input.options[0].text === item.later ? "later-first" : "earlier-first");
    const follow = payload.questions.filter((question) => question.id === "follow");
    assert.equal(follow.length, 1);
    assert.deepEqual(follow[0].options, ["1", "2", "оба приемлемы"]);
    const extra = payload.questions.filter((question) => question.id === "extra-condition");
    assert.equal(extra.length, item.quote ? 2 : 0);
    for (const question of payload.questions) assert.equal(kinds.get(question.id), question.kind);
  }
  assert.equal(orders.size, 2);
});

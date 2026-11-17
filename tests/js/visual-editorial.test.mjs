import { test } from "node:test";
import assert from "node:assert/strict";
import { auditVisualEditorial } from "../../tools/visual-editorial-audit.mjs";

test("published visual lessons preserve normative links and ontology-assigned ticket examples", () => {
  const { problems, covered, rewritten } = auditVisualEditorial();
  assert.equal(covered, 8);
  assert.ok(rewritten >= 3);
  assert.deepEqual(problems, []);
});

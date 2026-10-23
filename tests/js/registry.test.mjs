import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { STORAGE, KEYS, RETIRED } from "../../packages/domain/registry.mjs";
import { createStore, memoryBackend } from "../../packages/domain/store.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;

/** One realistic value per registered key; a new key without a sample fails the round-trip test. */
const SAMPLES = {
  progress: { 5: { s: 3, c: 1, w: 2, l: 0, t: 30, k: 0, lw: 30, lc: 2, p: { 2: 1, 3: 1 } }, 7: { s: 2, c: 2, w: 0, l: 1, t: 9, k: 2 },
    "o-ep05-01": { s: 1, c: 1, w: 0, l: 1, t: 4, k: 1 } },
  runs: [{ id: "r1", lesson: "ep04", date: 11, total: 10, correct: 8, score: 80, wrong: [5, 6] }],
  active: { ep06: { id: "r2", lesson: "ep06", ids: [5, 7], answers: { 5: 1 } } },
  settings: { order: "mixed", own: false },
  exams: [{ d: 100, ok: 27, pass: true, s: 1200 }, { d: 200, ok: 22, pass: false, s: 1700 }],
  theme: "dark",
};

function files(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out); else if (/\.(mjs|js|html)$/.test(n)) out.push(p);
  }
  return out;
}
const SOURCES = [...files(join(ROOT, "web")), ...files(join(ROOT, "packages"))];

test("registry: ids and keys are unique, every entry is described", () => {
  assert.equal(new Set(STORAGE.map(s => s.id)).size, STORAGE.length);
  assert.equal(new Set(STORAGE.map(s => s.key)).size, STORAGE.length);
  for (const s of STORAGE) assert.ok(s.key.startsWith("pddge.") && ["json", "text"].includes(s.kind) && s.what, s.id);
  assert.deepEqual(Object.keys(SAMPLES).sort(), STORAGE.map(s => s.id).sort(), "every registered key needs a round-trip sample");
});

test("registry: code uses no storage key that is not registered, and spells keys only in the registry", () => {
  const registered = new Set([...STORAGE, ...RETIRED].map(s => s.key));
  for (const f of SOURCES) {
    const src = readFileSync(f, "utf8"), rel = relative(ROOT, f);
    for (const m of src.matchAll(/["'`](pddge\.[\w.-]+)["'`]/g)) {
      assert.ok(registered.has(m[1]), `${rel}: unregistered storage key ${m[1]}`);
      assert.equal(rel, "packages/domain/registry.mjs", `${rel}: spell ${m[1]} via KEYS from the registry`);
    }
    for (const m of src.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g))
      assert.match(m[1].trim(), /^KEYS\.\w+$/, `${rel}: storage access must go through KEYS.<id>, got ${m[1]}`);
    for (const m of src.matchAll(/\bKEYS\.(\w+)/g)) assert.ok(m[1] in KEYS, `${rel}: KEYS.${m[1]} is not registered`);
    assert.doesNotMatch(src, /sessionStorage|indexedDB|document\.cookie/, `${rel}: only localStorage via the registry`);
  }
});

test("round trip: every registered key survives export → clear → import (replace)", () => {
  const be = memoryBackend();
  for (const s of STORAGE) be.setItem(s.key, s.kind === "json" ? JSON.stringify(SAMPLES[s.id]) : SAMPLES[s.id]);
  const st = createStore(be);
  const text = st.exportText(1000, "test");
  st.resetAll();
  for (const s of STORAGE) assert.equal(be.getItem(s.key), null, `cleared ${s.key}`);
  st.importText(text, "replace");
  for (const s of STORAGE) {
    const raw = be.getItem(s.key);
    assert.deepEqual(s.kind === "json" ? JSON.parse(raw) : raw, SAMPLES[s.id], `restored ${s.key}`);
  }
});

test("round trip: merge into an empty browser restores everything too", () => {
  const src = memoryBackend();
  for (const s of STORAGE) src.setItem(s.key, s.kind === "json" ? JSON.stringify(SAMPLES[s.id]) : SAMPLES[s.id]);
  const dst = memoryBackend();
  createStore(dst).importText(createStore(src).exportText(1, "test"), "merge");
  for (const s of STORAGE) assert.equal(dst.getItem(s.key), src.getItem(s.key), s.key);
});

test("retired keys: not registered any more, removed from the browser when the store opens", () => {
  assert.deepEqual(RETIRED.map(r => r.key), ["pddge.lang"]);
  for (const r of RETIRED) assert.ok(r.why && !STORAGE.some(s => s.key === r.key), r.key);
  const be = memoryBackend({ "pddge.lang": "ka", [KEYS.theme]: "dark" });
  const st = createStore(be);
  assert.equal(be.getItem("pddge.lang"), null);
  assert.equal(be.getItem(KEYS.theme), "dark");
  assert.equal("lang" in JSON.parse(st.exportText(1, "t")).data, false);
});

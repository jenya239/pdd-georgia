import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const base = "video/episodes/ep03/v2/";
const read = p => readFileSync(p, "utf8");
const scenario = JSON.parse(read(base + "scenario.json"));
const worlds = JSON.parse(read(base + "design/worlds.json"));

test("all 12 scenarios are stable and reading copies are generated, not hand-edited", () => {
  const out = execFileSync(process.execPath, ["tools/ep03-v2.mjs","--check"], {encoding:"utf8"});
  assert.match(out,/in sync/);
  assert.equal(scenario.schemaVersion,2);
  assert.equal(scenario.scenes.length,12);
  assert.ok(scenario.narrativeArc?.centralQuestion?.includes("одно и то же"));
  assert.ok(scenario.narrativeArc?.resolution?.includes("правило"));
  for (const scene of scenario.scenes) {
    assert.ok(scene.dramaticFunction?.length > 25, scene.id);
    assert.ok(scene.bridgeToNext?.length > 30, scene.id);
  }
  assert.equal(scenario.scenes[9].mode,"legal-neighbor");
  assert.equal(scenario.scenes[10].mode,"documented-case");
  assert.deepEqual(scenario.scenes.map(s=>s.id),Array.from({length:12},(_,i)=>"S"+String(i).padStart(2,"0")));
  const screenplay = read(base+"SCREENPLAY.md");
  const voice = read(base+"VOICE.txt");
  for (const scene of scenario.scenes) {
    assert.ok(screenplay.includes(`### ${scene.id} · ${scene.title}`),scene.id);
    assert.ok(voice.includes("@@"+scene.id),scene.id);
    for (const p of scene.voice) {
      assert.ok(screenplay.includes("> "+p),`${scene.id}: missing screenplay VO`);
      assert.ok(voice.includes(p),`${scene.id}: missing TTS VO`);
    }
  }
  assert.ok(!scenario.scenes.some(s=>s.voice.some(x=>/Аня|Макс|Сергей Павлович/.test(x))));
});

test("world-state counterfactuals preserve cars and reflect only legal changes", () => {
  assert.equal(worlds.schemaVersion,1);
  const w=worlds.worlds;
  for (const id of ["A0","A1","A2","A3","A4","A5"]) assert.equal(w[id].geometry,"cross",id);
  assert.deepEqual(worlds.vehicleTemplates.blue.start,{x:-38,y:0,headingDeg:0});
  assert.deepEqual(worlds.vehicleTemplates.red.start,{x:0,y:-38,headingDeg:90});
  assert.equal(w.A1.expected.yielder,"red");
  assert.equal(w.A2.expected.yielder,"red");
  assert.ok(w.A2.surface.localPatch.immediatelyBeforeIntersection);
  assert.equal(w.A3.surface.v,"paved");
  assert.equal(w.A3.expected.yielder,"blue");
  assert.equal(w.A4.signs.length,2);
  assert.equal(w.A4.expected.yielder,"blue");
  assert.deepEqual(w.A5.signs,[]);
  assert.equal(w.A5.expected.kind,"underdetermined");
  assert.equal(w.A5.expected.winner,null);
  assert.equal(w.B1.expected.kind,"legal-review-required");
  assert.equal(w.C1.expected.yielder,"red");
  assert.equal(w.C2.expected.yielder,"blue");
  assert.equal(w.C1.geometry,"yard");
  assert.equal(w.C2.geometry,"publicT");
  assert.equal(worlds.transitions.find(t=>t.from==="A1"&&t.to==="A2").expectedLegalChange,false);
  assert.equal(worlds.transitions.find(t=>t.from==="C1"&&t.to==="C2").expectedLegalChange,true);
});

test("law references are real locally tracked norm pages; real crash has external official evidence", () => {
  const all = new Set(scenario.scenes.flatMap(s=>s.norms));
  assert.ok(all.size>=12);
  for(const id of all){
    const path="site/norm/"+id+".html";
    assert.ok(existsSync(path),id);
    assert.ok(read(path).length>300,id);
  }
  const incident=scenario.scenes.find(s=>s.id==="S10");
  assert.ok(incident.source_url.startsWith("https://www.ntsb.gov/"));
  assert.ok(incident.voice.join(" ").includes("американском штате Нью-Джерси"));
  assert.ok(incident.voice.join(" ").includes("не пример неверного применения грузинской"));
  assert.ok(worlds.worlds.D1.geometry.includes("symbolic"));
});

test("production document set is complete, and existing ep03 published assets stay outside v2", () => {
  const docs=["README.md","SCREENPLAY.md","VOICE.txt","VISUAL_BIBLE.md","LEGAL_AND_EVIDENCE.md",
    "PRODUCTION.md","ACCEPTANCE.md","GROKBOT_START.md","design/worlds.json"];
  for(const name of docs)assert.ok(existsSync(base+name),name);
  assert.ok(existsSync(base+"NARRATIVE_BIBLE.md"));
  assert.ok(read(base+"NARRATIVE_BIBLE.md").includes("Тест А — слушать без изображения"));
  assert.ok(existsSync("video/episodes/ep03/scenes.py"));
  assert.ok(existsSync("video/episodes/ep03/boards.py"));
  assert.ok(existsSync("content/media/ep03.mp4"));
  const accept=read(base+"ACCEPTANCE.md");
  for(const phrase of ["A2→A3","C1→C2","NTSB","правов","субтитр"])
    assert.ok(accept.includes(phrase),phrase);
});

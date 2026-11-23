import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildFrame } from "../../video/episodes/ep03/v2/engine/frame.mjs";
import {
  LEAD, buildTimeline, flattenVoices, masterAt, subtitlePieces,
} from "../../video/episodes/ep03/v2/engine/master.mjs";
import { film } from "../../video/episodes/ep03/v2/engine/stories.mjs";

const scenario = JSON.parse(readFileSync(new URL("../../video/episodes/ep03/v2/scenario.json", import.meta.url), "utf8"));

test("the silent film keeps its length and the review timeline follows the phrases", () => {
  assert.equal(film().duration, 206);
  const voices = flattenVoices(scenario);
  assert.equal(voices.length, scenario.scenes.reduce((sum, scene) => sum + scene.voice.length, 0));
  const timeline = buildTimeline(voices, voices.map(() => 10));
  assert.equal(timeline.scenes.length, 12);
  assert.equal(timeline.scenes[0].start, 0);
  assert.equal(timeline.cues[0].start, LEAD);
  assert.equal(timeline.cues.at(-1).end < timeline.duration, true);
  for (let i = 1; i < timeline.cues.length; i++) {
    assert.ok(timeline.cues[i].start >= timeline.cues[i - 1].end - 1e-6);
    assert.ok(timeline.cues[i].end > timeline.cues[i].start);
    assert.ok(timeline.cues[i].lines.length >= 1 && timeline.cues[i].lines.length <= 2);
    for (const line of timeline.cues[i].lines) assert.ok(line.length <= 46, line);
  }
  for (const voice of voices) {
    const text = timeline.cues.filter((cue) => cue.id === voice.id).map((cue) => cue.lines.join(" ")).join(" ");
    assert.equal(text, voice.text);
  }
  const at = masterAt(timeline);
  const quiet = at(0.4);
  assert.equal(quiet.subtitle, null);
  assert.deepEqual(quiet.overlays, []);
  const spoken = at(timeline.cues[0].start + 0.05);
  assert.ok(spoken.subtitle.length >= 1);
  assert.deepEqual(spoken.overlays, []);
  const s06 = timeline.scenes[6];
  const bend = at(s06.start + 0.5);
  assert.equal(bend.scene, "bend");
  assert.deepEqual(bend.overlays, ["Не определено"]);
  assert.equal(bend.cars.blueAlong, 0);
  assert.equal(bend.cars.redAlong, 0);
  const frame = buildFrame(bend);
  assert.equal(frame.shapes.some((shape) => shape.text === "Не определено"), true);
  assert.equal(frame.shapes.some((shape) => shape.role === "subtitle"), false);
  const during = at(timeline.cues.find((cue) => cue.id === "S06.1").start + 0.05);
  const speech = buildFrame(during);
  assert.equal(speech.shapes.some((shape) => shape.role === "subtitle"), true);
  assert.equal(speech.shapes.some((shape) => shape.text === "Не определено"), true);
  const chip = speech.shapes.find((shape) => shape.text === "Не определено").y;
  const sub = speech.shapes.find((shape) => shape.role === "subtitle" && shape.op === "text").y;
  assert.ok(sub > chip + 200);
});

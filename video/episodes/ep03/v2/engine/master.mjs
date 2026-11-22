/**
 * Сведение речи ep03/v2 с картинкой.
 * Тайминг берётся из длины файлов фраз, не из estimate_s.
 * Перед каждой сценой короткая немая картинка, затем речь и субтитр.
 * Плашки, которые повторяют диктора, в мастер не попадают.
 * На S06 остаётся «Не определено»: решатель изгиб главной не раскладывает.
 *
 *   node video/episodes/ep03/v2/engine/master.mjs --write
 *   node video/episodes/ep03/v2/engine/master.mjs --mux --video silent.mp4 --out render/final/ep03-v2-review.mp4
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ease, film, filmParts } from "./stories.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const v2 = path.resolve(here, "..");
export const LEAD = 1.6;
export const TAIL = 1.4;
export const LINE = 46;
const POSE = [8, 4, 3, 4, 6, 6, 2, 2, 2.4, 1, 1, 0];

export function subtitlePieces(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= LINE) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const pieces = [];
  for (let i = 0; i < lines.length; i += 2) pieces.push(lines.slice(i, i + 2));
  return pieces;
}

function stamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(milli).padStart(3, "0")}`;
}

export function toSrt(cues) {
  return cues.map((cue, index) => {
    const body = cue.lines.join("\n");
    return `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${body}\n`;
  }).join("\n");
}

export function flattenVoices(scenario) {
  const rows = [];
  scenario.scenes.forEach((scene, sceneIndex) => {
    scene.voice.forEach((text, index) => {
      rows.push({ id: `${scene.id}.${index + 1}`, sceneId: scene.id, sceneIndex, text });
    });
  });
  return rows;
}

export function buildTimeline(voices, durations) {
  if (voices.length !== durations.length) throw new Error("duration count");
  const parts = filmParts();
  if (parts.length !== 12) throw new Error("scene count");
  let clock = 0;
  let voiceCursor = 0;
  const scenes = [];
  const cues = [];
  for (let index = 0; index < parts.length; index++) {
    const sceneVoices = voices.filter((row) => row.sceneIndex === index);
    const start = clock;
    let cursor = clock + LEAD;
    for (const row of sceneVoices) {
      const seconds = durations[voiceCursor++];
      const pieces = subtitlePieces(row.text);
      const weight = pieces.reduce((sum, piece) => sum + piece.join(" ").length, 0);
      const phraseStart = cursor;
      pieces.forEach((lines, pieceIndex) => {
        const share = lines.join(" ").length / weight;
        const dur = pieceIndex === pieces.length - 1 ? phraseStart + seconds - cursor : seconds * share;
        cues.push({
          id: row.id,
          piece: pieceIndex + 1,
          lines,
          start: cursor,
          end: cursor + dur,
        });
        cursor += dur;
      });
    }
    const end = cursor + TAIL;
    scenes.push({
      id: voices.find((row) => row.sceneIndex === index)?.sceneId ?? `S${String(index).padStart(2, "0")}`,
      index,
      start,
      end,
      lead: LEAD,
      tail: TAIL,
      oldDur: parts[index].dur,
      pose: Math.min(POSE[index], parts[index].dur),
    });
    clock = end;
  }
  if (voiceCursor !== voices.length) throw new Error("voice cursor");
  return { fps: 24, lead: LEAD, tail: TAIL, duration: clock, scenes, cues };
}

function visualLocal(scene, sceneLocal) {
  const spoken = scene.end - scene.start - scene.lead - scene.tail;
  if (sceneLocal <= scene.lead) return scene.pose;
  if (sceneLocal >= scene.lead + spoken) return scene.oldDur;
  const u = spoken <= 0 ? 1 : (sceneLocal - scene.lead) / spoken;
  return scene.pose + (scene.oldDur - scene.pose) * ease(u);
}

export function masterAt(timeline) {
  const parts = filmParts();
  return (time) => {
    const scene = timeline.scenes.find((item) => time < item.end) ?? timeline.scenes.at(-1);
    const frame = parts[scene.index].at(visualLocal(scene, time - scene.start), scene.oldDur);
    const cue = timeline.cues.find((item) => time >= item.start && time < item.end);
    const bend = frame.scene === "bend";
    return {
      ...frame,
      overlays: bend ? ["Не определено"] : [],
      subtitle: cue ? cue.lines : null,
      diagramProse: frame.scene === "stoppark" ? false : true,
      t: visualLocal(scene, time - scene.start),
    };
  };
}

export function reviewStory(timeline) {
  return {
    id: "ep03-v2-review",
    fps: timeline.fps,
    duration: timeline.duration,
    at: masterAt(timeline),
    stills: timeline.scenes.map((scene) => ({ name: scene.id, t: scene.start + 0.8 })),
  };
}

function probe(file) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "json", file,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe ${file}`);
  return Number(JSON.parse(result.stdout).format.duration);
}

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg ${args.join(" ")}`);
}

function loadSources() {
  const scenario = JSON.parse(readFileSync(path.join(v2, "scenario.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(path.join(v2, "voice/manifest.json"), "utf8"));
  const voices = flattenVoices(scenario);
  if (voices.length !== manifest.phrases.length) throw new Error("phrase count");
  voices.forEach((row, index) => {
    if (row.id !== manifest.phrases[index].id) throw new Error(`phrase id ${row.id}`);
  });
  return { scenario, manifest, voices };
}

function decodePhrases(voices, manifest, dir) {
  mkdirSync(dir, { recursive: true });
  return voices.map((row, index) => {
    const phrase = manifest.phrases[index];
    const src = path.join(v2, "voice/cache", phrase.name);
    const wav = path.join(dir, `${row.id}.wav`);
    ffmpeg(["-i", src, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    return { ...row, wav, seconds: probe(wav), voice: phrase.voice, rate: phrase.rate, pitch: phrase.pitch, edgeTts: phrase.version };
  });
}

function silence(file, seconds) {
  ffmpeg([
    "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
    "-t", seconds.toFixed(3), "-c:a", "pcm_s16le", file,
  ]);
}

export function writeTimeline() {
  const work = "/tmp/ep03v2/review";
  mkdirSync(work, { recursive: true });
  const { manifest, voices } = loadSources();
  const decoded = decodePhrases(voices, manifest, path.join(work, "phrases"));
  const timeline = buildTimeline(decoded, decoded.map((row) => row.seconds));
  timeline.audio = {
    voice: decoded[0].voice,
    rate: decoded[0].rate,
    pitch: decoded[0].pitch,
    edgeTts: decoded[0].edgeTts,
    sampleRate: 24000,
    music: null,
  };
  timeline.phrases = decoded.map((row) => ({ id: row.id, seconds: row.seconds }));
  const lead = path.join(work, "lead.wav");
  const tail = path.join(work, "tail.wav");
  silence(lead, LEAD);
  silence(tail, TAIL);
  const list = [];
  for (const scene of timeline.scenes) {
    list.push(`file '${lead}'`);
    for (const phrase of decoded.filter((row) => row.sceneId === scene.id)) {
      list.push(`file '${phrase.wav}'`);
    }
    list.push(`file '${tail}'`);
  }
  const listFile = path.join(work, "concat.txt");
  const voice = path.join(work, "voice.wav");
  writeFileSync(listFile, `${list.join("\n")}\n`);
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", voice]);
  timeline.voiceWav = voice;
  timeline.measuredAudio = probe(voice);
  const outDir = path.join(v2, "render");
  mkdirSync(path.join(outDir, "final"), { recursive: true });
  const session = { voiceWav: voice, measuredAudio: timeline.measuredAudio };
  writeFileSync(path.join(work, "session.json"), JSON.stringify(session));
  const portable = { ...timeline };
  delete portable.voiceWav;
  writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(portable, null, 2));
  writeFileSync(path.join(outDir, "final/ep03-v2-review.srt"), toSrt(timeline.cues));
  process.stderr.write(`timeline ${timeline.duration.toFixed(3)}s audio ${timeline.measuredAudio.toFixed(3)}s cues ${timeline.cues.length}\n`);
  return timeline;
}

export function loadTimeline() {
  return JSON.parse(readFileSync(path.join(v2, "render/timeline.json"), "utf8"));
}

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function mux() {
  const video = arg("video");
  const out = arg("out") ?? path.join(v2, "render/final/ep03-v2-review.mp4");
  const session = JSON.parse(readFileSync("/tmp/ep03v2/review/session.json", "utf8"));
  if (!existsSync(session.voiceWav)) throw new Error("voice wav missing; run --write on this machine");
  const videoDur = probe(video);
  mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg([
    "-i", video, "-i", session.voiceWav,
    "-filter:a", `apad=whole_dur=${videoDur.toFixed(3)},atrim=0:${videoDur.toFixed(3)}`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    "-movflags", "+faststart", out,
  ]);
  process.stderr.write(`muxed ${out}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) writeTimeline();
  else if (process.argv.includes("--mux")) mux();
  else if (process.argv.includes("--duration")) process.stdout.write(`${film().duration}\n`);
}

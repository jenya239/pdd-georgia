/**
 * Машинные проверки сведённого ролика. Печатает JSON и завершается с 1 при провале.
 *   node video/episodes/ep03/v2/engine/review-checks.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenVoices } from "./master.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const v2 = path.resolve(here, "..");
const video = path.join(v2, "render/final/ep03-v2-review.mp4");
const srtPath = path.join(v2, "render/final/ep03-v2-review.srt");
const timeline = JSON.parse(readFileSync(path.join(v2, "render/timeline.json"), "utf8"));
const scenario = JSON.parse(readFileSync(path.join(v2, "scenario.json"), "utf8"));
const failures = [];

function fail(name, detail) {
  failures.push({ name, detail });
}

function ffprobe() {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
    "-of", "json", video,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "ffprobe");
  return JSON.parse(result.stdout);
}

function detect(filter) {
  const result = spawnSync("ffmpeg", [
    "-i", video, "-filter:v", filter, "-f", "null", "-",
  ], { encoding: "utf8" });
  return `${result.stderr || ""}\n${result.stdout || ""}`;
}

function parseSrt(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const index = Number(lines[0]);
    const [start, end] = lines[1].split(" --> ").map(parseStamp);
    return { index, start, end, lines: lines.slice(2) };
  });
}

function parseStamp(value) {
  const [h, m, rest] = value.split(":");
  const [s, ms] = rest.split(",");
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

const probe = ffprobe();
const streams = probe.streams;
const videoStream = streams.find((item) => item.codec_type === "video");
const audioStream = streams.find((item) => item.codec_type === "audio");
const duration = Number(probe.format.duration);
if (!videoStream || videoStream.codec_name !== "h264" || videoStream.width !== 1920 || videoStream.height !== 1080) {
  fail("picture", videoStream);
}
if (videoStream?.avg_frame_rate !== "24/1") fail("fps", videoStream?.avg_frame_rate);
if (!audioStream || audioStream.codec_name !== "aac") fail("audio-codec", audioStream);
if (Math.abs(duration - timeline.duration) > 0.08) fail("duration", { duration, planned: timeline.duration });
if (Math.abs(duration - timeline.measuredAudio) > 0.08) fail("audio-sync", { duration, measured: timeline.measuredAudio });

const voices = flattenVoices(scenario);
if (voices.length !== 29) fail("phrase-count", voices.length);
for (const voice of voices) {
  const text = timeline.cues.filter((cue) => cue.id === voice.id).map((cue) => cue.lines.join(" ")).join(" ");
  if (text !== voice.text) fail("missing-vo", voice.id);
}
if (timeline.cues.some((cue, i) => i > 0 && cue.start < timeline.cues[i - 1].end - 0.02)) fail("overlap", true);
if (timeline.cues.some((cue) => cue.end <= cue.start)) fail("negative-cue", true);

const srt = parseSrt(readFileSync(srtPath, "utf8"));
if (srt.length !== timeline.cues.length) fail("srt-count", { srt: srt.length, cues: timeline.cues.length });
srt.forEach((cue, i) => {
  if (cue.index !== i + 1) fail("srt-index", cue.index);
  const planned = timeline.cues[i];
  if (Math.abs(cue.start - planned.start) > 0.02 || Math.abs(cue.end - planned.end) > 0.02) {
    fail("srt-sync", { i, cue, planned });
  }
  if (cue.lines.join("\n") !== planned.lines.join("\n")) fail("srt-text", i);
});

const black = detect("blackdetect=d=0.1:pix_th=0.10");
if (/black_start/.test(black)) fail("black", black.slice(-500));
const silence = spawnSync("ffmpeg", [
  "-i", video, "-af", "silencedetect=noise=-40dB:d=3.2", "-f", "null", "-",
], { encoding: "utf8" });
const silenceLog = silence.stderr || "";
const gaps = [...silenceLog.matchAll(/silence_duration:\s*([0-9.]+)/g)].map((item) => Number(item[1]));
const longGaps = gaps.filter((item) => item > 6);
if (longGaps.length) fail("long-silence", longGaps);
if (gaps.length !== 11) fail("scene-breaths", gaps.length);
const volume = spawnSync("ffmpeg", [
  "-i", video, "-af", "volumedetect", "-f", "null", "-",
], { encoding: "utf8" });
const volumeLog = volume.stderr || "";
const mean = Number((volumeLog.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/) || [])[1]);
const max = Number((volumeLog.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/) || [])[1]);
if (!(mean < -12 && mean > -32)) fail("mean-volume", mean);
if (!(max > -12)) fail("max-volume", max);

const report = {
  file: "video/episodes/ep03/v2/render/final/ep03-v2-review.mp4",
  duration,
  planned: timeline.duration,
  measuredAudio: timeline.measuredAudio,
  video: videoStream,
  audio: audioStream,
  phrases: voices.length,
  cues: timeline.cues.length,
  meanVolumeDb: mean,
  maxVolumeDb: max,
  sceneBreaths: gaps.length,
  longestBreath: gaps.length ? Math.max(...gaps) : 0,
  music: null,
  failures,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(failures.length ? 1 : 0);

/**
 * Черновая читка ep03/v2 без картинки. Ключей нет: Microsoft Edge TTS через
 * установленный пакет edge-tts.
 *
 * Рабочая команда (проверена на edge-tts 7.3.1, без ключа):
 *
 *   python3 -m pip install --user 'edge-tts==7.3.1'
 *   node video/episodes/ep03/v2/voice/speak.mjs
 *
 * Нужны Node 24, ffmpeg и сеть до speech.platform.bing.com.
 * Другой интерпретатор: EP03_TTS_PYTHON=/path/to/python.
 *
 * На 7.3.1 ru-RU-DmitryNeural с rate +10% отвечает NoAudioReceived
 * (и с pitch -4Hz, и с +0Hz). Тот же голос с rate +0% и pitch -4Hz звучит.
 * Поэтому первая попытка — ru-RU-SvetlanaNeural, rate +10%, pitch -4Hz:
 * темп и высота как у диктора ep01–ep08. Запасной пресет — Dmitry +0%/-4Hz.
 * Пауза между попытками одной фразы: 5, 10, … 60 секунд, не больше 20.
 * Фразы идут по одной. Кеш: sha256(voice + версия + rate + pitch + text),
 * файл короче 1001 байта отбрасывается.
 *
 * edge-tts 6.1.12 и 7.2.8 с этой машины получают 403 на рукопожатии
 * (устаревший TrustedClientToken) и звук не отдают. Их этой командой не ставить.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync, renameSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scenario = JSON.parse(readFileSync(path.join(here, "../scenario.json"), "utf8"));
const python = process.env.EP03_TTS_PYTHON || "python3";
const presets = [
  { voice: "ru-RU-SvetlanaNeural", rate: "+10%", pitch: "-4Hz" },
  { voice: "ru-RU-DmitryNeural", rate: "+0%", pitch: "-4Hz" },
];
const cacheDir = path.join(here, "cache");
const minBytes = 1000;
const attempts = 20;

function phrases() {
  const rows = [];
  for (const scene of scenario.scenes) {
    scene.voice.forEach((text, index) => {
      rows.push({ id: `${scene.id}.${index + 1}`, text });
    });
  }
  return rows;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error((err || out || `exit ${code}`).trim().slice(-500)));
    });
  });
}

async function edgeVersion() {
  const text = await run(["-m", "edge_tts", "--version"]);
  const match = text.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : text || "unknown";
}

function cacheName(preset, version, text) {
  const key = JSON.stringify({ voice: preset.voice, version, rate: preset.rate, pitch: preset.pitch, text });
  return createHash("sha256").update(key).digest("hex") + ".mp3";
}

async function synthesize(phrase, preset, version) {
  const name = cacheName(preset, version, phrase.text);
  const dest = path.join(cacheDir, name);
  if (existsSync(dest) && statSync(dest).size > minBytes) {
    return { name, bytes: statSync(dest).size, cached: true, ...preset };
  }
  const textFile = path.join(cacheDir, `${name}.txt`);
  const part = path.join(cacheDir, `${name}.part`);
  writeFileSync(textFile, phrase.text);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      rmSync(part, { force: true });
      await run([
        "-m", "edge_tts", "--no-progress",
        "--voice", preset.voice,
        `--rate=${preset.rate}`,
        `--pitch=${preset.pitch}`,
        "--file", textFile, "--write-media", part,
      ]);
      const bytes = existsSync(part) ? statSync(part).size : 0;
      if (bytes <= minBytes) throw new Error(`short audio ${bytes}`);
      renameSync(part, dest);
      rmSync(textFile, { force: true });
      return { name, bytes, cached: false, ...preset };
    } catch (error) {
      rmSync(part, { force: true });
      const wait = Math.min(60, 5 * (attempt + 1));
      const line = String(error.message || error).split("\n")[0];
      process.stderr.write(`${phrase.id} ${preset.voice} ${preset.rate} ${preset.pitch} attempt ${attempt + 1}/${attempts}: ${line} ; sleep ${wait}s\n`);
      await delay(wait * 1000);
    }
  }
  rmSync(textFile, { force: true });
  return null;
}

function writeReadthroughText(rows) {
  const body = rows.map((row) => row.text).join("\n\n") + "\n";
  writeFileSync(path.join(here, "readthrough.txt"), body);
}

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  const rows = phrases();
  writeReadthroughText(rows);
  const version = await edgeVersion();
  process.stderr.write(`edge-tts ${version}; ${rows.length} phrases; presets ${presets.map((p) => `${p.voice} ${p.rate} ${p.pitch}`).join(" | ")}\n`);
  const manifest = {
    edgeTts: version,
    presets,
    minBytes,
    attempts,
    note: "ru-RU-DmitryNeural at +10% returned NoAudioReceived on edge-tts 7.3.1; Svetlana keeps the course rate and pitch.",
    phrases: [],
  };
  const list = [];
  for (const phrase of rows) {
    let done = null;
    for (const preset of presets) {
      done = await synthesize(phrase, preset, version);
      if (done) break;
    }
    if (!done) {
      writeFileSync(path.join(here, "manifest.json"), JSON.stringify(manifest, null, 2));
      throw new Error(`${phrase.id} failed after ${presets.length} presets × ${attempts} attempts`);
    }
    manifest.phrases.push({ id: phrase.id, ...done, version });
    writeFileSync(path.join(here, "manifest.json"), JSON.stringify(manifest, null, 2));
    list.push(`file '${path.join(cacheDir, done.name)}'`);
    process.stderr.write(`${phrase.id} ok ${done.voice} ${done.bytes} bytes${done.cached ? " cache" : ""}\n`);
  }
  const listFile = path.join(cacheDir, "concat.txt");
  writeFileSync(listFile, list.join("\n") + "\n");
  const out = path.join(here, "readthrough.mp3");
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", listFile,
      "-c:a", "libmp3lame", "-q:a", "5", out,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ffmpeg.stderr.on("data", (chunk) => { err += chunk; });
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-400)))));
  });
  process.stderr.write(`readthrough ${out}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});

/**
 * Render a silent ep03/v2 clip.
 *   node video/episodes/ep03/v2/engine/render-clip.mjs --story a --renderer svg --out path.mp4
 * Renderers: svg (resvg) or cpu (software raster of the same primitives).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { buildFrame } from "./frame.mjs";
import { frameToSvg } from "./svg.mjs";
import { encodePng, rasterize } from "./raster.mjs";
import { loadTimeline, reviewStory } from "./master.mjs";
import { PROTO_A, PROTO_C, film, prototypeAState, prototypeCState } from "./stories.mjs";

const FONTS = {
  fontFiles: [
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  ],
  loadSystemFonts: false,
  defaultFontFamily: "Noto Sans",
};

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function storyByName(name) {
  if (name === "a") return { ...PROTO_A, at: prototypeAState };
  if (name === "c") return { ...PROTO_C, at: prototypeCState };
  if (name === "film") return { id: "S00-S11", ...film(), stills: filmStills() };
  if (name === "review") {
    const file = arg("timeline", "");
    return reviewStory(loadTimeline(file || undefined));
  }
  throw new Error(`unknown story ${name}`);
}

function filmStills() {
  const piece = film();
  const marks = [0.8, 20, 40, 62, 86, 110, 128, 146, 164, 186, 204];
  return marks.filter((t) => t < piece.duration - 0.2).map((t, i) => ({ name: `film-${String(i).padStart(2, "0")}`, t }));
}

function pngOf(frame, renderer) {
  if (renderer === "cpu") return encodePng(frame.width, frame.height, rasterize(frame));
  const svg = frameToSvg(frame);
  const image = new Resvg(svg, { font: FONTS }).render();
  return image.asPng();
}

function diffCount(a, b) {
  const left = new Resvg(frameToSvg(a), { font: FONTS }).render();
  const right = new Resvg(frameToSvg(b), { font: FONTS }).render();
  const pa = left.pixels;
  const pb = right.pixels;
  if (pa.length !== pb.length) return { pixels: -1, width: left.width, height: left.height };
  let pixels = 0;
  for (let i = 0; i < pa.length; i += 4) {
    if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) pixels += 1;
  }
  return { pixels, width: left.width, height: left.height };
}

function encode(out, fps) {
  const child = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "pipe"] });
  let error = "";
  child.stderr.on("data", (chunk) => { error += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(error || `ffmpeg ${code}`))));
  });
  return { stdin: child.stdin, done };
}

async function main() {
  const name = arg("story", "a");
  const renderer = arg("renderer", "svg");
  const out = arg("out", `video/episodes/ep03/v2/design/prototypes/${name}-${renderer}.mp4`);
  const story = storyByName(name);
  const fps = Number(arg("fps", story.fps));
  const frames = Math.round(story.duration * fps);
  const start = Number(arg("start", "0"));
  const count = Number(arg("count", String(frames - start)));
  const end = Math.min(frames, start + count);
  mkdirSync(dirname(out), { recursive: true });
  const stillDir = join(dirname(out), `${story.id}-stills-${renderer}`);
  mkdirSync(stillDir, { recursive: true });
  const wanted = new Map(story.stills.map((still) => [Math.round(still.t * fps), still.name]));
  const encoder = encode(out, fps);
  const started = Date.now();
  for (let index = start; index < end; index++) {
    const frame = buildFrame(story.at(index / fps));
    const png = pngOf(frame, renderer);
    if (wanted.has(index)) writeFileSync(join(stillDir, `${wanted.get(index)}.png`), png);
    if (!encoder.stdin.write(png)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (index % fps === 0) process.stderr.write(`\r${name}/${renderer} ${index}/${frames}`);
  }
  encoder.stdin.end();
  await encoder.done;
  process.stderr.write(`\n${out} ${(end - start) / fps}s ${end - start} frames in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  if (name === "a" && renderer === "svg" && start === 0 && end === frames) {
    const before = buildFrame({ ...prototypeAState(1), layers: "cars" });
    const after = buildFrame({ ...prototypeAState(11), layers: "cars" });
    const diff = diffCount(before, after);
    const report = { ...diff, tBefore: 1, tAfter: 11, note: "isolated car layer, cars at the start pose" };
    writeFileSync(join(dirname(out), "A2-A3-vehicle-diff.json"), JSON.stringify(report, null, 2));
    process.stderr.write(`vehicle layer diff pixels: ${diff.pixels}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});

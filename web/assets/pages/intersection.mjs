/** Page script: intersection.html. One junction, two cars, a checked solver. */
import { esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { KEYS } from "../domain/registry.mjs";
import { leadFor, followUp } from "../intersection/counterfactual.mjs";
import { bugReport, generate } from "../intersection/generate.mjs";
import { ROAD_HALF, VEHICLE_LENGTH, VEHICLE_WIDTH, forward, pathOf, pointAlong, rightVec } from "../intersection/geometry.mjs";
import { MANEUVER_WORD } from "../intersection/model.mjs";
import { advancePause, historyCursor } from "../intersection/playback.mjs";
import {
  PALETTES, VIEW, carColor, creep, ease, frame, hotspots, labelPx, motionMs, signAnchors, styleName, toCanvas, treeSpots, waitingSample,
} from "../intersection/picture.mjs";
import { parseProgress, recordProgress, rememberSituation, situationSummary } from "../intersection/progress.mjs";
import { openSession, reduce } from "../intersection/session.mjs";
import { primaryConcept } from "../intersection/solver.mjs";

const STANDING = "Схема помогает разобраться, кто кому уступает. Она не учитывает скорость, обзор и другие опасности реальной дороги. В спорных ситуациях тренажёр не угадывает ответ.";
const CONCEPT = {
  right: "помеха справа",
  left: "левый поворот и встречный",
  main: "главная и второстепенная",
  fallback: "общее правило о правой стороне",
  "clear-right": "пути не сходятся, помеха справа не сработала",
  "clear-main": "пути не сходятся, главная не мешает",
  "clear-left": "левый поворот никого не пересёк",
  clear: "пути не мешают",
};

let host = null;
let embed = false;
let seed = 1;
let style = "soft";
let progress = null;
let task = null;
let session = null;
let followMeta = null;
let missedId = null;
let recorded = false;
let nextAction = null;
let steps = [];
let pastSummary = null;
let reviewing = false;
let reviewEntry = null;
let cursor = 0;
let liveSnap = null;
let advanceTimer = 0;
let token = 0;
let motion = null;
let stage = null;
let canvas = null;
let ctx = null;
let motionQuery = null;

function q(id) {
  return host.querySelector("#" + id);
}

/** Controls shared by the standalone page and the episode 3 exercise. */
export function trainerShell({ embed: embedded = false } = {}) {
  const scope = embedded
    ? "Пока здесь два автомобиля на равнозначных дорогах или на прямой главной. Остальные ситуации третьего выпуска разбираются в тексте."
    : "Пока доступны простые перекрёстки: два автомобиля, одна полоса, равнозначные дороги или прямая главная. Остальные ситуации появятся после проверки правил.";
  return `<p class="ix-mobile-prompt">Выбери автомобиль, который может проехать.</p>
<div class="ix-layout">
  <div class="ix-stage" id="ix-scene">
    <canvas id="board" aria-hidden="true"></canvas>
    <div id="hits"></div>
    <div id="ix-flash" class="ix-flash" hidden aria-hidden="true"></div>
  </div>
  <div class="ix-panel">
    <h3 class="ix-question" id="ix-question">Кто может проехать сейчас?</h3>
    <p class="ix-help" id="ix-help">Нажми на машину или клавишу с её номером.</p>
    <div class="ix-history" role="group" aria-label="История ситуаций">
      <button type="button" class="btn ghost" id="hist-back">Назад</button>
      <span id="hist-pos"></span>
      <button type="button" class="btn ghost" id="hist-forward">Вперёд</button>
    </div>
    <p id="past" class="ix-past" hidden></p>
    <p id="lead" class="ix-lead" hidden></p>
    <div id="explain" class="ix-explain"></div>
    <button type="button" class="btn ix-next" id="next" hidden>Следующая ситуация</button>
  </div>
</div>
<p id="live" class="sr" aria-live="polite" aria-atomic="true"></p>
<details class="ix-details">
  <summary>Настройки и подробности</summary>
  <p>${scope}</p>
  <p id="assume" class="small mut"></p>
  <div class="ix-styles" role="group" aria-label="Оформление">
    <button type="button" data-style="soft">Мягкий</button>
    <button type="button" data-style="ink">Контрастный</button>
  </div>
  <details class="ix-note"><summary>Пройденные правила</summary><p id="concepts" class="small"></p></details>
  <button type="button" class="btn ghost" id="bug">Данные для сообщения об ошибке</button>
  <pre id="report" hidden tabindex="0"></pre>
</details>`;
}
/** Draw one checked scene into a container that already holds trainerShell(). */
export function mountIntersection(root, options = {}) {
  host = root;
  embed = options.embed === true;
  const params = new URLSearchParams(location.search);
  seed = Number(params.get("seed"));
  if (!Number.isInteger(seed)) seed = 1;
  style = styleName(params.get("style"));
  progress = loadProgress();
  stage = q("ix-scene");
  canvas = q("board");
  ctx = canvas.getContext("2d");
  motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  q("bug").addEventListener("click", () => {
    const report = q("report");
    report.hidden = false;
    report.textContent = `Скопируйте текст. В нём нет имени и истории ответов.\n${JSON.stringify(bugReport(session.scenario), null, 2)}`;
  });
  q("next").addEventListener("click", () => {
    cancelAdvance();
    goNext();
  });
  q("hist-back").addEventListener("click", goBack);
  q("hist-forward").addEventListener("click", goForward);
  for (const button of host.querySelectorAll("[data-style]")) {
    button.addEventListener("click", () => setStyle(button.dataset.style));
  }
  document.addEventListener("keydown", (event) => {
    if (!ownsKeys(event)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter" && nextAction && !reviewing) {
      event.preventDefault();
      cancelAdvance();
      goNext();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const field = event.target;
      if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement || field instanceof HTMLSelectElement) return;
      const moved = event.key === "ArrowLeft" ? goBack() : goForward();
      if (moved) event.preventDefault();
      return;
    }
    if (!/^[1-9]$/.test(event.key)) return;
    const target = event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    const vehicle = task?.vehicles.find((item) => item.id === event.key);
    if (vehicle) choose(vehicle.id);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !motion) return;
    if (performance.now() - motion.start >= motion.ms) finishMotion();
    else requestAnimationFrame(tick);
  });
  motionQuery.addEventListener("change", () => paint());
  new ResizeObserver(() => {
    paint();
    placeHits();
  }).observe(stage);
  begin(generate(seed).scenario, seed, null);
}

function ownsKeys(event) {
  const target = event.target;
  if (target instanceof Element && host.contains(target)) return true;
  if (!embed) return true;
  const box = host.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return false;
  const mid = window.innerHeight / 2;
  return box.top < mid && box.bottom > mid;
}

function rememberUrl(edit) {
  if (embed) return;
  const url = new URL(location.href);
  edit(url);
  history.replaceState(null, "", url);
}

function begin(scenario, nextSeed, meta) {
  cancelAdvance();
  seed = nextSeed;
  task = scenario;
  session = openSession(scenario);
  followMeta = meta;
  missedId = null;
  recorded = false;
  motion = null;
  nextAction = null;
  steps = [];
  reviewing = false;
  reviewEntry = null;
  pastSummary = situationSummary(progress.history.at(-1));
  rememberUrl((url) => url.searchParams.set("seed", String(seed)));
  render();
}

function choose(id) {
  if (reviewing || motion) return;
  const next = reduce(session, { type: "select", id });
  if (next === session) return;
  pastSummary = null;
  session = next;
  if (session.explanation) {
    steps.push({
      vehicleId: id,
      correct: session.outcome === "go",
      text: session.explanation.text,
      norms: session.explanation.norms,
      highlight: session.explanation.highlight,
    });
  }
  if (session.outcome === "stop" && missedId == null) missedId = id;
  const vehicle = task.vehicles.find((item) => item.id === id);
  token += 1;
  motion = {
    token,
    id,
    outcome: session.outcome,
    samples: pathOf(vehicle.from, vehicle.maneuver),
    start: performance.now(),
    ms: motionMs(session.outcome, motionQuery.matches),
  };
  render();
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!motion) return;
  const t = motion.ms === 0 ? 1 : Math.min(1, (now - motion.start) / motion.ms);
  paint();
  if (t < 1) requestAnimationFrame(tick);
  else finishMotion();
}

function finishMotion() {
  if (!motion) return;
  motion = null;
  session = reduce(session, { type: "anim-done" });
  if (session.phase === "done" && !recorded) {
    recorded = true;
    onDone();
  }
  render();
}

function onDone() {
  progress = recordProgress(progress, primaryConcept(session.opening), !session.firstTryWrong);
  if (steps.length) progress = rememberSituation(progress, { scenario: task, steps });
  saveProgress();
  const nextSeed = seed + 1;
  if (followMeta) {
    armAuto("Следующая ситуация", () => begin(generate(nextSeed).scenario, nextSeed, null));
    return;
  }
  if (session.firstTryWrong && missedId) {
    const pair = followUp(session.scenario, missedId);
    if (pair) {
      const scenario = { ...pair.after, id: "ix-after-" + seed + "-" + missedId, seed };
      armAuto("Сравнить ситуацию", () => begin(scenario, seed, { why: pair.why, lead: leadFor(pair.delta) }));
      return;
    }
  }
  armAuto("Следующая ситуация", () => begin(generate(nextSeed).scenario, nextSeed, null));
}

function armAuto(label, fn) {
  nextAction = fn;
  const button = q("next");
  button.hidden = false;
  button.textContent = label;
  cancelAdvance();
  advanceTimer = setTimeout(() => {
    advanceTimer = 0;
    goNext();
  }, advancePause(motionQuery.matches));
}

function cancelAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = 0;
}

function goNext() {
  if (reviewing) return;
  const fn = nextAction;
  if (!fn) return;
  nextAction = null;
  fn();
}

function goBack() {
  if (motion || !progress.history.length) return false;
  const from = reviewing ? cursor : progress.history.length;
  const next = historyCursor(from, progress.history.length, -1);
  if (next === from) return false;
  if (!reviewing) liveSnap = snapshotLive();
  cancelAdvance();
  openReview(next);
  return true;
}

function goForward() {
  if (motion || !reviewing) return false;
  const next = historyCursor(cursor, progress.history.length, 1);
  if (next === cursor) return false;
  if (next === progress.history.length) returnLive();
  else openReview(next);
  return true;
}

function snapshotLive() {
  return {
    task, session, seed, followMeta, missedId, recorded,
    steps: steps.slice(), nextAction, pastSummary,
  };
}

function openReview(index) {
  reviewing = true;
  cursor = index;
  reviewEntry = progress.history[index];
  task = reviewEntry.scenario;
  motion = null;
  render();
}

function returnLive() {
  const snap = liveSnap;
  reviewing = false;
  reviewEntry = null;
  task = snap.task;
  session = snap.session;
  seed = snap.seed;
  followMeta = snap.followMeta;
  missedId = snap.missedId;
  recorded = snap.recorded;
  steps = snap.steps;
  nextAction = snap.nextAction;
  pastSummary = snap.pastSummary;
  motion = null;
  render();
}
function setStyle(next) {
  style = styleName(next);
  rememberUrl((url) => {
    if (style === "soft") url.searchParams.delete("style");
    else url.searchParams.set("style", style);
  });
  paint();
  markStyles();
}

function render() {
  paint();
  placeHits();
  markStyles();
  const lead = q("lead");
  lead.hidden = reviewing || !(followMeta && session.phase !== "done");
  if (!lead.hidden) lead.textContent = followMeta.lead;
  const explanation = shownExplanation();
  const past = q("past");
  const showPast = pastVisible();
  past.hidden = !showPast;
  if (showPast) past.innerHTML = pastHtml(pastSummary);
  if (reviewing) {
    q("ix-question").textContent = "Сохранённая ситуация";
    q("ix-help").textContent = "Это уже решённая сцена: видны ответ и разбор. Новый ход не записывается.";
    const last = reviewEntry.steps.at(-1);
    showHtml(reviewHtml(reviewEntry), last.correct ? "ok" : "bad");
  } else {
    q("ix-help").textContent = "Нажми на машину или клавишу с её номером.";
    q("ix-question").textContent = session.remaining.length === 1
      ? "Кто может ехать следующим?" : "Кто может проехать сейчас?";
    if (explanation) showHtml(explanationHtml(explanation), explanation.tone === "ok" ? "ok" : "bad");
    else clearExplain();
  }
  q("assume").textContent = STANDING;
  q("next").hidden = reviewing || !nextAction;
  const total = progress.history.length;
  q("hist-back").disabled = total === 0 || (reviewing && cursor === 0);
  q("hist-forward").disabled = !reviewing;
  q("hist-pos").textContent = !total ? "" : reviewing ? `${cursor + 1} из ${total}` : "сейчас";
  const flash = q("ix-flash");
  if (reviewing) {
    flash.textContent = "Просмотр";
    flash.className = "ix-flash is-ok";
    flash.hidden = false;
  } else if (explanation && explanation.tone !== "ok") {
    const first = explanation.highlight.yieldTo[0];
    const cause = explanation.decisive === "автомобиль справа" ? ": он справа"
      : explanation.decisive === "знак главной дороги" ? ": он на главной"
      : explanation.decisive === "встречное направление" ? ": встречный" : "";
    flash.textContent = first ? "Сначала автомобиль " + first + cause : "Нет однозначного первого";
    flash.className = "ix-flash is-error";
    flash.hidden = false;
  } else if (session.phase === "moving" && session.outcome === "go") {
    flash.textContent = "Верно";
    flash.className = "ix-flash is-ok";
    flash.hidden = false;
  } else if (session.phase === "done") {
    flash.textContent = "Все проехали";
    flash.className = "ix-flash is-ok";
    flash.hidden = false;
  } else {
    flash.hidden = true;
  }
  if (reviewing) announce(reviewSpeech(reviewEntry));
  else if (showPast) announce(`По прошлой задаче. ${pastSummary.text}`);
  else announce(liveText(explanation));
  renderProgress();
  stage.dataset.phase = reviewing ? "review" : session.phase;
  stage.dataset.task = task.id;
}
function shownExplanation() {
  if (reviewing) return reviewMark();
  return session?.explanation ?? null;
}

function pastVisible() {
  return !reviewing && pastSummary && session.phase === "ready" && !motion && steps.length === 0;
}

function reviewMark() {
  const step = [...reviewEntry.steps].reverse().find((item) => item.highlight.yieldTo.length > 0)
    || reviewEntry.steps[reviewEntry.steps.length - 1];
  return {
    text: step.text,
    tone: step.correct ? "ok" : "bad",
    norms: step.norms,
    assumption: "",
    decisive: "",
    highlight: step.highlight,
  };
}

function reviewHtml(entry) {
  return entry.steps.map((step) => {
    const verdict = step.correct ? "верно" : "неверно";
    const links = normLinks(step.norms);
    return `<p>Автомобиль ${esc(step.vehicleId)} — ${verdict}. ${esc(step.text)}</p>${links}`;
  }).join("");
}

function reviewSpeech(entry) {
  return entry.steps.map((step) =>
    `Автомобиль ${step.vehicleId}, ${step.correct ? "верно" : "неверно"}. ${step.text}`).join(" ");
}

function pastHtml(step) {
  return `<p>По прошлой задаче. ${esc(step.text)}</p>${normLinks(step.norms)}`;
}

function normLinks(norms) {
  const links = (norms || []).map((norm) =>
    `<a class="nref" data-norm="${esc(norm.id)}" href="norm/${esc(norm.id)}.html">${esc(norm.label)}</a>`).join(" · ");
  return links ? `<p class="small">${links}</p>` : "";
}

function liveText(explanation) {
  if (explanation) return explanation.text;
  if (followMeta && session.phase !== "done") return followMeta.lead;
  if (session.phase === "moving" && session.outcome === "go") return `Автомобиль ${session.actor} поехал.`;
  if (session.phase === "done") return q("explain").textContent || "Сцена пройдена.";
  if (session.phase === "blocked") return "Эта сцена вне проверенного среза.";
  return "Выберите автомобиль, который может ехать сейчас.";
}

function explanationHtml(explanation) {
  return `<p>${esc(explanation.text)}</p>${normLinks(explanation.norms)}`;
}

function showHtml(html, kind) {
  const box = q("explain");
  box.className = `ix-explain ${kind}`;
  box.innerHTML = html;
}

function clearExplain() {
  const box = q("explain");
  box.className = "ix-explain";
  box.textContent = "";
}

function announce(text) {
  const live = q("live");
  if (live.textContent !== text) live.textContent = text;
}

function renderProgress() {
  const rows = Object.entries(progress.concepts);
  const box = q("concepts");
  if (!rows.length) {
    box.textContent = "Здесь появится история разобранных правил.";
    return;
  }
  box.textContent = rows.map(([id, count]) => {
    const name = CONCEPT[id] || id;
    return `${name}: ${count.seen} задач, ${count.firstTry} без ошибок`;
  }).join(". ") + ".";
}

function markStyles() {
  for (const button of host.querySelectorAll("[data-style]")) {
    button.setAttribute("aria-pressed", String(button.dataset.style === style));
  }
}

function placeHits() {
  if (!task || !session) return;
  const { width, height } = viewSize();
  const root = q("hits");
  root.replaceChildren();
  const active = !reviewing && (session.phase === "ready" || session.phase === "error");
  const remaining = reviewing ? task.vehicles.map((vehicle) => vehicle.id) : session.remaining;
  for (const hit of hotspots(task, width, height, remaining)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ix-hit";
    button.style.left = `${hit.x - hit.size / 2}px`;
    button.style.top = `${hit.y - hit.size / 2}px`;
    button.style.width = `${hit.size}px`;
    button.style.height = `${hit.size}px`;
    button.setAttribute("aria-label", hit.label);
    button.disabled = !active;
    button.addEventListener("click", () => choose(hit.id));
    root.append(button);
  }
}

function viewSize() {
  const rect = stage.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function paint() {
  if (!ctx || !task) return;
  const { width, height } = viewSize();
  if (width < 2 || height < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const view = frame(width, height);
  const palette = PALETTES[style];
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const P = (point) => toCanvas(point, view);
  const explanation = shownExplanation();

  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, 0, width, height);
  drawBlobs(ctx, width, height, palette.tree, task.id);
  drawRoads(ctx, P, palette, style);
  drawBuildings(ctx, P, style);
  for (const tree of treeSpots()) drawTree(ctx, P(tree), view.scale, palette.tree, style);
  drawMarkings(ctx, P, view.scale, palette.mark, palette.ink, font);
  for (const anchor of signAnchors(task)) {
    const emphasized = explanation?.highlight.signs.includes(anchor.dir);
    drawSign(ctx, P(anchor), view.scale, anchor.sign, emphasized);
  }

  const visible = task.vehicles.filter((vehicle) =>
    reviewing || session.remaining.includes(vehicle.id) || motion?.id === vehicle.id);
  for (const vehicle of visible) {
    const samples = pathOf(vehicle.from, vehicle.maneuver);
    const color = carColor(task.vehicles.indexOf(vehicle), style);
    const marked = explanation?.highlight.paths.includes(vehicle.id);
    const driving = motion?.id === vehicle.id && motion.outcome === "go";
    if (marked) strokeSamples(ctx, P, samples, 0.92, palette.yieldMark, 3.5, true);
    else if (!driving) strokeSamples(ctx, P, samples, vehicle.maneuver === "straight" ? 0.16 : 0.38, color, 2.5, false);
  }
  for (const vehicle of visible) {
    const pose = poseOf(vehicle);
    drawCar(ctx, P(pose), pose.heading, view.scale, vehicle, palette, font, explanation);
  }
}

function poseOf(vehicle) {
  if (motion && motion.id === vehicle.id) {
    const t = motion.ms === 0 ? 1 : Math.min(1, (performance.now() - motion.start) / motion.ms);
    return pointAlong(motion.samples, motion.outcome === "go" ? ease(t) : creep(t));
  }
  return waitingSample(vehicle);
}

function drawRoads(ctx, P, palette, variant) {
  const walk = ROAD_HALF + 0.08;
  ctx.fillStyle = palette.sidewalk;
  fillWorld(ctx, P, -walk, -VIEW, walk, VIEW);
  fillWorld(ctx, P, -VIEW, -walk, VIEW, walk);
  ctx.fillStyle = palette.asphalt;
  fillWorld(ctx, P, -ROAD_HALF, -VIEW, ROAD_HALF, VIEW);
  fillWorld(ctx, P, -VIEW, -ROAD_HALF, VIEW, ROAD_HALF);
  ctx.strokeStyle = variant === "ink" ? "#161c22" : "#f3eadc";
  ctx.lineWidth = variant === "ink" ? 2 : 5;
  strokeWorld(ctx, P, -ROAD_HALF, -VIEW, ROAD_HALF, VIEW);
  strokeWorld(ctx, P, -VIEW, -ROAD_HALF, VIEW, ROAD_HALF);
}

function fillWorld(ctx, P, x0, y0, x1, y1) {
  const rect = worldRect(P, x0, y0, x1, y1);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function strokeWorld(ctx, P, x0, y0, x1, y1) {
  const rect = worldRect(P, x0, y0, x1, y1);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function worldRect(P, x0, y0, x1, y1) {
  const a = P({ x: x0, y: y0 });
  const b = P({ x: x1, y: y1 });
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

function drawMarkings(ctx, P, scale, color, ink, font) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  for (const dir of ["N", "E", "S", "W"]) {
    const face = forward(dir);
    const from = P({ x: -face.x * (VIEW - 0.08), y: -face.y * (VIEW - 0.08) });
    const to = P({ x: -face.x * (ROAD_HALF + 0.04), y: -face.y * (ROAD_HALF + 0.04) });
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const right = rightVec(dir);
    const stopCenter = { x: -face.x * 0.72, y: -face.y * 0.72 };
    const stopEdge = { x: stopCenter.x + right.x * (ROAD_HALF - 0.03), y: stopCenter.y + right.y * (ROAD_HALF - 0.03) };
    ctx.setLineDash([]);
    ctx.beginPath();
    const s0 = P(stopCenter);
    const s1 = P(stopEdge);
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();
    ctx.setLineDash([8, 10]);
  }
  ctx.setLineDash([]);
  void scale;
  void ink;
  void font;
  ctx.restore();
}

function drawBuildings(ctx, P, variant) {
  const blocks = [
    { x: 0.74, y: 0.74, w: 0.38, h: 0.28 },
    { x: -1.12, y: 0.74, w: 0.38, h: 0.28 },
    { x: 0.74, y: -1.02, w: 0.38, h: 0.28 },
    { x: -1.12, y: -1.02, w: 0.38, h: 0.28 },
  ];
  for (const block of blocks) {
    const a = P(block);
    const b = P({ x: block.x + block.w, y: block.y + block.h });
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    ctx.fillStyle = variant === "ink" ? "#c9c2b4" : "#efe4d2";
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = variant === "ink" ? "#8fa4b0" : "#c9ddd4";
    ctx.fillRect(x + 6, y + 6, Math.max(4, w * 0.28), Math.max(4, h * 0.22));
  }
}

function drawTree(ctx, at, scale, color, variant) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = variant === "ink" ? "rgba(22,28,34,0.18)" : "rgba(48,42,36,0.16)";
  ctx.beginPath();
  ctx.ellipse(4, 8, scale * 0.08, scale * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, scale * (variant === "soft" ? 0.11 : 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(-scale * 0.03, -scale * 0.03, scale * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlobs(ctx, width, height, color, id) {
  const random = mulberry(hash(id));
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.ellipse(random() * width, random() * height, 18 + random() * 40, 12 + random() * 24, random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSign(ctx, at, scale, kind, emphasized) {
  const s = Math.max(11, scale * 0.1);
  ctx.save();
  ctx.translate(at.x, at.y);
  if (kind === "main") {
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#f2c14b";
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = "#1c242c";
    ctx.lineWidth = 2;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = "#f7f4ee";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-s * 0.68, -s * 0.68, s * 1.36, s * 1.36);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(s * 0.95, -s * 0.72);
    ctx.lineTo(-s * 0.95, -s * 0.72);
    ctx.closePath();
    ctx.fillStyle = "#f7f4ee";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#b42318";
    ctx.stroke();
  }
  if (emphasized) {
    ctx.rotate(kind === "main" ? -Math.PI / 4 : 0);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.85, 0, Math.PI * 2);
    ctx.strokeStyle = "#8e3b32";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function strokeSamples(ctx, P, samples, fraction, color, width, dashed) {
  const steps = 18;
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(P(pointAlong(samples, fraction * (i / steps))));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const pt of pts.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(dashed ? [8, 7] : []);
  ctx.stroke();
  ctx.setLineDash([]);
  if (dashed) return;
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, 4.5);
  ctx.lineTo(-9, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, at, heading, scale, vehicle, palette, font, explanation) {
  const length = VEHICLE_LENGTH * scale;
  const width = VEHICLE_WIDTH * scale;
  const color = carColor(task.vehicles.findIndex((item) => item.id === vehicle.id), style);
  ctx.save();
  ctx.translate(at.x + 3, at.y + 6);
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.42, width * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-heading);
  ctx.fillStyle = color;
  roundRect(ctx, -length / 2, -width / 2, length, width, Math.max(3, width * (style === "ink" ? 0.16 : 0.42)));
  ctx.fill();
  ctx.strokeStyle = "rgba(20,24,28,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  roundRect(ctx, length * 0.06, -width * 0.32, length * 0.24, width * 0.64, 3);
  ctx.fill();
  if (style === "soft") {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(ctx, -length * 0.24, -width * 0.28, length * 0.26, width * 0.56, 4);
    ctx.fill();
  }
  ctx.fillStyle = "#f7f1d8";
  ctx.beginPath();
  ctx.arc(length * 0.4, -width * 0.26, Math.max(1.6, width * 0.09), 0, Math.PI * 2);
  ctx.arc(length * 0.4, width * 0.26, Math.max(1.6, width * 0.09), 0, Math.PI * 2);
  ctx.fill();
  if (vehicle.maneuver !== "straight") {
    const side = vehicle.maneuver === "left" ? -1 : 1;
    ctx.fillStyle = "#e0a23a";
    ctx.beginPath();
    ctx.arc(length * 0.28, side * width * 0.46, Math.max(2.4, width * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const disc = Math.max(13, scale * 0.09);
  ctx.beginPath();
  ctx.fillStyle = palette.disc;
  ctx.arc(at.x, at.y, disc, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,24,28,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${labelPx(scale)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(vehicle.id, at.x, at.y);
  if (explanation) {
    const selected = explanation.highlight.selected === vehicle.id;
    const yields = explanation.highlight.yieldTo.includes(vehicle.id);
    if (selected || yields) {
      ctx.beginPath();
      ctx.arc(at.x, at.y, Math.max(disc + 10, length * 0.7), 0, Math.PI * 2);
      ctx.strokeStyle = selected ? palette.yieldMark : palette.ink;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash(selected ? [] : [5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  drawPill(ctx, {
    x: at.x - hx * (length * 0.78),
    y: at.y + hy * (length * 0.78),
  }, MANEUVER_WORD[vehicle.maneuver], font, palette);

  if (explanation) {
    const role = explanation.highlight.selected === vehicle.id
      ? "ждёт"
      : explanation.highlight.yieldTo.includes(vehicle.id) ? "ему уступают" : "";
    if (role) {
      const noseX = Math.cos(heading);
      const noseY = -Math.sin(heading);
      const reach = width * 0.55 + 34;
      drawPill(ctx, {
        x: at.x + noseY * reach,
        y: at.y - noseX * reach,
      }, role, font, palette);
    }
  }
}

function drawPill(ctx, at, text, font, palette) {
  ctx.save();
  ctx.font = `600 13px ${font}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 12;
  const h = 20;
  ctx.fillStyle = palette.disc;
  roundRect(ctx, at.x - w / 2, at.y - h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,24,28,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = palette.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
}

function hash(text) {
  let value = 2166136261;
  for (const ch of text) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return value >>> 0;
}

function mulberry(seed) {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadProgress() {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(KEYS.intersection) || "null"));
  } catch {
    return parseProgress(null);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(KEYS.intersection, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

const standalone = document.getElementById("ix-app");
if (standalone) {
  header("trainer");
  standalone.innerHTML = `<p class="kicker">Тренажёр</p>
<h1>Проезд перекрёстка</h1>
<p class="deck">Выбери автомобиль, который может проехать. Иногда оба могут ехать независимо — тогда верен любой выбор.</p>
${trainerShell()}`;
  mountIntersection(standalone);
}

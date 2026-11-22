/**
 * Drawable frame for one instant. Shared by the vector renderer and the CPU renderer.
 * Road material, car polygons and sign sides are computed here; neither renderer invents them.
 */
import {
  B1, HALF, PATCH_LEN, SCALE, STOP_DIAGRAM, VIEW, expectation, kinematic,
  refusesWinner, spreadVerticalMaterial, worldToScreen, worldsDoc,
} from "./model.mjs";

export const PALETTE = {
  paper: "#e7e1d4",
  paved: "#8d8880",
  dirt: "#a56b38",
  snow: "#e7eef0",
  blue: "#277fb5",
  red: "#c85b50",
  gray: "#5c656c",
  glass: "#d5e4ea",
  ink: "#1c2430",
  plate: "#f6f3ec",
  building: "#d4cdc0",
  fence: "#5e564c",
  sidewalk: "#ddd6c8",
  court: "#efe4cf",
  band: "#e4c15a",
  yellow: "#f0d23c",
  stopRed: "#c0392b",
  bus: "#e2b143",
  truck: "#6d767c",
};

const TRAVEL = 76;

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function mixHex(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rect(x0, y0, x1, y1) {
  return [worldToScreen(x0, y0), worldToScreen(x1, y0), worldToScreen(x1, y1), worldToScreen(x0, y1)];
}

function add(shapes, shape) {
  shapes.push(shape);
}

function stippleRect(shapes, x0, y0, x1, y1, color, seed, step = 1.55, r = 1.35) {
  const loX = Math.min(x0, x1);
  const hiX = Math.max(x0, x1);
  const loY = Math.min(y0, y1);
  const hiY = Math.max(y0, y1);
  let n = 0;
  for (let x = loX; x <= hiX; x += step) {
    for (let y = loY; y <= hiY; y += step) {
      const h = ((Math.imul(Math.floor(x * 10) + seed, 374761393) ^ Math.imul(Math.floor(y * 10), 668265263)) >>> 0) / 4294967295;
      if (h < 0.55) continue;
      const [sx, sy] = worldToScreen(x, y);
      add(shapes, { op: "circle", cx: sx, cy: sy, r: r + h, fill: color, role: "texture" });
      if (++n > 900) return;
    }
  }
}

function paveSpec(state) {
  if (state.pave) return state.pave;
  if (state.world === "A3") return { type: "paved" };
  if (state.world === "A2") return { type: "patch", length: PATCH_LEN };
  return { type: "dirt" };
}

function verticalSegments(pave) {
  if (pave.type === "paved") return [{ y0: -100, y1: 100, material: "paved" }];
  if (pave.type === "dirt") return [{ y0: -100, y1: 100, material: "dirt" }];
  if (pave.type === "patch") {
    const south = -(HALF + pave.length);
    return [
      { y0: -100, y1: south, material: "dirt" },
      { y0: south, y1: HALF, material: "paved" },
      { y0: HALF, y1: 100, material: "dirt" },
    ];
  }
  const cuts = [-100];
  let prev = spreadVerticalMaterial(-100, pave.u);
  for (let y = -99.5; y <= 100; y += 0.5) {
    const next = spreadVerticalMaterial(y, pave.u);
    if (next !== prev) {
      cuts.push(y);
      prev = next;
    }
  }
  cuts.push(100);
  const segments = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i];
    const y1 = cuts[i + 1];
    if (y1 - y0 <= 0.2) continue;
    segments.push({ y0, y1, material: spreadVerticalMaterial((y0 + y1) / 2, pave.u) });
  }
  return segments;
}

function roadFill(material, snow, contrast) {
  if (snow >= 0.98) return PALETTE.snow;
  const base = material === "paved" ? PALETTE.paved : PALETTE.dirt;
  const softened = mixHex(PALETTE.paper, base, 0.55 + 0.45 * contrast);
  if (snow <= 0) return softened;
  return mixHex(softened, PALETTE.snow, snow);
}

export function assertNoPriorityPassage(state) {
  const along = (state.cars?.blueAlong ?? 0) + (state.cars?.redAlong ?? 0) + (state.cars?.grayAlong ?? 0);
  const blocked = state.world === "A5" || state.world === "B1" || state.scene === "bend";
  if (blocked && along > 0.001) {
    throw new Error(`refusing to animate a passage in ${state.world || state.scene}`);
  }
  if (state.world && refusesWinner(state.world) && state.world !== "A0" && along > 0.001 && state.world !== "OUTRO") {
    throw new Error(`refusing a winner animation for ${state.world}`);
  }
}

function carPolys(spec, along) {
  const rad = (spec.headingDeg * Math.PI) / 180;
  const fx = Math.cos(rad);
  const fy = Math.sin(rad);
  const rx = -fy;
  const ry = fx;
  const cx = spec.x + fx * along * TRAVEL;
  const cy = spec.y + fy * along * TRAVEL;
  const L = 4.8;
  const W = 2.05;
  const p = (dl, dw) => worldToScreen(cx + fx * dl + rx * dw, cy + fy * dl + ry * dw);
  return {
    id: spec.id,
    center: { x: cx, y: cy },
    body: [p(-L, -W), p(L * 0.7, -W), p(L, -W * 0.62), p(L, W * 0.62), p(L * 0.7, W), p(-L, W)],
    glass: [p(L * 0.12, -W * 0.55), p(L * 0.58, -W * 0.38), p(L * 0.58, W * 0.38), p(L * 0.12, W * 0.55)],
    mark: p(-L * 0.25, 0),
    brakeL: [p(-L * 1.15, -W * 0.82), p(-L * 0.55, -W * 0.82), p(-L * 0.55, -W * 0.22), p(-L * 1.15, -W * 0.22)],
    brakeR: [p(-L * 1.15, W * 0.22), p(-L * 0.55, W * 0.22), p(-L * 0.55, W * 0.82), p(-L * 1.15, W * 0.82)],
  };
}

function drawCar(shapes, spec, along, brake, fill) {
  const g = carPolys(spec, along);
  add(shapes, { op: "poly", pts: g.body, fill, role: "car", id: spec.id });
  add(shapes, { op: "poly", pts: g.glass, fill: PALETTE.glass, role: "car", id: spec.id });
  const markFill = "#f4f1ea";
  if (spec.mark === "square") {
    const [x, y] = g.mark;
    add(shapes, { op: "poly", pts: [[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5]], fill: markFill, role: "car", id: spec.id });
  } else if (spec.mark === "triangle") {
    const [x, y] = g.mark;
    add(shapes, { op: "poly", pts: [[x, y - 6], [x + 6, y + 5], [x - 6, y + 5]], fill: markFill, role: "car", id: spec.id });
  } else {
    const [x, y] = g.mark;
    add(shapes, { op: "circle", cx: x, cy: y, r: 5.5, fill: markFill, role: "car", id: spec.id });
  }
  if (brake) {
    add(shapes, { op: "poly", pts: g.brakeL, fill: "#ff2a2a", role: "car", id: spec.id });
    add(shapes, { op: "poly", pts: g.brakeR, fill: "#ff2a2a", role: "car", id: spec.id });
  }
  return g.center;
}

function drawSign21(shapes, x, y) {
  const [sx, sy] = worldToScreen(x, y);
  const d = (r) => [[sx, sy - r], [sx + r, sy], [sx, sy + r], [sx - r, sy]];
  add(shapes, { op: "poly", pts: d(30), fill: "#161616", role: "sign", code: "2.1" });
  add(shapes, { op: "poly", pts: d(24), fill: "#f7f7f7", role: "sign", code: "2.1" });
  add(shapes, { op: "poly", pts: d(18), fill: PALETTE.yellow, role: "sign", code: "2.1" });
}

function drawSign23(shapes, x, y) {
  const [sx, sy] = worldToScreen(x, y);
  const tri = (r, dy = 0) => [[sx - r, sy - r * 0.72 + dy], [sx + r, sy - r * 0.72 + dy], [sx, sy + r * 0.92 + dy]];
  add(shapes, { op: "poly", pts: tri(30), fill: "#d02020", role: "sign", code: "2.3" });
  add(shapes, { op: "poly", pts: tri(20, 2), fill: "#f7f7f7", role: "sign", code: "2.3" });
}

function drawPlate813(shapes, x, y, scale = 1) {
  const [sx, sy] = worldToScreen(x, y);
  const w = 46 * scale;
  const h = 46 * scale;
  add(shapes, { op: "poly", pts: [[sx, sy], [sx + w, sy], [sx + w, sy + h], [sx, sy + h]], fill: "#1b1b1b", role: "sign", code: "8.13" });
  const ax = sx + 8 * scale;
  const ay = sy + h - 10 * scale;
  add(shapes, {
    op: "line",
    pts: [[ax, ay], [ax + 16 * scale, ay], [ax + 16 * scale, ay - 22 * scale]],
    stroke: PALETTE.band, width: 6 * scale, role: "sign", code: "8.13",
  });
}

function overlays(shapes, lines) {
  if (!lines?.length) return;
  const size = 36;
  const width = Math.min(1280, Math.max(...lines.map((t) => t.length)) * size * 0.52 + 48);
  const height = 28 + lines.length * 46;
  const x = (VIEW.width - width) / 2;
  const y = 36;
  add(shapes, { op: "poly", pts: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]], fill: PALETTE.plate, role: "overlay" });
  lines.forEach((text, i) => {
    add(shapes, { op: "text", x: VIEW.width / 2, y: y + 40 + i * 46, text, size, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  });
}

function drawJunction(state, shapes) {
  const snow = state.snow ?? 0;
  const contrast = state.contrast ?? 1;
  const pave = paveSpec(state);
  const segments = verticalSegments(pave);
  add(shapes, { op: "poly", pts: rect(-100, -HALF, 100, HALF), fill: roadFill("paved", snow, contrast), role: "road", material: snow >= 0.98 ? "snow" : "paved", arm: "h" });
  if (snow < 0.98 && contrast > 0.4) stippleRect(shapes, -100, -HALF, 100, HALF, "#7a756e", 3, 2.4, 1.1);
  for (const seg of segments) {
    const material = snow >= 0.98 ? "snow" : seg.material;
    add(shapes, {
      op: "poly",
      pts: rect(-HALF, seg.y0, HALF, seg.y1),
      fill: roadFill(seg.material, snow, contrast),
      role: "road",
      material,
      arm: "v",
    });
    if (snow < 0.98 && seg.material === "dirt") stippleRect(shapes, -HALF, seg.y0, HALF, seg.y1, "#7a4e24", 9, 1.45, 1.45);
    if (snow < 0.98 && seg.material === "paved") stippleRect(shapes, -HALF, seg.y0, HALF, seg.y1, "#6f6b64", 4, 2.8, 1.05);
  }
  if (snow >= 0.98) {
    stippleRect(shapes, -100, -HALF, 100, HALF, "#f7fbff", 2, 2.2, 1.3);
    stippleRect(shapes, -HALF, -100, HALF, 100, "#f7fbff", 5, 2.2, 1.3);
  }
  if (state.legend) {
    const chips = [["Твёрдое", PALETTE.paved], ["Щебень", "#9a9186"], ["Грунт", PALETTE.dirt]];
    chips.forEach((chip, i) => {
      const x = 1380;
      const y = 150 + i * 64;
      add(shapes, { op: "poly", pts: [[x, y], [x + 54, y], [x + 54, y + 36], [x, y + 36]], fill: chip[1], role: "legend" });
      add(shapes, { op: "text", x: x + 68, y: y + 28, text: chip[0], size: 28, fill: PALETTE.ink, weight: 700, anchor: "start", role: "legend" });
    });
  }
  return segments;
}

function drawPairCars(state, shapes) {
  const cars = state.cars ?? {};
  const blue = { ...kinematic("blue"), mark: "circle" };
  const red = { ...kinematic("red"), mark: "square" };
  const centers = {
    blue: drawCar(shapes, blue, cars.blueAlong ?? 0, !!cars.blueBrake, PALETTE.blue),
    red: drawCar(shapes, red, cars.redAlong ?? 0, !!cars.redBrake, PALETTE.red),
  };
  return centers;
}

function drawYard(state, shapes) {
  const u = state.yardU ?? 0;
  const yard = 1 - u;
  add(shapes, { op: "poly", pts: rect(-92, -74, 92, -9), fill: PALETTE.court, opacity: yard, role: "context", kind: "yard" });
  add(shapes, { op: "poly", pts: rect(-78, -70, -24, -46), fill: PALETTE.building, opacity: yard, role: "context", kind: "yard" });
  add(shapes, { op: "poly", pts: rect(24, -70, 78, -46), fill: PALETTE.building, opacity: yard, role: "context", kind: "yard" });
  for (let i = 0; i < 4; i++) {
    const y = -58 + i * 3.2;
    add(shapes, { op: "line", pts: [worldToScreen(-12, y), worldToScreen(12, y)], stroke: "#f7f4ee", width: 2, opacity: yard, role: "context", kind: "parking" });
  }
  add(shapes, { op: "line", pts: [worldToScreen(-90, -8.6), worldToScreen(-12, -8.6)], stroke: PALETTE.fence, width: 5, opacity: yard, role: "context", kind: "fence" });
  add(shapes, { op: "line", pts: [worldToScreen(12, -8.6), worldToScreen(90, -8.6)], stroke: PALETTE.fence, width: 5, opacity: yard, role: "context", kind: "fence" });
  add(shapes, { op: "poly", pts: rect(-100, HALF, 100, HALF + 5), fill: PALETTE.sidewalk, role: "context", kind: "sidewalk" });
  add(shapes, { op: "poly", pts: rect(-100, -HALF - 5, 100, -HALF), fill: PALETTE.sidewalk, opacity: 0.35 + 0.65 * u, role: "context", kind: "sidewalk" });
  add(shapes, { op: "poly", pts: rect(-100, 16, -16, 30), fill: PALETTE.building, role: "context", kind: "street" });
  add(shapes, { op: "poly", pts: rect(16, 16, 100, 30), fill: PALETTE.building, role: "context", kind: "street" });
  add(shapes, { op: "poly", pts: rect(-16, 16, 16, 30), fill: PALETTE.building, opacity: yard, role: "context", kind: "yard-closure" });
  add(shapes, { op: "poly", pts: rect(-100, -HALF, 100, HALF), fill: PALETTE.paved, role: "road", material: "paved", arm: "h" });
  const north = u * 100;
  add(shapes, { op: "poly", pts: rect(-HALF, -100, HALF, north), fill: PALETTE.paved, role: "road", material: "paved", arm: "v", north });
  if (u > 0.05) {
    add(shapes, { op: "poly", pts: rect(-HALF - 4, 0, -HALF, north), fill: PALETTE.sidewalk, opacity: u, role: "context", kind: "through" });
    add(shapes, { op: "poly", pts: rect(HALF, 0, HALF + 4, north), fill: PALETTE.sidewalk, opacity: u, role: "context", kind: "through" });
    add(shapes, { op: "poly", pts: rect(-100, 40, 100, 50), fill: PALETTE.paved, opacity: u, role: "context", kind: "far-cross" });
  }
  if (u > 0.05) {
    add(shapes, { op: "poly", pts: rect(-HALF - 4, -78, -HALF, -HALF), fill: PALETTE.sidewalk, opacity: u, role: "context", kind: "through" });
    add(shapes, { op: "poly", pts: rect(HALF, -78, HALF + 4, -HALF), fill: PALETTE.sidewalk, opacity: u, role: "context", kind: "through" });
  }
  if (state.pedestrian !== false) {
    const [px, py] = worldToScreen(-26, 11);
    add(shapes, { op: "circle", cx: px, cy: py - 10, r: 6, fill: "#2d3438", role: "pedestrian" });
    add(shapes, { op: "circle", cx: px, cy: py + 4, r: 9, fill: "#3e4a50", role: "pedestrian" });
    add(shapes, { op: "line", pts: [worldToScreen(-46, 11), worldToScreen(-14, 11)], stroke: "#2d3438", width: 2, dash: "7 7", role: "pedestrian-path" });
  }
}

function drawBend(shapes) {
  add(shapes, { op: "poly", pts: rect(-100, -HALF, 100, HALF), fill: PALETTE.paved, role: "road", material: "paved", arm: "h" });
  add(shapes, { op: "poly", pts: rect(-HALF, -100, HALF, 100), fill: PALETTE.paved, role: "road", material: "paved", arm: "v" });
  add(shapes, { op: "line", pts: [worldToScreen(-100, 0), worldToScreen(0, 0), worldToScreen(0, 100)], stroke: PALETTE.band, width: 16, role: "main-band" });
  for (const sign of B1.signs) {
    if (sign.code === "2.1") drawSign21(shapes, sign.x, sign.y);
    else drawSign23(shapes, sign.x, sign.y);
  }
  drawPlate813(shapes, 18, -28, 1.35);
  B1.cars.forEach((car) => {
    const fill = car.id === "blue" ? PALETTE.blue : car.id === "red" ? PALETTE.red : PALETTE.gray;
    drawCar(shapes, car, 0, false, fill);
  });
}

function drawCase(state, shapes) {
  add(shapes, { op: "text", x: 960, y: 90, text: "США · 16 февраля 2012 · NTSB HWY12MH007", size: 36, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "case-title" });
  const road = (x, y, w, h) => add(shapes, { op: "poly", pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill: PALETTE.paved, role: "road", material: "symbolic" });
  road(260, 500, 1400, 90);
  road(915, 250, 90, 620);
  const along = state.busAlong ?? 0;
  const busTop = 800 - along * 110;
  add(shapes, { op: "poly", pts: [[930, busTop], [990, busTop], [990, busTop + 140], [930, busTop + 140]], fill: PALETTE.bus, role: "bus" });
  add(shapes, { op: "poly", pts: [[340, 518], [560, 518], [560, 572], [340, 572]], fill: PALETTE.truck, role: "truck" });
  const ox = 850;
  const oy = 690;
  const oct = [];
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * (Math.PI / 4);
    oct.push([ox + Math.cos(angle) * 28, oy + Math.sin(angle) * 28]);
  }
  add(shapes, { op: "poly", pts: oct, fill: PALETTE.stopRed, role: "sign", code: "US-STOP" });
  add(shapes, { op: "text", x: ox, y: oy + 6, text: "STOP", size: 16, fill: "#fff", weight: 700, anchor: "middle", role: "sign" });
  const flash = 0.45 + 0.55 * Math.abs(Math.sin((state.t ?? 0) * 1.6));
  add(shapes, { op: "circle", cx: ox, cy: oy - 48, r: 12, fill: "#d02020", opacity: flash, role: "beacon" });
  add(shapes, { op: "text", x: 960, y: 990, text: "Схема учебная. Геометрия не реконструирует место ДТП.", size: 30, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "case-note" });
}

function drawStopPark(shapes) {
  const d = STOP_DIAGRAM;
  add(shapes, { op: "text", x: 480, y: 150, text: "Пересечение проезжих частей", size: 32, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  add(shapes, { op: "poly", pts: [[180, d.crossingTop + 40], [620, d.crossingTop + 40], [620, d.crossingBottom - 40], [180, d.crossingBottom - 40]], fill: PALETTE.paved, role: "road" });
  add(shapes, { op: "poly", pts: [[d.crossingLeft, 360], [d.crossingRight, 360], [d.crossingRight, 760], [d.crossingLeft, 760]], fill: PALETTE.paved, role: "road" });
  add(shapes, {
    op: "poly",
    pts: [[d.measureEndX, 500], [d.measureStartX, 500], [d.measureStartX, 580], [d.measureEndX, 580]],
    fill: "rgba(180,70,60,0.28)",
    role: "measure-zone",
    from: "edge",
  });
  add(shapes, { op: "line", pts: [[d.measureStartX, 540], [d.measureEndX, 540]], stroke: PALETTE.ink, width: 4, role: "measure", fromX: d.measureStartX });
  add(shapes, { op: "line", pts: [[d.measureStartX, 524], [d.measureStartX, 556]], stroke: PALETTE.ink, width: 4, role: "measure-tick" });
  add(shapes, { op: "text", x: (d.measureStartX + d.measureEndX) / 2, y: 490, text: "5 м от края", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  add(shapes, { op: "text", x: 480, y: 820, text: "Остановка запрещена на пересечении", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  add(shapes, { op: "text", x: 480, y: 858, text: "и ближе 5 м от его краёв.", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  const words = d.exception;
  add(shapes, { op: "text", x: 480, y: 910, text: "Исключение — напротив бокового выезда", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "exception" });
  add(shapes, { op: "text", x: 480, y: 948, text: "T-пересечения со сплошной или разделителем.", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "exception" });
  add(shapes, { op: "text", x: 1440, y: 150, text: "Выезд автомобиля со двора", size: 32, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  add(shapes, { op: "poly", pts: [[1100, 520], [1780, 520], [1780, 620], [1100, 620]], fill: PALETTE.paved, role: "road" });
  add(shapes, { op: "poly", pts: [[1380, 620], [1500, 620], [1500, 860], [1380, 860]], fill: PALETTE.court, role: "context", kind: "yard" });
  add(shapes, { op: "poly", pts: [[1408, 700], [1472, 700], [1472, 780], [1408, 780]], fill: PALETTE.red, role: "parked" });
  add(shapes, { op: "circle", cx: 1440, cy: 740, r: 36, fill: "none", stroke: PALETTE.stopRed, width: 6, role: "no-parking" });
  add(shapes, { op: "line", pts: [[1416, 764], [1464, 716]], stroke: PALETTE.stopRed, width: 6, role: "no-parking" });
  add(shapes, { op: "text", x: 1440, y: 920, text: "Запрещена стоянка.", size: 30, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  add(shapes, { op: "text", x: 1440, y: 962, text: "Это не запрет любой остановки.", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  void words;
}

function drawRecap(shapes) {
  const lines = [
    ["1", "Место: выезд со двора — не перекрёсток"],
    ["2", "Чем задан приоритет"],
    ["3", "Регулировщик или светофор"],
    ["4", "Иначе знаки, потом покрытие"],
    ["5", "Короткий асфальт не в счёт"],
    ["6", "Не видно покрытие — не бери главную"],
    ["7", "Равнозначные: уступи справа"],
    ["8", "Главная поворачивает — внутри группы"],
  ];
  add(shapes, { op: "text", x: 960, y: 78, text: "Место, приоритет, участники, манёвр", size: 36, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "overlay" });
  lines.forEach((line, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = 140 + col * 900;
    const y = 180 + row * 150;
    add(shapes, { op: "circle", cx: x + 28, cy: y + 20, r: 26, fill: "#efe8d8", role: "recap" });
    add(shapes, { op: "text", x: x + 28, y: y + 30, text: line[0], size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "recap" });
    add(shapes, { op: "text", x: x + 70, y: y + 30, text: line[1], size: 28, fill: PALETTE.ink, weight: 700, anchor: "start", role: "recap" });
  });
  add(shapes, { op: "text", x: 960, y: 860, text: "Остановка у пересечения и стоянка у выезда со двора — разные запреты.", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "recap" });
  add(shapes, { op: "text", x: 960, y: 980, text: "Сводка не заменяет уже увиденные сцены.", size: 28, fill: "#3d4650", weight: 400, anchor: "middle", role: "recap" });
}

export function buildFrame(state) {
  assertNoPriorityPassage(state);
  const shapes = [];
  add(shapes, { op: "poly", pts: [[0, 0], [VIEW.width, 0], [VIEW.width, VIEW.height], [0, VIEW.height]], fill: PALETTE.paper, role: "paper" });
  const scene = state.scene ?? "junction";
  let centers = null;
  if (state.layers !== "cars") {
    if (scene === "junction") drawJunction(state, shapes);
    else if (scene === "yard") drawYard(state, shapes);
    else if (scene === "bend") drawBend(shapes);
    else if (scene === "case") drawCase(state, shapes);
    else if (scene === "stoppark") drawStopPark(shapes);
    else if (scene === "recap") drawRecap(shapes);
  }
  if (scene === "junction" || scene === "yard") {
    if (state.signs === "a4") {
      for (const sign of worldsDoc.worlds.A4.signs) {
        if (sign.code === "2.1") drawSign21(shapes, sign.approxWorldPosition[0], sign.approxWorldPosition[1]);
        if (sign.code === "2.3") drawSign23(shapes, sign.approxWorldPosition[0], sign.approxWorldPosition[1]);
      }
    }
    centers = drawPairCars(state, shapes);
    if ((state.snow ?? 0) >= 0.98 && centers) {
      const blueLabel = worldToScreen(centers.blue.x, centers.blue.y + 8);
      const redLabel = worldToScreen(centers.red.x + 8, centers.red.y);
      add(shapes, { op: "text", x: blueLabel[0], y: blueLabel[1], text: "своя — второстепенная", size: 28, fill: PALETTE.ink, weight: 700, anchor: "middle", role: "snow-duty" });
      add(shapes, { op: "text", x: redLabel[0], y: redLabel[1], text: "своя — второстепенная", size: 28, fill: PALETTE.ink, weight: 700, anchor: "start", role: "snow-duty" });
    }
  }
  if (state.layers !== "cars") overlays(shapes, state.overlays);
  const pave = scene === "junction" ? paveSpec(state) : null;
  return {
    width: VIEW.width,
    height: VIEW.height,
    shapes,
    meta: {
      scene,
      world: state.world ?? null,
      pave,
      centers,
      snow: state.snow ?? 0,
      yardU: state.yardU ?? null,
      expectation: state.world ? expectation(state.world) : null,
    },
  };
}

export function roadMaterials(frame) {
  return frame.shapes.filter((s) => s.role === "road").map((s) => s.material);
}

export { spreadVerticalMaterial, SCALE };

/** Schematic SVG figures for own check items (pure: spec → SVG string). Not to scale. */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const svg = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="fig" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>`;
const text = (x, y, s, cls = "lbl", extra = "") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle"${extra}>${esc(s)}</text>`;

// ---- crossing: top view, 300×300, centre 150, road width 70
const C = 150, HW = 35;
const ARM = {
  n: { x: C - HW, y: 0, w: 2 * HW, h: C - HW },
  s: { x: C - HW, y: C + HW, w: 2 * HW, h: C - HW },
  w: { x: 0, y: C - HW, w: C - HW, h: 2 * HW },
  e: { x: C + HW, y: C - HW, w: C - HW, h: 2 * HW },
};
// Right-hand traffic: a car coming from side `from` drives in the right half of that arm, pointing to the centre.
const CAR_AT = {
  s: { x: C + HW / 2, y: 255, r: 0 },
  n: { x: C - HW / 2, y: 45, r: 180 },
  w: { x: 45, y: C + HW / 2, r: 90 },
  e: { x: 255, y: C - HW / 2, r: 270 },
};
const EXIT = { n: [C + HW / 2, 20], s: [C - HW / 2, 280], w: [20, C - HW / 2], e: [280, C + HW / 2] };

function crossing(f) {
  const arms = f.arms || ["n", "e", "s", "w"];
  const main = new Set(f.main || []), unpaved = new Set(f.unpaved || []);
  let body = `<rect width="300" height="300" class="bg"/>`;
  body += `<rect x="${C - HW}" y="${C - HW}" width="${2 * HW}" height="${2 * HW}" class="road"/>`;
  for (const a of arms) {
    const r = ARM[a];
    const cls = a === f.yard ? "yard" : unpaved.has(a) ? "unpaved" : main.has(a) ? "main" : "road";
    body += `<rect class="arm" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" data-kind="${cls}"/>`;
    body += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" class="${cls}"/>`;
    const vert = a === "n" || a === "s";
    if (cls !== "yard") {
      body += vert ? `<line x1="${C}" y1="${r.y + 4}" x2="${C}" y2="${r.y + r.h - 4}" class="axis"/>`
        : `<line x1="${r.x + 4}" y1="${C}" x2="${r.x + r.w - 4}" y2="${C}" class="axis"/>`;
    }
    const tag = cls === "yard" ? "двор" : cls === "unpaved" ? "грунт" : cls === "main" ? "главная" : "";
    if (tag) {
      const tx = vert ? C + HW + 30 : r.x + r.w / 2, ty = vert ? r.y + r.h / 2 : C - HW - 8;
      body += text(tx, ty, tag, "tag");
    }
  }
  for (const car of f.cars || []) {
    const p = CAR_AT[car.from];
    if (!p) throw new Error(`car from unknown side ${car.from}`);
    const [ex, ey] = EXIT[car.to] || [C, C];
    // arrowhead without <marker>: several figures may share one page, so the SVG must not define ids
    const dx = ex - C, dy = ey - C, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const head = [[ex, ey], [ex - 10 * ux - 5 * uy, ey - 10 * uy + 5 * ux], [ex - 10 * ux + 5 * uy, ey - 10 * uy - 5 * ux]];
    body += `<path d="M${p.x},${p.y} Q${C},${C} ${ex},${ey}" class="route"/>` +
      `<polygon class="arrowhead" points="${head.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}"/>`;
    if (car.rail) {
      // tram: rails along its whole arm (to the centre), a longer body
      const vert = car.from === "n" || car.from === "s";
      const rails = vert ? [p.x - 6, p.x + 6].map(x => `<line x1="${x}" y1="${car.from === "n" ? 0 : 300}" x2="${x}" y2="${C}" class="rail"/>`)
        : [p.y - 6, p.y + 6].map(y => `<line x1="${car.from === "w" ? 0 : 300}" y1="${y}" x2="${C}" y2="${y}" class="rail"/>`);
      body += rails.join("");
    }
    const [bw, bh] = car.rail ? [20, 44] : [18, 30];
    body += `<g class="${car.rail ? "car tram" : "car"}" transform="translate(${p.x},${p.y}) rotate(${p.r})"><rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="4"/>` +
      `<text x="0" y="5" text-anchor="middle" transform="rotate(${-p.r})">${esc(car.id)}</text></g>`;
  }
  return svg(300, 300, "Схема перекрёстка (вид сверху, без масштаба)", body);
}

// ---- section: road cross-strips, top view, strips stacked vertically
const STRIP = { shoulder: ["обочина", 18], lane: ["", 30], strip: ["", 14], sidewalk: ["тротуар", 18] };

function section(f) {
  const W = 320;
  let y = 0, body = "";
  for (const s of f.strips) {
    const [, h] = STRIP[s.k] || ["", 30];
    body += `<rect class="strip k-${esc(s.k)}" x="40" y="${y}" width="${W - 40}" height="${h}"/>`;
    if (s.label) body += text(20, y + h / 2 + 5, s.label);
    y += h;
  }
  return svg(W, y, "Поперечное деление дороги (вид сверху, без масштаба)", body);
}

// ---- approach: a straight road towards a crossing object, marks at distances (metres) before it
function approach(f) {
  const W = 360, H = 120, X0 = 300, PX = 12; // object at X0, 12 px per metre
  const obj = {
    zebra: [`<g class="zebra">${[0, 1, 2, 3, 4].map(i => `<rect x="${X0}" y="${30 + i * 12}" width="20" height="6"/>`).join("")}</g>`, "переход"],
    barrier: [`<line x1="${X0}" y1="22" x2="${X0}" y2="90" class="barrier"/>`, "шлагбаум"],
    rails: [`<line x1="${X0}" y1="25" x2="${X0}" y2="95" class="rail"/><line x1="${X0 + 14}" y1="25" x2="${X0 + 14}" y2="95" class="rail"/>`, "рельс"],
  }[f.object];
  if (!obj) throw new Error(`unknown approach object ${f.object}`);
  let body = `<rect x="0" y="25" width="${W}" height="70" class="road"/><line x1="0" y1="60" x2="${W}" y2="60" class="axis"/>` + obj[0];
  body += text(X0 + 10, 16, obj[1], "tag");
  if (f.light != null) {
    const x = X0 - f.light * PX;
    body += `<g class="light"><rect x="${x - 5}" y="96" width="10" height="20" rx="2"/></g>` + text(x, 14, "светофор", "tag");
  }
  for (const m of f.marks || []) {
    const x = X0 - m.m * PX;
    body += `<g class="mark"><line x1="${x}" y1="66" x2="${x}" y2="94"/>${text(x, 82, m.label, "lbl small")}${text(x, 110, `${m.m} м`, "dist")}</g>`;
  }
  return svg(W, H, "Подъезд к переходу или переезду (без масштаба, расстояния подписаны)", body);
}

export function figureSvg(f) {
  if (f.kind === "crossing") return crossing(f);
  if (f.kind === "section") return section(f);
  if (f.kind === "approach") return approach(f);
  throw new Error(`unknown figure kind ${f.kind}`);
}

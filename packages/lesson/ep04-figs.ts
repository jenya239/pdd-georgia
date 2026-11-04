const IMG = "lessons/ep04/";

class F {
  n: number;
  constructor(n: number) {
    this.n = n;
  }
  toString(): string {
    return Number.isInteger(this.n) ? `${this.n}.0` : String(this.n);
  }
}

function svg(w: number, h: number, body: string, label: string, uid: string): string {
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" class="nozone"/><line x1="0" y1="0" x2="0" y2="10" class="nohatch"/></pattern><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${body}</svg>`;
  for (const name of ["hatch", "ar"]) out = out.replaceAll(`id="${name}"`, `id="${uid}-${name}"`).replaceAll(`url(#${name})`, `url(#${uid}-${name})`);
  return out;
}

function car(x: number, y: number, w = 74, h = 36, cls = "car"): string {
  const mid = new F(y + h / 2);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/><rect x="${x + w - 24}" y="${y + 5}" width="12" height="${h - 10}" rx="3" class="glass"/><line x1="${x + w + 6}" y1="${mid}" x2="${x + w + 44}" y2="${mid}" class="move" marker-end="url(#ar)"/>`;
}

function sign(x: number, y: number, name: string, s = 40): string {
  const half = new F(x - s / 2);
  const plate = new F(x - s / 2 - 3);
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + s + 14}" class="pole"/><rect x="${plate}" y="${y - 3}" width="${s + 6}" height="${s + 6}" rx="5" class="plate"/><image href="${IMG}${name}.png" x="${half}" y="${y}" width="${s}" height="${s}"/>`;
}

function street(w: number, top = 0, road: [number, number] = [70, 210], bottom = 280): string {
  const [y0, y1] = road;
  const mid = new F((y0 + y1) / 2);
  return `<rect x="0" y="${top}" width="${w}" height="${y0 - top}" class="walk"/><rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" class="road"/><rect x="0" y="${y1}" width="${w}" height="${bottom - y1}" class="walk"/><line x1="0" y1="${mid}" x2="${w}" y2="${mid}" class="paint dash"/>`;
}

function range(start: number, stop: number, step: number): number[] {
  const out: number[] = [];
  for (let n = start; n < stop; n += step) out.push(n);
  return out;
}

export function figCrossingZebra(): string {
  const w = 600;
  const h = 280;
  let body = street(w);
  body += `<rect x="300" y="142" width="50" height="66" fill="url(#hatch)"/>`;
  for (let i = 0; i < 6; i += 1) body += `<rect x="350" y="${76 + i * 22}" width="56" height="12" class="paint"/>`;
  body += car(140, 157);
  body += `<text x="300" y="134" class="t small onroad" text-anchor="end">5 м</text>`;
  body += `<line x1="300" y1="138" x2="350" y2="138" class="dimw"/>`;
  body += `<text x="12" y="40" class="t">С разметкой 1.14.2 («зебра»)</text>`;
  body += `<text x="12" y="246" class="t small bad">Штриховка: остановка запрещена</text>`;
  body += `<text x="12" y="268" class="t small mut">ст. 37, п. 6 «а.а»: на переходе и ближе 5 м перед ним</text>`;
  return svg(w, h, body, "Переход с разметкой зебра: остановка запрещена на переходе и ближе 5 метров перед ним", "ep04-f1a");
}

export function figCrossingSigns(): string {
  const w = 600;
  const h = 280;
  let body = street(w);
  body += `<rect x="350" y="70" width="64" height="140" class="band"/>`;
  body += `<line x1="350" y1="70" x2="350" y2="210" class="edge"/><line x1="414" y1="70" x2="414" y2="210" class="edge"/>`;
  body += `<rect x="300" y="142" width="50" height="66" fill="url(#hatch)"/>`;
  body += sign(350, 214, "sign_5_19_1");
  body += sign(414, 12, "sign_5_19_2");
  body += car(140, 157);
  body += `<text x="300" y="134" class="t small onroad" text-anchor="end">5 м</text>`;
  body += `<line x1="300" y1="138" x2="350" y2="138" class="dimw"/>`;
  body += `<text x="12" y="40" class="t">Без разметки: только знаки</text>`;
  body += `<text x="12" y="246" class="t small">5.19.1 — ближняя граница</text>`;
  body += `<text x="438" y="40" class="t small">5.19.2 —</text><text x="438" y="60" class="t small">дальняя</text>`;
  body += `<text x="382" y="110" class="t small onroad" text-anchor="middle">пере-</text><text x="382" y="128" class="t small onroad" text-anchor="middle">ход</text>`;
  body += `<text x="12" y="268" class="t small mut">прил. 1, п. 5.19; ст. 5, п. 86 (груз. текст)</text>`;
  return svg(w, h, body, "Переход без разметки: границы задают знак 5.19.1 справа и знак 5.19.2 слева", "ep04-f1b");
}

export function figRailway(): string {
  const w = 640;
  const h = 330;
  const y0 = 120;
  const y1 = 220;
  const mid = new F((y0 + y1) / 2);
  let body = `<rect x="0" y="0" width="${w}" height="${h}" class="verge"/>`;
  body += `<rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" class="road"/>`;
  body += `<line x1="0" y1="${mid}" x2="${w}" y2="${mid}" class="paint dash"/>`;
  for (const yy of range(4, h, 14)) {
    if (y0 - 4 < yy && yy < y1 + 4) continue;
    body += `<rect x="496" y="${yy}" width="48" height="6" class="sleeper"/>`;
  }
  body += `<line x1="506" y1="0" x2="506" y2="${h}" class="rail"/><line x1="534" y1="0" x2="534" y2="${h}" class="rail"/>`;
  body += `<rect x="452" y="${y1 + 4}" width="12" height="12" class="pole2"/>`;
  body += `<line x1="458" y1="${y1 + 8}" x2="458" y2="${new F(mid.n + 4)}" class="barrier"/>`;
  body += `<line x1="410" y1="${new F(mid.n + 2)}" x2="410" y2="${y1 - 2}" class="paint thick"/>`;
  body += car(300, 178, 70, 32);
  body += `<line x1="40" y1="34" x2="506" y2="34" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  body += `<text x="44" y="26" class="t small">100 м перед переездом: обгон запрещён</text>`;
  body += `<line x1="250" y1="86" x2="506" y2="86" class="dim bad" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  body += `<line x1="534" y1="86" x2="636" y2="86" class="dim bad" marker-start="url(#ar)"/>`;
  body += `<text x="254" y="78" class="t small bad">50 м: стоянка запрещена</text>`;
  body += `<line x1="410" y1="${y1 + 30}" x2="458" y2="${y1 + 30}" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  body += `<text x="404" y="${y1 + 36}" class="t small" text-anchor="end">≥ 5 м до шлагбаума</text>`;
  body += `<text x="404" y="${y1 + 60}" class="t small mut" text-anchor="end">нет шлагбаума — ≥ 10 м до рельса</text>`;
  body += sign(70, y1 + 16, "sign_1_1", 44);
  body += `<text x="100" y="${y1 + 100}" class="t small mut">1.1 — за 150–300 м вне н. п.</text>`;
  body += `<text x="${w - 8}" y="20" class="t small mut" text-anchor="end">не в масштабе</text>`;
  return svg(w, h, body, "Железнодорожный переезд: 100 метров без обгона, 50 метров без стоянки, остановка не ближе 5 метров до шлагбаума", "ep04-f2");
}

export function figLevels(): string {
  const w = 640;
  const h = 270;
  const x = 330;
  let body = `<rect x="0" y="0" width="310" height="${h}" class="verge"/>`;
  body += `<rect x="0" y="100" width="310" height="80" class="road"/>`;
  body += `<rect x="185" y="0" width="70" height="${h}" class="bed"/>`;
  body += `<rect x="185" y="100" width="70" height="80" class="road"/>`;
  body += `<line x1="205" y1="0" x2="205" y2="${h}" class="rail"/><line x1="235" y1="0" x2="235" y2="${h}" class="rail"/>`;
  body += car(40, 124, 64, 32);
  body += `<text x="12" y="30" class="t">Одном уровне</text><text x="12" y="52" class="t small">трамвай на своём полотне</text>`;
  body += `<text x="12" y="215" class="t small ok">= переезд (ст. 5, п. 58)</text>`;
  body += `<text x="12" y="238" class="t small mut">действуют правила ст. 39</text>`;
  body += `<rect x="${x}" y="0" width="310" height="${h}" class="verge"/>`;
  for (const xx of range(x + 4, x + 310, 14)) body += `<rect x="${xx}" y="156" width="6" height="48" class="sleeper"/>`;
  body += `<line x1="${x}" y1="166" x2="${x + 310}" y2="166" class="rail"/><line x1="${x}" y1="194" x2="${x + 310}" y2="194" class="rail"/>`;
  body += `<rect x="${x + 150}" y="0" width="80" height="${h}" class="shadow"/>`;
  body += `<rect x="${x + 140}" y="0" width="80" height="${h}" class="road"/>`;
  body += `<line x1="${x + 140}" y1="0" x2="${x + 140}" y2="${h}" class="railing"/><line x1="${x + 220}" y1="0" x2="${x + 220}" y2="${h}" class="railing"/>`;
  body += `<text x="${x + 12}" y="30" class="t">Разные уровни</text><text x="${x + 12}" y="52" class="t small">дорога по мосту</text>`;
  body += `<text x="${x + 12}" y="238" class="t small bad">≠ переезд</text>`;
  body += `<line x1="320" y1="0" x2="320" y2="${h}" class="sep"/>`;
  return svg(w, h, body, "Слева: пересечение с трамваем на своём полотне на одном уровне — переезд. Справа: мост — не переезд", "ep04-f3");
}

function house(x: number, y: number, w = 26, h = 22): string {
  const peak = new F(x + w / 2);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="house"/><path d="M${x - 3},${y} L${peak},${y - 12} L${x + w + 3},${y} z" class="roof"/>`;
}

function plate(x: number, y: number, txt: string, end = false): string {
  let out = `<line x1="${x}" y1="${y + 30}" x2="${x}" y2="${y + 58}" class="pole"/><rect x="${x - 44}" y="${y}" width="88" height="34" rx="3" class="plate2"/><text x="${x}" y="${y + 23}" class="t small" text-anchor="middle">${txt}</text>`;
  if (end) out += `<line x1="${x - 40}" y1="${y + 31}" x2="${x + 40}" y2="${y + 3}" class="slash"/>`;
  return out;
}

export function figTown(): string {
  const w = 640;
  const h = 300;
  let body = `<rect x="0" y="0" width="${w}" height="${h}" class="verge"/>`;
  body += `<rect x="0" y="176" width="${w}" height="56" class="road"/>`;
  body += `<line x1="0" y1="204" x2="${w}" y2="204" class="paint dash"/>`;
  for (const xx of [...range(96, 190, 34), ...range(256, 470, 34), ...range(530, 620, 34)]) body += house(xx, 140);
  body += plate(222, 92, "5.23.x");
  body += plate(500, 92, "5.24.x", true);
  body += `<line x1="222" y1="64" x2="500" y2="64" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  body += `<text x="361" y="54" class="t" text-anchor="middle">режим н. п.: 60 км/ч</text>`;
  body += `<text x="12" y="30" class="t small">вне н. п. (B — до 90)</text>`;
  body += `<text x="${w - 12}" y="30" class="t small" text-anchor="end">вне н. п.</text>`;
  body += `<text x="12" y="262" class="t small mut">Дома до знака — ещё не населённый пункт.</text>`;
  body += `<text x="12" y="286" class="t small mut">Границу режима задаёт знак (ст. 5, п. 17; ст. 33, п. 6).</text>`;
  body += car(20, 186, 56, 28);
  return svg(w, h, body, "Населённый пункт начинается со знака начала, а не с первых домов; внутри — 60 км/ч", "ep04-f4");
}

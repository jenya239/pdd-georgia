function car(x: number, y: number, w: number, h: number, glassAt: "front" | "back"): string {
  const gy = glassAt === "front" ? y + 3 : y + h - Math.round(h * 0.28) - 3;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="car"/><rect x="${x + 3}" y="${gy}" width="${w - 6}" height="${Math.round(h * 0.28)}" rx="2" class="glass"/>`;
}

function roads(): string {
  return [
    `<rect x="240" y="0" width="160" height="480" class="road"/>`,
    `<rect x="0" y="180" width="640" height="140" class="road"/>`,
    `<line x1="320" y1="12" x2="320" y2="180" class="paint dash"/>`,
    `<line x1="320" y1="320" x2="320" y2="468" class="paint dash"/>`,
    `<line x1="12" y1="250" x2="240" y2="250" class="paint dash"/>`,
    `<line x1="400" y1="250" x2="628" y2="250" class="paint dash"/>`,
    `<circle cx="390" cy="404" r="7" class="go"/>`,
    `<circle cx="252" cy="96" r="7" class="go"/>`,
    car(346, 378, 28, 52, "front"),
    `<text x="418" y="412" class="t small">вы</text>`,
  ].join("");
}

function oncoming(y: number): string {
  const front = y + 52;
  return car(266, y, 28, 52, "back") + `<line x1="280" y1="${front + 2}" x2="280" y2="${front + 18}" class="move" marker-end="url(#ep08-ar)"/>`;
}

function turn(bad: boolean): string {
  const tone = bad ? "move bad" : "move";
  return `<path d="M360 378 C360 280, 280 215, 36 215" fill="none" class="${tone}" marker-end="url(#ep08-ar)"/>`;
}

function speed(): string {
  return [78, 108, 138].map((y) => `<polyline points="266,${y} 280,${y + 16} 294,${y}" fill="none" class="move bad"/>`).join("");
}

export function yieldScene(): string {
  const layers = [
    ["is-near", `${oncoming(118)}${turn(true)}`],
    ["is-far", `${oncoming(16)}${turn(false)}`],
    ["is-fast", `${oncoming(16)}${speed()}${turn(true)}`],
  ].map(([cls, body]) => `<g class="layer ${cls}">${body}</g>`).join("");
  const tabs = [
    ["ep08-near", true, "Близко"],
    ["ep08-far", false, "Далеко"],
    ["ep08-fast", false, "Далеко и быстро"],
  ] as const;
  const inputs = tabs.map(([id, on]) => `<input type="radio" name="ep08-yield" id="${id}"${on ? " checked" : ""}>`).join("");
  const labels = tabs.map(([id, , title]) => `<label for="${id}">${title}</label>`).join("");
  const captions = [
    ["is-near", "Встречная близко к пересечению путей. Поворот заставит её тормозить. Ждать."],
    ["is-far", "Она далеко, и поворот успевает закончиться раньше. Скорость и направление ей менять не нужно."],
    ["is-fast", "Та же даль, но она быстро приближается. К концу поворота ей придётся тормозить. Ждать."],
  ].map(([cls, text]) => `<p class="figcap layer ${cls}">${text}</p>`).join("");
  const svg = `<figure class="fig"><svg viewBox="0 0 640 480" role="img" aria-label="Перекрёсток: поворот налево перед встречной, которая едет прямо. Близко, далеко или далеко и быстро" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ep08-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${roads()}${layers}</svg></figure>`;
  return `<div class="scene">${inputs}<div class="scene-tabs">${labels}</div>${svg}${captions}</div>`;
}

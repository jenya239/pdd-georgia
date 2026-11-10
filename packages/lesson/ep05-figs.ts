function svg(w: number, h: number, body: string, label: string, uid: string): string {
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${body}</svg>`;
  out = out.replaceAll('id="ar"', `id="${uid}-ar"`).replaceAll("url(#ar)", `url(#${uid}-ar)`);
  return out;
}

function f(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function person(x: number, y: number, s = 1): string {
  const cy = (k: number) => f(y + k * s);
  const cx = (k: number) => f(x + k * s);
  return `<circle cx="${x}" cy="${cy(7)}" r="${f(7 * s)}" class="head"/><path d="M${x},${cy(14)} L${x},${cy(38)} M${x},${cy(20)} L${cx(-10)},${cy(32)} M${x},${cy(20)} L${cx(10)},${cy(32)} M${x},${cy(38)} L${cx(-8)},${cy(56)} M${x},${cy(38)} L${cx(8)},${cy(56)}" class="ppl"/>`;
}

function bike(x: number, y: number, r = 13): string {
  const d = 2.6 * r;
  return `<circle cx="${x}" cy="${y}" r="${r}" class="ppl"/><circle cx="${f(x + d)}" cy="${y}" r="${r}" class="ppl"/><path d="M${x},${y} L${f(x + d * 0.45)},${f(y - r * 1.2)} L${f(x + d * 0.9)},${f(y - r * 1.2)} L${f(x + d)},${y} M${f(x + d * 0.45)},${f(y - r * 1.2)} L${f(x + d * 0.5)},${y} L${x},${y} M${f(x + d * 0.9)},${f(y - r * 1.2)} L${f(x + d * 0.85)},${f(y - r * 1.8)}" class="ppl"/>`;
}

function wheelchair(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="15" class="ppl"/><circle cx="${x + 26}" cy="${y + 10}" r="5" class="ppl"/><circle cx="${x}" cy="${y - 46}" r="7" class="head"/><path d="M${x},${y - 39} L${x},${y - 18} L${x + 22},${y - 18} L${x + 24},${y + 4} M${x},${y - 32} L${x + 14},${y - 24} M${x - 12},${y - 28} L${x - 12},${y - 8}" class="ppl"/>`;
}

function carSide(x: number, y: number, w = 86): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="26" rx="7" class="car"/><rect x="${x + 18}" y="${y - 16}" width="${w - 38}" height="20" rx="6" class="car"/><rect x="${x + 24}" y="${y - 12}" width="${f((w - 50) / 2)}" height="13" rx="3" class="glass"/><circle cx="${x + 18}" cy="${y + 28}" r="8" class="head"/><circle cx="${x + w - 18}" cy="${y + 28}" r="8" class="head"/>`;
}

function roleRow(y: number, cls: string, title: string, verdict: string, cite: string, drawing: string): string {
  return `<rect x="8" y="${y}" width="624" height="104" rx="10" class="box ${cls}"/><text x="24" y="${y + 28}" class="t small">${title}</text><text x="24" y="${y + 56}" class="t">${verdict}</text><text x="24" y="${y + 84}" class="t small mut">${cite}</text>${drawing}`;
}

export function figRoles(): string {
  const rows = [
    roleRow(8, "hl", "Управляет машиной", "водитель", "ст. 5, п. 49", carSide(470, 48) + person(524, 8, 0.5)),
    roleRow(120, "eq", "Ведёт велосипед рядом", "пешеход", "ст. 5, п. 87", person(470, 128) + bike(510, 176, 11)),
    roleRow(232, "eq", "В инвалидной коляске", "пешеход", "ст. 5, п. 87", wheelchair(500, 292)),
    roleRow(344, "hl", "Входит в машину", "пассажир", "ст. 5, п. 34", `<rect x="500" y="360" width="90" height="64" rx="8" class="car"/>` + person(470, 352, 0.7)),
    roleRow(456, "hl", "Инструктор, идёт учебная езда", "приравнен к водителю", "ст. 5, п. 49", carSide(470, 496) + person(500, 456, 0.45) + person(530, 456, 0.45)),
    roleRow(568, "hl", "Регулировщик", "управляет движением", "ст. 5, п. 32", person(520, 576) + `<line x1="530" y1="608" x2="560" y2="586" class="ppl"/>`),
  ];
  return svg(640, 680, rows.join(""), "Роль зависит от действия. Регулировщик управляет движением: это не четвёртая роль участника", "ep05-roles");
}

export function figOutside(): string {
  const w = 660;
  const h = 360;
  let body = `<rect x="0" y="0" width="${w}" height="${h}" class="verge"/>`;
  body += `<rect x="0" y="62" width="${w}" height="26" class="bed"/><rect x="0" y="228" width="${w}" height="26" class="bed"/>`;
  body += `<rect x="0" y="88" width="${w}" height="140" class="road"/>`;
  body += `<line x1="0" y1="158" x2="${w}" y2="158" class="paint dash"/>`;
  body += `<rect x="470" y="104" width="74" height="36" rx="8" class="car"/><line x1="462" y1="122" x2="410" y2="122" class="move" marker-end="url(#ar)"/>`;
  body += `<rect x="60" y="176" width="74" height="36" rx="8" class="car"/><line x1="142" y1="194" x2="194" y2="194" class="move" marker-end="url(#ar)"/>`;
  body += person(250, 30, 0.75) + `<line x1="266" y1="56" x2="306" y2="56" class="move" marker-end="url(#ar)"/>`;
  body += `<text x="290" y="22" class="t small">пешеход: обочина слева, навстречу движению</text>`;
  body += person(300, 166, 0.75) + bike(318, 212, 10);
  body += `<line x1="372" y1="200" x2="412" y2="200" class="move" marker-end="url(#ar)"/>`;
  body += wheelchair(470, 212);
  body += `<text x="12" y="280" class="t small">ведёт велосипед, мопед, мотоцикл; в инвалидной коляске —</text><text x="12" y="300" class="t small">по правой стороне проезжей части</text>`;
  body += `<text x="12" y="324" class="t small mut">ст. 24, п. 5: вне населённого пункта, двустороннее движение,</text><text x="12" y="344" class="t small mut">нет разделительной полосы и тротуара</text>`;
  body += `<text x="12" y="80" class="t small mut">обочина</text><text x="12" y="246" class="t small mut">обочина</text>`;
  return svg(w, h, body, "Вне населённого пункта пешеход идёт по обочине навстречу движению, а ведущий велосипед и человек в инвалидной коляске — по правой стороне проезжей части", "ep05-out");
}

export function figBoarding(): string {
  const w = 660;
  let body = `<rect x="0" y="0" width="${w}" height="70" class="walk"/><text x="12" y="26" class="t small mut">тротуар</text>`;
  body += `<rect x="0" y="70" width="${w}" height="200" class="road"/><line x1="0" y1="170" x2="${w}" y2="170" class="paint dash"/>`;
  body += `<rect x="200" y="82" width="150" height="70" rx="12" class="car"/><rect x="216" y="90" width="34" height="54" rx="5" class="glass"/>`;
  body += `<line x1="262" y1="82" x2="300" y2="56" class="ppl"/><line x1="262" y1="152" x2="300" y2="178" class="ppl"/>`;
  body += person(300, 4, 0.6) + `<text x="318" y="30" class="t small ok">сначала — сторона тротуара</text>`;
  body += person(300, 178, 0.6) + `<text x="318" y="212" class="t small warn">со стороны дороги — если иначе нельзя</text><text x="318" y="232" class="t small warn">и без помех другим</text>`;
  body += `<rect x="20" y="186" width="70" height="34" rx="8" class="car"/><line x1="96" y1="203" x2="150" y2="203" class="move" marker-end="url(#ar)"/>`;
  body += `<text x="12" y="290" class="t small mut">ст. 23, п. 1: садиться и выходить — после полной остановки</text>`;
  return svg(w, 300, body, "Посадка и высадка: сначала со стороны тротуара, со стороны проезжей части — только если иначе нельзя и нет помех", "ep05-board");
}

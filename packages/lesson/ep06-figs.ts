function svg(w: number, h: number, body: string, label: string, uid: string): string {
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${body}</svg>`;
  out = out.replaceAll('id="ar"', `id="${uid}-ar"`).replaceAll("url(#ar)", `url(#${uid}-ar)`);
  return out;
}

function f(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function node(x: number, y: number, w: number, txt: string, cls = "", sub = ""): string {
  const h = sub ? 46 : 32;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="box ${cls}"/>`;
  out += `<text x="${f(x + w / 2)}" y="${y + 21}" text-anchor="middle" class="t small">${txt}</text>`;
  if (sub) out += `<text x="${f(x + w / 2)}" y="${y + 38}" text-anchor="middle" class="t small mut">${sub}</text>`;
  return out;
}

function edge(x1: number, y1: number, x2: number, y2: number): string {
  const mid = f((y1 + y2) / 2);
  return `<path d="M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}" class="tree"/>`;
}

export function figTree(): string {
  const w = 680;
  const h = 330;
  let body = node(240, 8, 200, "Транспортное средство", "hl", "п. 73");
  body += edge(340, 54, 120, 92) + edge(340, 54, 340, 92) + edge(340, 54, 570, 92);
  body += node(20, 92, 200, "Без двигателя", "", "велосипед п. 22, гужевой п. 78");
  body += node(240, 92, 200, "Механическое (самоход)", "hl", "с двигателем, п. 35");
  body += node(460, 92, 210, "С двигателем, но НЕ механ.", "no", "исключения п. 35");
  body += edge(340, 138, 110, 180) + edge(340, 138, 270, 180) + edge(340, 138, 420, 180);
  body += node(20, 180, 180, "Автомобиль, п. 5", "", "троллейбус да, трактор нет");
  body += node(210, 180, 120, "Мопед", "", "п. 42");
  body += node(340, 180, 120, "Мотоцикл", "", "п. 44");
  body += node(476, 180, 194, "электросамокат", "no", "п. 56");
  body += node(476, 232, 194, "велосипед с подв. двиг.", "no", "п. 28 → велосипед");
  body += node(476, 284, 194, "рельсовое: трамвай", "no", "п. 40 (электротранспорт)");
  body += `<text x="20" y="262" class="t small mut">Прицеп (п. 39) — тоже ТС,</text><text x="20" y="282" class="t small mut">хотя сам «движется» только</text><text x="20" y="302" class="t small mut">с помощью «иной силы» — тягача.</text>`;
  return svg(w, h, body, "Дерево определений: транспортное средство, механическое, исключения из механических", "ep06-tree");
}

export function figScale(): string {
  const w = 680;
  const h = 330;
  const x0 = 40;
  const k = 12;
  const x = (v: number) => x0 + v * k;
  let body = `<line x1="${x(0)}" y1="270" x2="${x(50)}" y2="270" class="tree"/>`;
  for (const v of [0, 25, 40, 45]) body += `<line x1="${x(v)}" y1="264" x2="${x(v)}" y2="276" class="tree"/><text x="${x(v)}" y="294" text-anchor="middle" class="t small">${v}</text>`;
  body += `<text x="${x(50)}" y="318" text-anchor="end" class="t small mut">км/ч (конструктивная скорость)</text>`;
  const rows: [number, number, string, string, string][] = [
    [0, 25, "eq", "велосипед с подвесным двигателем: ≤ 50 см³ или электро ≤ 4 кВт", "п. 28"],
    [25, 45, "eq", "…он же до 45 км/ч, если электромотор ≤ 1 кВт", "п. 28"],
    [25, 45, "hl", "мопед: ≤ 50 см³ или электро > 1 и ≤ 4 кВт", "п. 42"],
    [45, 50, "no", "мотоцикл: > 45 км/ч или > 50 см³", "п. 44"],
    [0, 40, "", "тихоходное ТС: ≤ 40 км/ч", "п. 53"],
  ];
  rows.forEach(([a, z, cls, txt, cite], i) => {
    const y = 8 + i * 50;
    body += `<text x="${x0}" y="${y + 14}" class="t small">${txt} <tspan class="mut">(${cite})</tspan></text>`;
    body += `<rect x="${x(a)}" y="${y + 22}" width="${(z - a) * k}" height="20" rx="5" class="box ${cls}"/>`;
  });
  return svg(w, h, body, "Шкала конструктивной скорости: велосипед с подвесным двигателем до 25 или до 45 при малой мощности, мопед 25–45, мотоцикл свыше 45, тихоходное до 40", "ep06-scale");
}

export function figTram(): string {
  const w = 520;
  const h = 460;
  const c = 260;
  let body = `<rect x="0" y="0" width="${w}" height="${h}" class="verge"/>`;
  body += `<rect x="${c - 70}" y="0" width="140" height="${h}" class="road"/><rect x="0" y="${c - 70}" width="${w}" height="140" class="road"/>`;
  body += `<line x1="${c}" y1="0" x2="${c}" y2="${c - 70}" class="paint dash"/><line x1="${c}" y1="${c + 70}" x2="${c}" y2="${h}" class="paint dash"/>`;
  body += `<line x1="0" y1="${c}" x2="${c - 70}" y2="${c}" class="paint dash"/><line x1="${c + 70}" y1="${c}" x2="${w}" y2="${c}" class="paint dash"/>`;
  body += `<line x1="0" y1="${c + 24}" x2="${w}" y2="${c + 24}" class="rail"/><line x1="0" y1="${c + 46}" x2="${w}" y2="${c + 46}" class="rail"/>`;
  body += `<rect x="${c - 236}" y="${c + 12}" width="130" height="46" rx="8" class="car tram"/><text x="${c - 171}" y="${c + 41}" text-anchor="middle" class="t">Т</text>`;
  body += `<line x1="${c - 98}" y1="${c + 35}" x2="${c - 50}" y2="${c + 35}" class="move" marker-end="url(#ar)"/>`;
  body += `<rect x="${c + 12}" y="${c + 110}" width="40" height="66" rx="8" class="car"/><text x="${c + 32}" y="${c + 149}" text-anchor="middle" class="t small">A</text>`;
  body += `<line x1="${c + 32}" y1="${c + 102}" x2="${c + 32}" y2="${c + 76}" class="move" marker-end="url(#ar)"/>`;
  body += `<rect x="4" y="6" width="412" height="88" rx="8" class="box"/>`;
  body += `<text x="12" y="24" class="t small">Равнозначные дороги, знаков и светофора нет.</text>`;
  body += `<text x="12" y="44" class="t small">Трамвай слева от A, но едет первым:</text>`;
  body += `<text x="12" y="64" class="t small ok">рельсовое ТС имеет преимущество (ст. 36, п. 4 «в»)</text>`;
  body += `<text x="12" y="84" class="t small mut">правило правой руки — только между безрельсовыми</text>`;
  return svg(w, h, body, "Перекрёсток равнозначных дорог: трамвай приближается слева от автомобиля и проезжает первым", "ep06-tram");
}

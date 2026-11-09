function svg(label: string, height: number, body: string): string {
  return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function box(x: number, y: number, w: number, h: number, cls: string, title: string, note: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="box ${cls}"/><text x="${x + w / 2}" y="${y + 32}" text-anchor="middle" class="t small">${title}</text><text x="${x + w / 2}" y="${y + 54}" text-anchor="middle" class="t small mut">${note}</text>`;
}

export function figYield(): string {
  return svg("Поворот, который ломает движение машины с преимуществом, и тот же поворот после ожидания", 160, [
    box(16, 48, 310, 88, "no", "выехали сразу", "встречному пришлось тормозить"),
    box(354, 48, 310, 88, "hl", "подождали", "встречный проехал как ехал"),
    `<text x="16" y="28" class="t small mut">Уступить — не заставить машину с преимуществом неожиданно менять скорость.</text>`,
  ].join(""));
}

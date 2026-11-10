function svg(label: string, height: number, body: string): string {
  return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ep08-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${body}</svg>`;
}

function car(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="car"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${Math.round(h * 0.35)}" rx="2" class="glass"/>`;
}

function road(x: number): string {
  return `<rect x="${x}" y="40" width="316" height="168" rx="8" class="road"/><line x1="${x + 8}" y1="124" x2="${x + 308}" y2="124" class="paint dash"/>`;
}

export function figYield(): string {
  const left = [
    road(12),
    car(210, 78, 52, 24),
    `<line x1="206" y1="90" x2="168" y2="90" class="move" marker-end="url(#ep08-ar)"/>`,
    car(36, 146, 52, 24),
    `<polyline points="90,158 150,158 150,102" fill="none" class="move bad" marker-end="url(#ep08-ar)"/>`,
    `<text x="24" y="28" class="t small">близко</text>`,
    `<text x="24" y="232" class="t small bad">выезд заставляет её тормозить</text>`,
  ].join("");
  const right = [
    road(352),
    car(590, 78, 52, 24),
    `<line x1="586" y1="90" x2="540" y2="90" class="move" marker-end="url(#ep08-ar)"/>`,
    car(376, 146, 52, 24),
    `<polyline points="430,158 500,158 500,102" fill="none" class="move" marker-end="url(#ep08-ar)"/>`,
    `<text x="364" y="28" class="t small">далеко</text>`,
    `<text x="364" y="232" class="t small ok">поворот её движение не меняет</text>`,
  ].join("");
  return svg("Два левых поворота перед встречной: близкая машина вынуждена тормозить, далёкая продолжает как ехала", 250, left + right);
}

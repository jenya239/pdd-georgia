function svg(label: string, height: number, body: string): string {
  return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function box(x: number, y: number, w: number, h: number, cls: string, title: string, note: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="box ${cls}"/><text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" class="t small">${title}</text><text x="${x + w / 2}" y="${y + 48}" text-anchor="middle" class="t small mut">${note}</text>`;
}

export function figDuration(): string {
  return svg("Три срока одного и того же преднамеренного прекращения движения", 168, [
    box(16, 36, 200, 72, "hl", "до 5 минут", "остановка, п. 11"),
    box(236, 36, 210, 72, "hl", "дольше, ради посадки", "всё ещё остановка"),
    box(466, 36, 198, 72, "", "дольше, другая цель", "стоянка, п. 20"),
    `<text x="16" y="24" class="t small mut">Водитель остановился сам. До пяти минут цель не спрашивают.</text>`,
  ].join(""));
}

export function figExcluded(): string {
  return svg("Остановкой считается преднамеренный перерыв, а не ожидание в потоке или по сигналу", 188, [
    box(16, 56, 200, 72, "no", "в потоке", "не остановка"),
    box(236, 56, 210, 72, "no", "красный сигнал", "не остановка"),
    box(466, 56, 198, 72, "hl", "сам выбрал", "остановка, п. 11"),
    `<text x="16" y="22" class="t small mut">Остановкой считается преднамеренный перерыв,</text>`,
    `<text x="16" y="40" class="t small mut">а не ожидание в потоке или по сигналу.</text>`,
  ].join(""));
}

export function figForced(): string {
  return svg("Четыре причины вынужденной остановки, срок не участвует", 168, [
    box(16, 48, 156, 80, "", "поломка", "п. 26"),
    box(180, 48, 156, 80, "", "опасность груза", "п. 26"),
    box(344, 48, 156, 80, "", "состояние людей", "водитель, пассажир"),
    box(508, 48, 156, 80, "hl", "препятствие", "появилось внезапно"),
    `<text x="16" y="28" class="t small mut">Намерения нет. Пять минут здесь ни при чём.</text>`,
  ].join(""));
}

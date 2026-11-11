function car(): string {
  return `<rect x="0" y="0" width="640" height="180" class="verge"/><rect x="0" y="108" width="640" height="72" class="road"/><rect x="0" y="78" width="640" height="30" class="bed"/><rect x="48" y="86" width="150" height="36" rx="8" class="car"/><rect x="78" y="68" width="86" height="24" rx="6" class="car"/><circle cx="84" cy="126" r="10" class="head"/><circle cx="168" cy="126" r="10" class="head"/>`;
}

function plate(reason: string, name: string): string {
  return `<text x="240" y="78" class="t small">${reason}</text><text x="240" y="114" class="t small">${name}</text>`;
}

export function pauseScene(): string {
  const layers = [
    ["is-unload", plate("10 мин, разгрузка", "остановка")],
    ["is-shop", plate("10 мин, покупки", "стоянка")],
    ["is-broke", plate("поломка", "вынужденная остановка")],
    ["is-jam", plate("стоит в потоке", "не остановка")],
  ].map(([cls, body]) => `<g class="layer ${cls}">${body}</g>`).join("");
  const tabs = [
    ["ep07-unload", true, "Разгрузка"],
    ["ep07-shop", false, "Магазин"],
    ["ep07-broke", false, "Поломка"],
    ["ep07-jam", false, "Пробка"],
  ];
  const inputs = tabs.map(([id, on]) => `<input type="radio" name="ep07-pause" id="${id}"${on ? " checked" : ""}>`).join("");
  const labels = tabs.map(([id, , title]) => `<label for="${id}">${title}</label>`).join("");
  const captions = [
    ["is-unload", "Десять минут уходят на разгрузку. Это остановка."],
    ["is-shop", "Десять минут, и водитель ушёл за покупками. Это стоянка."],
    ["is-broke", "Причина вынуждает прекратить движение. Продолжительность категорию не определяет."],
    ["is-jam", "Ожидание в потоке — не остановка по пункту 11. Место на дороге от этого не становится любым."],
  ].map(([cls, text]) => `<p class="figcap layer ${cls}">${text}</p>`).join("");
  const svg = `<figure class="fig"><svg viewBox="0 0 640 180" role="img" aria-label="Автомобиль у обочины: разгрузка, покупки, поломка или поток" xmlns="http://www.w3.org/2000/svg">${car()}${layers}</svg></figure>`;
  return `<div class="scene">${inputs}<div class="scene-tabs">${labels}</div>${svg}${captions}</div>`;
}

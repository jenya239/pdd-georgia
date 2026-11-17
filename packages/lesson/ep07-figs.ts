function car(): string {
  return `<rect x="0" y="0" width="640" height="180" class="verge"/><rect x="0" y="108" width="640" height="72" class="road"/><rect x="0" y="78" width="640" height="30" class="bed"/><rect x="48" y="86" width="150" height="36" rx="8" class="car"/><rect x="78" y="68" width="86" height="24" rx="6" class="car"/><circle cx="84" cy="126" r="10" class="head"/><circle cx="168" cy="126" r="10" class="head"/>`;
}

function plate(reason: string, name: string): string {
  return `<text x="240" y="78" class="t small">${reason}</text><text x="240" y="114" class="t small">${name}</text>`;
}

export function pauseScene(kind: "unload" | "shop" | "jam" | "broke" = "unload"): string {
  const variants = {
  "unload": [
    "10 мин, разгрузка",
    "остановка",
    "Разгрузка длится десять минут, но это по-прежнему остановка."
  ],
  "shop": [
    "10 мин, покупки",
    "стоянка",
    "Те же десять минут водитель потратил на покупки: теперь это стоянка."
  ],
  "jam": [
    "стоит в потоке",
    "не остановка",
    "Ожидание в пробке не считается остановкой по определению закона."
  ],
  "broke": [
    "поломка",
    "вынужденная остановка",
    "Поломка прерывает движение независимо от продолжительности паузы."
  ]
} as const;
  const [reason, name, caption] = variants[kind];
  const svg = `<figure class="fig"><svg viewBox="0 0 640 180" role="img" aria-label="Автомобиль у обочины: ${caption}" xmlns="http://www.w3.org/2000/svg">${car()}${plate(reason, name)}</svg></figure>`;
  return `${svg}<p class="figcap">${caption}</p>`;
}

const WHO = { a: "Аня", m: "Макс", t: "Сергей Павлович" } as const;

export function chat(...lines: [keyof typeof WHO, string][]): string {
  return `<div class="chat">${lines.map(([who, text]) => `<div class="say ${who}"><span class="ava" aria-hidden="true">${WHO[who][0]}</span><div class="bub"><b class="who">${WHO[who]}</b>${text}</div></div>`).join("")}</div>`;
}

export function lq(text: string, cite: string, src = "law"): string {
  return `<blockquote class="lq" data-src="${src}"><p>«${text}»</p><cite>${cite}</cite></blockquote>`;
}

export function fig(svg: string, caption: string): string {
  return `<figure class="fig">${svg}<figcaption>${caption}</figcaption></figure>`;
}

export function gl(term: string, expl: string): string {
  return `<span class="gl"><b>${term}</b> — ${expl}</span>`;
}

export function signrow(items: [string, string, string][], imgDir: string, caption: string): string {
  const cells = items.map(([file, name, note]) => `<div class="sg"><span class="sgimg"><img src="${imgDir}${file}.png" alt="Знак ${name}" loading="lazy"></span><b>${name}</b><span>${note}</span></div>`).join("");
  return `<figure class="signs">${cells}<figcaption>${caption}</figcaption></figure>`;
}

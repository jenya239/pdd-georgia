/** String fragments for a lesson edition. Quotes passed to `lq` must be copied from the statute. */

export const MARKER = "<!--AFTER-TICKETS-->";

export function lq(text, cite, src = "law") {
  return `<blockquote class="lq" data-src="${src}"><p>«${text}»</p><cite>${cite}</cite></blockquote>`;
}

export function figure(svg, cap) {
  return `<figure class="fig">${svg}<figcaption>${cap}</figcaption></figure>`;
}

export function gl(term, expl) {
  return `<span class="gl"><b>${term}</b> — ${expl}</span>`;
}

export function ask(question) {
  return `<aside class="ask"><p><b>Вопрос.</b> ${question}</p></aside>`;
}

export function signrow(items, imgDir, caption) {
  const cells = items.map(([file, n, c]) =>
    `<div class="sg"><span class="sgimg"><img src="${imgDir}${file}.png" alt="Знак ${n}" loading="lazy"></span><b>${n}</b><span>${c}</span></div>`).join("");
  return `<figure class="signs">${cells}<figcaption>${caption}</figcaption></figure>`;
}

export function lesson(parts) {
  return parts.join("\n") + "\n";
}

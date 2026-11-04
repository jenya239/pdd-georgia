import { existsSync, readFileSync } from "node:fs";
import { slug } from "../lesson/slug.ts";
import { citation, escapeHtml, excerpt } from "./cite.ts";
import { allNorms, linkedRu, type Norm } from "./text.ts";

const VERSION = "Закон Грузии «О дорожном движении» № 1830-რს, консолидированная редакция 25.06.2026 (Matsne, публикация 36)";
const MATSNE = "https://www.matsne.gov.ge";
const MISSING_ON_ARTICLE = "<i>текст отсутствует</i>";
const MISSING_ON_PAGE = "<i>Русского текста этой нормы в переводе Matsne нет.</i>";

export type Backlink = {
  lessons: [string, string[]][];
  concepts: { label: string; intro: number | null }[];
  misconceptions: { belief: string; truth: string }[];
  tickets: number[];
  items: { id: string; q: string }[];
  cited: string[];
};

const norms = allNorms();
const byId = new Map(norms.map((item) => [item.id, item]));
const episodes = new Map(
  (JSON.parse(readFileSync("content/episodes.json", "utf8")) as { id: string; num: number; title: string }[])
    .map((item) => [item.id, item]),
);

function groupKey(norm: Norm): string | null {
  if (norm.parent) return norm.parent;
  if (!norm.id.startsWith("A")) return null;
  const colon = norm.id.indexOf(":");
  return `A${norm.id.slice(1, colon)}:§${norm.id.slice(colon + 1).split(".")[0]}`;
}

const grouped = new Map<string, Norm[]>();
for (const item of norms) {
  const key = groupKey(item);
  if (key === null) {
    const roots = grouped.get("") ?? [];
    roots.push(item);
    grouped.set("", roots);
    continue;
  }
  const kids = grouped.get(key) ?? [];
  kids.push(item);
  grouped.set(key, kids);
}

function kidsOf(id: string): Norm[] {
  return grouped.get(id) ?? [];
}

function imageName(norm: Norm): string | null {
  if (!norm.id.startsWith("A") || norm.id.includes("прим")) return null;
  const colon = norm.id.indexOf(":");
  const annex = norm.id.slice(1, colon);
  const item = norm.id.slice(colon + 1);
  const name = `${annex === "1" ? "sign_" : "mark_"}${item.replaceAll(".", "_")}.png`;
  return existsSync(`content/assets/signs/${name}`) ? name : null;
}

function articleTitle(norm: Norm): string {
  if (!norm.id.startsWith("A") && norm.article) {
    const article = byId.get(norm.article);
    if (article) return `Статья ${article.article}. ${article.title}`;
  }
  const annex = norm.annex === 1 ? "дорожные знаки" : "дорожная разметка";
  return `Приложение ${norm.annex} (${annex})`;
}

function shell(title: string, body: string, desc: string, script: string, attr = ""): string {
  return `<!doctype html><html lang="ru" data-root="../"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeHtml(title)} — ПДД Грузии</title><meta name="description" content="${escapeHtml(desc)}"><link rel="icon" href="data:,"><link rel="stylesheet" href="../assets/app.css"></head>\n<body><main class="normpage"${attr}>\n${body}\n</main>\n<script type="module" src="../assets/pages/${script}"></script></body></html>\n`;
}

function crumbs(norm: Norm): string {
  const chain: string[] = [];
  let current = norm.parent;
  while (current) {
    chain.push(current);
    current = byId.get(current)?.parent ?? null;
  }
  const parts = [`<a href="index.html">Закон</a>`];
  if (norm.id.startsWith("A")) parts.push(`<a href="index.html#annex${norm.annex}">Приложение ${norm.annex}</a>`);
  for (const id of chain.reverse()) {
    const item = byId.get(id);
    if (item) parts.push(`<a href="${slug(id)}.html">${escapeHtml(citation(item))}</a>`);
  }
  return `<nav class="crumbs small" aria-label="Положение в законе">${parts.join(" › ")}</nav>`;
}

function backlinks(norm: Norm, link: Backlink | undefined): string {
  const data = link ?? { lessons: [], concepts: [], misconceptions: [], tickets: [], items: [], cited: [] };
  const out = [`<section class="backlinks"><h2>Где это в курсе</h2>`];
  const empty = !data.lessons.length && !data.concepts.length && !data.misconceptions.length && !data.tickets.length && !data.items.length && !data.cited.length;
  if (empty) out.push(`<p class="small mut">Пока ни один урок, вопрос или билет не опирается на эту норму.</p>`);
  if (data.lessons.length) {
    const rows = data.lessons.map(([id, how]) => {
      const episode = episodes.get(id);
      return `<li><a href="../episode.html?id=${id}">Выпуск ${episode?.num}. ${escapeHtml(episode?.title ?? "")}</a> <span class="small mut">— ${how.join(", ")}</span></li>`;
    }).join("");
    out.push(`<h3>Уроки</h3><ul>${rows}</ul>`);
  }
  if (data.concepts.length) {
    const rows = data.concepts.map((item) => `<li>${escapeHtml(item.label)}${item.intro === null ? "" : ` <span class="small mut">— вводится в выпуске ${item.intro}</span>`}</li>`).join("");
    out.push(`<h3>Понятия курса</h3><ul>${rows}</ul>`);
  }
  if (data.misconceptions.length) {
    const rows = data.misconceptions.map((item) => `<li>«${escapeHtml(item.belief)}» — <b>как правильно:</b> ${escapeHtml(item.truth)}</li>`).join("");
    out.push(`<h3>Типичные ошибки</h3><ul>${rows}</ul>`);
  }
  if (data.items.length) {
    const ids = data.items.map((item) => item.id).join(",");
    const rows = data.items.map((item) => `<li><a href="../practice.html?ids=${escapeHtml(item.id)}">${escapeHtml(item.q)}</a></li>`).join("");
    const all = data.items.length > 1 ? `<p><a class="btn ghost" href="../practice.html?ids=${escapeHtml(ids)}">Решить все</a></p>` : "";
    out.push(`<h3>Наши вопросы (${data.items.length})</h3><ul>${rows}</ul>${all}`);
  }
  if (data.tickets.length) {
    const ids = data.tickets.join(",");
    const rows = data.tickets.map((id) => `<a href="../practice.html?ids=${id}">№ ${id}</a>`).join(" ");
    out.push(`<h3>Билеты, которые на неё ссылаются (${data.tickets.length})</h3><p class="tlist">${rows}</p><p><a class="btn ghost" href="../practice.html?ids=${ids}">Решить эти билеты</a></p><p class="small mut">По ссылкам на закон в пояснениях базы (с учётом наших уточнений онтологии).</p>`);
  }
  if (data.cited.length) {
    const rows = data.cited.map((id) => {
      const item = byId.get(id);
      return `<li><a class="nref" href="${slug(id)}.html" data-norm="${slug(id)}">${escapeHtml(item ? citation(item) : id)}</a></li>`;
    }).join("");
    out.push(`<h3>Ссылаются в законе</h3><ul>${rows}</ul>`);
  }
  out.push(`</section>`);
  return out.join("");
}

function page(norm: Norm, link: Backlink | undefined): string {
  const id = slug(norm.id);
  const cite = citation(norm);
  const parts = [crumbs(norm)];
  if (norm.kind === "article") {
    parts.push(`<h1>Статья ${escapeHtml(norm.article ?? "")}. ${escapeHtml(norm.title ?? "")}</h1>`);
    parts.push(`<p class="small mut" lang="ka">${escapeHtml(norm.title_ka ?? "")}</p>`);
  } else {
    parts.push(`<h1>${escapeHtml(cite)}</h1>`);
    parts.push(`<p class="small mut">${escapeHtml(articleTitle(norm))}</p>`);
  }
  parts.push(`<p class="small mut nver">${escapeHtml(VERSION)}. Юридическую силу имеет грузинский текст, русский — перевод. Источник: <a href="${MATSNE}/ru/document/view/2169396?publication=36" rel="noopener">Matsne (рус.)</a>, <a href="${MATSNE}/ka/document/view/2169396?publication=36" rel="noopener">Matsne (груз.)</a>.</p>`);
  const image = imageName(norm);
  if (image) parts.push(`<figure class="nimg"><img src="img/${image}" alt="${escapeHtml(cite)}"></figure>`);
  const kids = kidsOf(norm.id);
  if (norm.kind === "article") {
    const rows = kids.map((child) => `<li id="${slug(child.id)}"><a class="ncite" href="${slug(child.id)}.html">${escapeHtml(citation(child))}</a><div class="lawtext" lang="ru">${linkedRu(child, MISSING_ON_ARTICLE)}</div></li>`).join("");
    parts.push(`<section class="ntext"><h2>Текст статьи (рус.)</h2><ol class="npars">${rows}</ol></section>`);
  } else {
    parts.push(`<section class="ntext"><h2>Текст (рус., дословно)</h2><div class="lawtext" lang="ru">${linkedRu(norm, MISSING_ON_PAGE)}</div></section>`);
    if (norm.ka) parts.push(`<section class="ntext"><h2>Официальный текст (груз.)</h2><div class="lawtext ka" lang="ka">${escapeHtml(norm.ka)}</div></section>`);
    if (norm.en) {
      parts.push(`<details class="ntext en"><summary>English — official translation of 28.06.2019 (перевод 2019 г., может не совпадать с действующей редакцией)</summary><div class="lawtext" lang="en">${escapeHtml(norm.en)}</div><p class="small mut"><a href="${MATSNE}/en/document/view/2169396" rel="noopener">Matsne (англ.)</a></p></details>`);
    }
    if (kids.length) {
      const rows = kids.map((child) => `<li><a class="nref" href="${slug(child.id)}.html" data-norm="${slug(child.id)}">${escapeHtml(citation(child))}</a> <span class="small mut">${escapeHtml(excerpt(child.ru ?? "", 90))}</span></li>`).join("");
      parts.push(`<h2>Подпункты</h2><ul class="nkids">${rows}</ul>`);
    }
  }
  const siblings = grouped.get(groupKey(norm) ?? "") ?? [];
  const index = siblings.findIndex((item) => item.id === norm.id);
  const nav = [];
  if (norm.parent) {
    const parent = byId.get(norm.parent);
    if (parent) nav.push(`<a class="btn ghost" href="${slug(parent.id)}.html">↑ ${escapeHtml(citation(parent))}</a>`);
  }
  if (index > 0) nav.push(`<a class="btn ghost" href="${slug(siblings[index - 1].id)}.html" rel="prev">← ${escapeHtml(citation(siblings[index - 1]))}</a>`);
  if (index >= 0 && index + 1 < siblings.length) nav.push(`<a class="btn ghost" href="${slug(siblings[index + 1].id)}.html" rel="next">${escapeHtml(citation(siblings[index + 1]))} →</a>`);
  parts.push(`<nav class="row nnav" aria-label="Соседние нормы">${nav.join("")}</nav>`);
  parts.push(backlinks(norm, link));
  parts.push(`<p class="small nperm">Постоянная ссылка: <code>norm/${id}.html</code> <button class="iconbtn" id="copylink" type="button">Копировать ссылку</button></p>`);
  const label = norm.kind === "article" ? `Статья ${norm.article}. ${norm.title}` : cite;
  return shell(label, parts.join("\n"), excerpt(norm.ru || norm.title || cite, 150), "norm.mjs", ` data-norm="${id}"`);
}

function depth(id: string): number {
  if (!id.startsWith("A")) return id.split(".").length - 1;
  const note = id.split("прим")[1];
  return note === undefined ? 1 : 1 + note.split(".").length - 1;
}

function index(): string {
  const row = (norm: Norm) => {
    const id = slug(norm.id);
    const label = norm.kind === "article" ? `Статья ${norm.article}. ${norm.title}` : citation(norm);
    const extra = norm.kind === "article" ? "" : ` <span class="mut">${escapeHtml(excerpt(norm.ru ?? "", 100))}</span>`;
    return `<li class="d${depth(norm.id)}" data-id="${id}"><a href="${id}.html">${escapeHtml(label)}</a>${extra}</li>`;
  };
  const law = norms.filter((item) => !item.id.startsWith("A"));
  const annex = [1, 2].map((number) => norms.filter((item) => item.id.startsWith("A") && item.annex === number));
  const parts = [
    `<h1>Закон о дорожном движении: все нормы</h1>`,
    `<p class="small mut">${escapeHtml(VERSION)}. У каждой статьи, пункта, подпункта, знака, разметки и примечания — своя постоянная страница: текст на русском (дословно), грузинском и, где есть, английском (перевод 2019 г.), и где эта норма встречается в курсе.</p>`,
    `<div class="row nsearch"><label>Поиск: <input type="search" id="nq" placeholder="ст. 37, п. 6 · 5.19.1 · остановка" autocomplete="off"></label><span class="small mut" id="ncount"></span></div>`,
    `<h2 id="law">Статьи закона</h2><ul class="nindex" id="nlist">`,
    ...law.map(row),
    `</ul>`,
  ];
  ["Приложение 1. Дорожные знаки", "Приложение 2. Дорожная разметка"].forEach((title, index) => {
    parts.push(`<h2 id="annex${index + 1}">${title}</h2><ul class="nindex">${annex[index].map(row).join("")}</ul>`);
  });
  parts.push(`<p class="small mut">Схема адресов: <code>st5</code> — статья 5; <code>st5-p13</code> — ст. 5, п. 13; <code>st37-p6-a-a</code> — подпункт «а.а»; <code>st11_1</code> — статья 11¹; <code>sign-5.26</code> — знак 5.26; <code>mark-1.14.1</code> — разметка 1.14.1; <code>sign-1-notes-b</code> — прил. 1, примечание «б» к разделу 1. Адреса не меняются при пересборке.</p>`);
  return shell("Закон: все нормы", parts.join("\n"), "Все статьи, пункты, знаки и разметка закона Грузии о дорожном движении", "normindex.mjs");
}

function chunkOf(id: string): string {
  if (id.startsWith("st")) return id.split("-")[0];
  const [head, rest] = id.split("-");
  return `${head}-${/^\d+/u.exec(rest)?.[0] ?? ""}`;
}

function chunks(): Record<string, string> {
  const groups = new Map<string, Record<string, unknown>>();
  for (const norm of norms) {
    const id = slug(norm.id);
    const bucket = groups.get(chunkOf(id)) ?? {};
    if (norm.kind === "article") {
      bucket[id] = { c: `Статья ${norm.article}. ${norm.title}`, ru: `Пунктов в статье: ${kidsOf(norm.id).length}. Полный текст — на странице статьи.` };
    } else {
      const entry: Record<string, string> = { c: citation(norm), t: articleTitle(norm), ru: norm.ru || "" };
      if (!entry.ru && norm.ka) entry.ka = norm.ka;
      const image = imageName(norm);
      if (image) entry.img = `img/${image}`;
      bucket[id] = entry;
    }
    groups.set(chunkOf(id), bucket);
  }
  return Object.fromEntries([...groups].map(([name, value]) => [`norm/chunks/${name}.json`, JSON.stringify(value)]));
}

export function normFiles(backlinksById: Record<string, Backlink>): Record<string, string> {
  const files: Record<string, string> = {};
  for (const norm of norms) files[`norm/${slug(norm.id)}.html`] = page(norm, backlinksById[norm.id]);
  files["norm/index.html"] = index();
  Object.assign(files, chunks());
  return files;
}

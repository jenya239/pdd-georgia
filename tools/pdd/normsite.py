"""Norm permalinks: static pages docs/norm/<slug>.html, the index docs/norm/index.html, lazy pop-up chunks
docs/norm/chunks/<chunk>.json, and auto-linking of norm references in all site content.

    link_content(...)  annotates lessons / data in place, returns the Linker (stats, mentions)
    norm_files(...)    → {relpath: text}, {relpath: source image}"""
import html as htmlmod
import json
import re

from pdd import normref, paths
from pdd.normids import slug, chunk_of, citation
from pdd.normlink import Linker, render_linked
from pdd.ontology import covers_id

MATSNE = "https://www.matsne.gov.ge/{lang}/document/view/2169396?publication=36"
MATSNE_EN = "https://www.matsne.gov.ge/en/document/view/2169396"
VERSION_NOTE = "Закон Грузии «О дорожном движении» № 1830-რს, консолидированная редакция 25.06.2026 (Matsne, публикация 36)"


def law_key_norm(key: str, ids):
    """tickets.json `laws` key ('L25.3', 'L25', 'A1.5.19.1') → norm id or None."""
    if key.startswith("L"):
        art, _, par = key[1:].partition(".")
        return normref.law_id(art, par or None, None, ids)
    an, _, item = key[1:].partition(".")
    nid = f"A{an}:{item}"
    return nid if nid in ids else None


def quote_norm(ref: str, ids):
    """'ст. 25, п. 3' / 'Приложение 1 (знаки), п. 5.19.1' → norm id (exact, or None)."""
    m = re.fullmatch(r"ст\. (\S+?)(?:, п\. (\S+))?", ref)
    if m:
        return normref.law_id(m.group(1), m.group(2), None, ids)
    m = re.fullmatch(r"Приложение (\d) \(\w+\), п\. (\S+)", ref)
    if m and f"A{m.group(1)}:{m.group(2)}" in ids:
        return f"A{m.group(1)}:{m.group(2)}"
    return None


def link_content(norms: dict, world, eps: list, lessons: dict, tickets: list, raw: list, laws: dict, items_export: dict) -> Linker:
    """Annotate everything in place. lessons: {ep id: html} is replaced by the linked HTML."""
    L = Linker(norms)
    ids = L.ids
    ep_scope = {}                       # episode id → explicit cites of its data + lesson (context for bare «п. N»)
    for ep in eps:
        texts = [ep.get("lead"), *[p["t"] + " " + p["c"] for p in ep.get("points", [])],
                 *[q["ref"] for q in ep.get("law_quotes", [])], ep.get("core_note"), ep.get("linked_note")]
        ep_cites = L.cites(texts)
        if ep["id"] in lessons:
            lessons[ep["id"]] = L.lesson_html("lessons", ep["id"], lessons[ep["id"]], scopes=[ep_cites])
        lesson_cites = L.cites([re.sub(r"<[^>]+>", "\x00", lessons.get(ep["id"], ""))])
        ep_scope[ep["id"]] = ep_cites + lesson_cites
        L.ru_fields("episodes", ep["id"], ep, ["lead", "core_note", "linked_note"], scopes=[ep_cites, lesson_cites])
        for p in ep.get("points", []):
            L.ru_fields("episodes", ep["id"], p, ["t", "c"], scopes=[ep_cites, lesson_cites])
        for q in ep.get("law_quotes", []):
            nid = quote_norm(q["ref"], ids)
            if nid:
                q["n"] = slug(nid)
            art = norms[nid].get("article") if nid and not nid.startswith("A") else None
            L.ru_fields("episodes", ep["id"], q, ["text"], own_article=art, self_id=nid)
    for k, q in laws.items():
        nid = law_key_norm(k, ids)
        if nid:
            q["n"] = slug(nid)
        art = norms[nid].get("article") if nid and not nid.startswith("A") else None
        L.ru_fields("ticket_laws", k, q, ["text"], own_article=art, self_id=nid)
    for x, t in zip(raw, tickets):
        bank = world.bank_norms(x["id"])
        L.ka_field("tickets_ka", t["id"], t, "ex", bank["norms"], strict=bool(bank["unresolved"]))
        if t.get("ex_ru") and not t.pop("ex_ru_nl", False):
            L.ru_fields("tickets_mt", t["id"], t, ["ex_ru"])
            _trust_mt_letters(t)
        if t.get("why"):
            L.ru_fields("typical_errors", t["id"], t, ["why"], scopes=[ep_scope.get(t.get("lesson"), [])])
        if t.get("br"):
            _link_breakdown(L, norms, t)
    for it in items_export["items"]:
        qn = quote_norm(it["quote"]["ref"], ids)
        if qn:
            it["quote"]["n"] = slug(qn)
        art = norms[qn]["article"] if qn and not qn.startswith("A") else None
        L.ru_fields("own_items", it["id"], it, ["explain"], scopes=[L.cites([it["quote"]["ref"]]), ep_scope.get(it["lesson"], [])])
        L.ru_fields("own_items", it["id"], it["quote"], ["text"], own_article=art, self_id=qn)
    for mid, m in items_export["misconceptions"].items():
        L.ru_fields("misconceptions", mid, m, ["belief", "truth"])
    return L


def _trust_mt_letters(t: dict) -> None:
    """Subparagraph letters in machine-translated text are only trusted where the Georgian original links them:
    MT may keep a Georgian letter's look (გ → «г») though it is the Russian «в»; such links are dropped."""
    r = t.get("_r") or {}
    ka = {sp[2] for sp in r.get("ex", [])}
    keep = [sp for sp in r.get("ex_ru", []) if sp[2] in ka or not re.match(r"st\d+(_\d+)?-p\d+-", sp[2])]
    if keep:
        r["ex_ru"] = keep
    else:
        r.pop("ex_ru", None)


def _link_breakdown(L, norms: dict, t: dict):
    br = t["br"]
    scope = L.cites([q["ref"] for q in br["quotes"]])
    for q in br["quotes"]:
        nid = q.pop("norm")
        q["n"] = slug(nid)
        L.ru_fields("breakdowns", t["id"], q, ["text"], own_article=norms[nid].get("article"), self_id=nid)
    for part in [*br["steps"], *br["why_not"], *([br["trap"]] if br.get("trap") else [])]:
        L.ru_fields("breakdowns", t["id"], part, ["t"], scopes=[scope])


# ---------------- pages ----------------
def _e(s) -> str:
    return htmlmod.escape(str(s), quote=True)


def _excerpt(s: str, n=110) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def image_name(nid: str):
    if not nid.startswith("A"):
        return None
    an, item = nid[1:].split(":", 1)
    if "прим" in item:
        return None
    name = ("sign_" if an == "1" else "mark_") + item.replace(".", "_") + ".png"
    return name if (paths.SIGNS / name).exists() else None


def _page(title: str, body: str, desc: str, script: str, slug_attr: str = "") -> str:
    return (f'<!doctype html><html lang="ru" data-root="../"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            f'<title>{_e(title)} — ПДД Грузии</title><meta name="description" content="{_e(desc)}">'
            f'<link rel="icon" href="data:,"><link rel="stylesheet" href="../assets/app.css"></head>\n'
            f'<body><main class="normpage"{slug_attr}>\n{body}\n</main>\n'
            f'<script type="module" src="../assets/pages/{script}"></script></body></html>\n')


class Site:
    def __init__(self, norms: dict, world, linker: Linker, eps: list, tickets: list, items_export: dict):
        self.norms, self.world, self.L = norms, world, linker
        self.order = list(norms)
        self.children = {}
        for nid, n in norms.items():
            self.children.setdefault(self.parent(nid), []).append(nid)
        self.by_slug = {slug(i): i for i in norms}
        self.eps = {e["id"]: e for e in eps}
        self.items = items_export["items"]
        self.ticket_norms = {tid: world.ticket_norms(tid)["norms"] for tid in sorted(world.questions)}
        self.tickets = {t["id"]: t for t in tickets}
        self.spans = {nid: linker.ru_spans("norm_pages", nid, n["ru"], own_article=None if nid.startswith("A") else n["article"],
                                           self_id=nid) for nid, n in norms.items() if n.get("ru")}

    def parent(self, nid):
        n = self.norms[nid]
        if n.get("parent"):
            return n["parent"]
        if nid.startswith("A"):
            an, item = nid[1:].split(":", 1)
            return f"A{an}:§{item.split('.')[0]}"          # virtual section (index only)
        return None

    def article_title(self, n):
        art = self.norms.get(n.get("article")) if not n["id"].startswith("A") else None
        return f"Статья {art['article']}. {art['title']}" if art else (
            f"Приложение {n['annex']} ({'дорожные знаки' if n['annex'] == 1 else 'дорожная разметка'})")

    def ru_html(self, n, href_prefix="") -> str:
        return render_linked(n.get("ru") or "", self.spans.get(n["id"], []), href_prefix)

    # -- backlinks --
    def backlinks(self, nid) -> dict:
        w = self.world
        rel = lambda spec: covers_id(spec, nid) or covers_id(nid, spec)
        lessons = []
        for lid in w.lesson_order:
            how = []
            if any(rel(s) for s in w.teaches(lid)):
                how.append("разбирает")
            elif any(rel(s) for s in w.quoted(lid)):
                how.append("цитирует")
            ment = {k for m_id, keys in self.L.mentions.items() if covers_id(nid, m_id) for k in keys}
            if ("lessons", lid) in ment or ("episodes", lid) in ment:
                how.append("ссылается")
            if how:
                lessons.append((lid, how))
        concepts = [c for c in w.concepts.values() if any(rel(s) for s in c.get("norms", []))]
        mcs = [m for m in w.misconceptions.values() if any(rel(s) for s in m.get("norms", []))]
        tickets = [tid for tid, ns in self.ticket_norms.items() if any(covers_id(nid, x) for x in ns)]
        mention_items = {k for m_id, keys in self.L.mentions.items() if covers_id(nid, m_id) for t, k in keys if t == "own_items"}
        items = [it for it in self.items if (it["quote"].get("n") and covers_id(nid, self.by_slug[it["quote"]["n"]]))
                 or it["id"] in mention_items]
        cited_by = sorted({k for m_id, keys in self.L.mentions.items() if covers_id(nid, m_id)
                           for t, k in keys if t == "norm_pages" and not covers_id(nid, k)}, key=self.order.index)
        return {"lessons": lessons, "concepts": concepts, "misconceptions": mcs, "tickets": tickets,
                "items": items, "cited_by": cited_by}

    def render_backlinks(self, nid) -> str:
        b = self.backlinks(nid)
        out = ['<section class="backlinks"><h2>Где это в курсе</h2>']
        if not any(b.values()):
            out.append('<p class="small mut">Пока ни один урок, вопрос или билет не опирается на эту норму.</p>')
        if b["lessons"]:
            out.append("<h3>Уроки</h3><ul>" + "".join(
                f'<li><a href="../episode.html?id={lid}">Выпуск {self.eps[lid]["num"]}. {_e(self.eps[lid]["title"])}</a>'
                f' <span class="small mut">— {", ".join(how)}</span></li>' for lid, how in b["lessons"]) + "</ul>")
        if b["concepts"]:
            intro = self.world.introduced_in
            out.append("<h3>Понятия курса</h3><ul>" + "".join(
                f'<li>{_e(c["label"])}' + (f' <span class="small mut">— вводится в выпуске {self.eps[intro[c["id"]]]["num"]}</span>'
                                          if c["id"] in intro and intro[c["id"]] in self.eps else "") + "</li>"
                for c in b["concepts"]) + "</ul>")
        if b["misconceptions"]:
            out.append("<h3>Типичные ошибки</h3><ul>" + "".join(
                f'<li>«{_e(m["belief"])}» — <b>как правильно:</b> {_e(m["truth"])}</li>' for m in b["misconceptions"]) + "</ul>")
        if b["items"]:
            ids = ",".join(it["id"] for it in b["items"])
            out.append(f'<h3>Наши вопросы ({len(b["items"])})</h3><ul>' + "".join(
                f'<li><a href="../practice.html?ids={_e(it["id"])}">{_e(it["q"])}</a></li>' for it in b["items"]) + "</ul>"
                + (f'<p><a class="btn ghost" href="../practice.html?ids={_e(ids)}">Решить все</a></p>' if len(b["items"]) > 1 else ""))
        if b["tickets"]:
            ids = ",".join(str(t) for t in b["tickets"])
            out.append(f'<h3>Билеты, которые на неё ссылаются ({len(b["tickets"])})</h3>'
                       f'<p class="tlist">' + " ".join(f'<a href="../practice.html?ids={t}">№ {t}</a>' for t in b["tickets"]) + "</p>"
                       f'<p><a class="btn ghost" href="../practice.html?ids={ids}">Решить эти билеты</a></p>'
                       '<p class="small mut">По ссылкам на закон в пояснениях базы (с учётом наших уточнений онтологии).</p>')
        if b["cited_by"]:
            out.append("<h3>Ссылаются в законе</h3><ul>" + "".join(
                f'<li><a class="nref" href="{slug(k)}.html" data-norm="{slug(k)}">{_e(citation(self.norms[k]))}</a></li>' for k in b["cited_by"]) + "</ul>")
        out.append("</section>")
        return "".join(out)

    def crumbs(self, nid) -> str:
        chain, cur = [], self.norms[nid].get("parent")
        while cur:
            chain.append(cur)
            cur = self.norms[cur].get("parent")
        parts = ['<a href="index.html">Закон</a>']
        if nid.startswith("A"):
            n = self.norms[nid]
            parts.append(f'<a href="index.html#annex{n["annex"]}">Приложение {n["annex"]}</a>')
        parts += [f'<a href="{slug(c)}.html">{_e(citation(self.norms[c]))}</a>' for c in reversed(chain)]
        return '<nav class="crumbs small" aria-label="Положение в законе">' + " › ".join(parts) + "</nav>"

    def siblings(self, nid):
        sib = self.children[self.parent(nid)]
        i = sib.index(nid)
        return (sib[i - 1] if i else None), (sib[i + 1] if i + 1 < len(sib) else None)

    def page(self, nid) -> str:
        n = self.norms[nid]
        s = slug(nid)
        cit = citation(n)
        h = [self.crumbs(nid)]
        if n["kind"] == "article":
            h.append(f'<h1>Статья {_e(n["article"])}. {_e(n["title"])}</h1>')
            h.append(f'<p class="small mut" lang="ka">{_e(n.get("title_ka", ""))}</p>')
        else:
            h.append(f"<h1>{_e(cit)}</h1>")
            h.append(f'<p class="small mut">{_e(self.article_title(n))}</p>')
        h.append(f'<p class="small mut nver">{_e(VERSION_NOTE)}. Юридическую силу имеет грузинский текст, русский — перевод. '
                 f'Источник: <a href="{MATSNE.format(lang="ru")}" rel="noopener">Matsne (рус.)</a>, '
                 f'<a href="{MATSNE.format(lang="ka")}" rel="noopener">Matsne (груз.)</a>.</p>')
        img = image_name(nid)
        if img:
            h.append(f'<figure class="nimg"><img src="img/{img}" alt="{_e(cit)}"></figure>')
        kids = self.children.get(nid, [])
        if n["kind"] == "article":
            h.append('<section class="ntext"><h2>Текст статьи (рус.)</h2><ol class="npars">' + "".join(
                f'<li id="{slug(k)}"><a class="ncite" href="{slug(k)}.html">{_e(citation(self.norms[k]))}</a>'
                f'<div class="lawtext" lang="ru">{self.ru_html(self.norms[k]) if self.norms[k].get("ru") else "<i>текст отсутствует</i>"}</div></li>'
                for k in kids) + "</ol></section>")
        else:
            body = self.ru_html(n) if n.get("ru") else '<i>Русского текста этой нормы в переводе Matsne нет.</i>'
            h.append(f'<section class="ntext"><h2>Текст (рус., дословно)</h2><div class="lawtext" lang="ru">{body}</div></section>')
            if n.get("ka"):
                h.append(f'<section class="ntext"><h2>Официальный текст (груз.)</h2><div class="lawtext ka" lang="ka">{_e(n["ka"])}</div></section>')
            if n.get("en"):
                h.append(f'<details class="ntext en"><summary>English — official translation of 28.06.2019 (перевод 2019 г., может не совпадать с действующей редакцией)</summary>'
                         f'<div class="lawtext" lang="en">{_e(n["en"])}</div><p class="small mut"><a href="{MATSNE_EN}" rel="noopener">Matsne (англ.)</a></p></details>')
            if kids:
                h.append('<h2>Подпункты</h2><ul class="nkids">' + "".join(
                    f'<li><a class="nref" href="{slug(k)}.html" data-norm="{slug(k)}">{_e(citation(self.norms[k]))}</a> '
                    f'<span class="small mut">{_e(_excerpt(self.norms[k].get("ru"), 90))}</span></li>' for k in kids) + "</ul>")
        prev, nxt = self.siblings(nid)
        nav = []
        if n.get("parent"):
            nav.append(f'<a class="btn ghost" href="{slug(n["parent"])}.html">↑ {_e(citation(self.norms[n["parent"]]))}</a>')
        if prev:
            nav.append(f'<a class="btn ghost" href="{slug(prev)}.html" rel="prev">← {_e(citation(self.norms[prev]))}</a>')
        if nxt:
            nav.append(f'<a class="btn ghost" href="{slug(nxt)}.html" rel="next">{_e(citation(self.norms[nxt]))} →</a>')
        h.append('<nav class="row nnav" aria-label="Соседние нормы">' + "".join(nav) + "</nav>")
        h.append(self.render_backlinks(nid))
        h.append(f'<p class="small nperm">Постоянная ссылка: <code>norm/{s}.html</code> '
                 f'<button class="iconbtn" id="copylink" type="button">Копировать ссылку</button></p>')
        desc = _excerpt(n.get("ru") or n.get("title") or cit, 150)
        title = f"Статья {n['article']}. {n['title']}" if n["kind"] == "article" else cit
        return _page(title, "\n".join(h), desc, "norm.mjs", f' data-norm="{s}"')

    def chunks(self) -> dict:
        out = {}
        for nid, n in self.norms.items():
            s = slug(nid)
            if n["kind"] == "article":
                e = {"c": f"Статья {n['article']}. {n['title']}", "ru": f"Пунктов в статье: {len(self.children.get(nid, []))}. Полный текст — на странице статьи."}
            else:
                e = {"c": citation(n), "t": self.article_title(n), "ru": n.get("ru") or ""}
                if not e["ru"] and n.get("ka"):
                    e["ka"] = n["ka"]                      # no Russian translation published: show the official Georgian
            img = image_name(nid)
            if img:
                e["img"] = f"img/{img}"
            out.setdefault(chunk_of(s), {})[s] = e
        return {f"norm/chunks/{k}.json": json.dumps(v, ensure_ascii=False, separators=(",", ":")) for k, v in out.items()}

    def index(self) -> str:
        h = ['<h1>Закон о дорожном движении: все нормы</h1>',
             f'<p class="small mut">{_e(VERSION_NOTE)}. У каждой статьи, пункта, подпункта, знака, разметки и примечания — '
             'своя постоянная страница: текст на русском (дословно), грузинском и, где есть, английском (перевод 2019 г.), '
             'и где эта норма встречается в курсе.</p>',
             '<div class="row nsearch"><label>Поиск: <input type="search" id="nq" placeholder="ст. 37, п. 6 · 5.19.1 · остановка" autocomplete="off"></label>'
             '<span class="small mut" id="ncount"></span></div>',
             '<h2 id="law">Статьи закона</h2><ul class="nindex" id="nlist">']
        def li(nid, depth):
            n = self.norms[nid]
            s = slug(nid)
            label = f"Статья {n['article']}. {n['title']}" if n["kind"] == "article" else citation(n)
            ex = "" if n["kind"] == "article" else f' <span class="mut">{_e(_excerpt(n.get("ru"), 100))}</span>'
            return f'<li class="d{depth}" data-id="{s}"><a href="{s}.html">{_e(label)}</a>{ex}</li>'
        law = [i for i in self.order if not i.startswith("A")]
        annex = {1: [], 2: []}
        for i in self.order:
            if i.startswith("A"):
                annex[self.norms[i]["annex"]].append(i)
        depth = lambda i: i.count(".") if not i.startswith("A") else (1 if "прим" not in i else 1 + i.split("прим", 1)[1].count("."))
        h += [li(i, depth(i)) for i in law]
        h.append("</ul>")
        for an, title in ((1, "Приложение 1. Дорожные знаки"), (2, "Приложение 2. Дорожная разметка")):
            h.append(f'<h2 id="annex{an}">{title}</h2><ul class="nindex">' + "".join(li(i, depth(i)) for i in annex[an]) + "</ul>")
        h.append('<p class="small mut">Схема адресов: <code>st5</code> — статья 5; <code>st5-p13</code> — ст. 5, п. 13; '
                 '<code>st37-p6-a-a</code> — подпункт «а.а»; <code>st11_1</code> — статья 11¹; <code>sign-5.26</code> — знак 5.26; '
                 '<code>mark-1.14.1</code> — разметка 1.14.1; <code>sign-1-notes-b</code> — прил. 1, примечание «б» к разделу 1. '
                 'Адреса не меняются при пересборке.</p>')
        return _page("Закон: все нормы", "\n".join(h), "Все статьи, пункты, знаки и разметка закона Грузии о дорожном движении", "normindex.mjs")


def norm_files(norms: dict, world, linker: Linker, eps, tickets, items_export):
    site = Site(norms, world, linker, eps, tickets, items_export)
    files = {f"norm/{slug(i)}.html": site.page(i) for i in norms}
    files["norm/index.html"] = site.index()
    files.update(site.chunks())
    copies = {f"norm/img/{img}": paths.SIGNS / img for i in norms for img in [image_name(i)] if img}
    return files, copies, site

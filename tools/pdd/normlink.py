"""Auto-linking of norm references in site content (build time).

Lesson HTML is rewritten (text nodes only; never inside <a>, <svg>, <summary>, <script>, <style> — status 'unlinkable').
Data strings rendered by the client get a `_r` annotation instead: {field: [[start, end, slug], ...]} with
offsets in UTF-16 code units (JavaScript string indices); packages/domain/normlinks.mjs turns them into links.
Every decision is counted in Linker.stats; non-linked references are listed in Linker.misses."""
import collections
import html as htmlmod
import re

from pdd import normref
from pdd.normids import slug

BLOCKS = {"p", "li", "blockquote", "figcaption", "td", "th", "h1", "h2", "h3", "h4", "dd", "dt", "div", "section", "article"}
SKIP = {"a", "svg", "summary", "script", "style", "button", "code", "title"}
INLINE = {"a", "b", "i", "em", "strong", "span", "small", "sup", "sub", "mark", "abbr", "u", "s", "kbd", "q"}
VOID = {"img", "br", "hr", "input", "source", "meta", "link", "wbr", "col", "area", "track"}
SEP = "\x00"
TOKEN = re.compile(r"<!--.*?-->|<[^>]*>|[^<]+", re.S)


def utf16(s: str, i: int) -> int:
    return i + sum(1 for c in s[:i] if ord(c) > 0xFFFF)


def anchor(text: str, s: str, href_prefix: str) -> str:
    return f'<a class="nref" href="{href_prefix}{s}.html" data-norm="{s}">{htmlmod.escape(text, quote=False)}</a>'


def render_linked(text: str, spans, href_prefix: str) -> str:
    """Escaped HTML of `text` with [start, end, slug] spans (Python indices) turned into links."""
    out, pos = [], 0
    for a, b, s in sorted(spans):
        out.append(htmlmod.escape(text[pos:a], quote=False))
        out.append(anchor(text[a:b], s, href_prefix))
        pos = b
    out.append(htmlmod.escape(text[pos:], quote=False))
    return "".join(out)


def _breaks(tag: str) -> bool:
    """A tag between two text nodes separates them (block boundary), unless it is inline markup."""
    if not tag.startswith("<") or tag.startswith("<!--"):
        return False
    m = re.match(r"</?\s*([a-zA-Z][\w-]*)", tag)
    return not m or m.group(1).lower() not in INLINE


class Linker:
    def __init__(self, norms: dict):
        self.norms = norms
        self.ids = set(norms)
        self.ka_text = {i: n.get("ka") or "" for i, n in norms.items()}
        self.stats = collections.defaultdict(collections.Counter)    # content type → status → n
        self.misses = collections.defaultdict(list)                   # content type → [(key, text, status)]
        self.mentions = collections.defaultdict(set)                  # norm id → {(content type, key)}
        self.log = []                                                 # every decision, for review/tests

    def _record(self, ctype, key, refs, self_id=None, context=""):
        for r in refs:
            if r.status == "linked" and r.norm == self_id:
                r.status = "self"                     # a norm's own text never links to itself
            self.log.append((ctype, str(key), r.text, r.status, r.norm, context))
            if r.status == "self":
                continue
            self.stats[ctype][r.status] += 1
            if r.status == "linked":
                self.mentions[r.norm].add((ctype, key))
            elif r.status != "self":
                self.misses[ctype].append((str(key), r.text, r.status))

    # ---------- Russian data strings ----------
    @staticmethod
    def cites(texts) -> list:
        return [c for t in texts if t for c in normref.explicit_cites(normref.find_ru(t))]

    def ru_fields(self, ctype, key, obj: dict, fields, scopes=(), own_article=None, self_id=None) -> None:
        """Annotate obj['_r'] for the given string fields, which together form one block of text."""
        found = {f: normref.find_ru(obj[f]) for f in fields if obj.get(f)}
        block = [c for refs in found.values() for c in normref.explicit_cites(refs)]
        ann = {}
        for f, refs in found.items():
            normref.resolve_ru(refs, self.ids, [block, *scopes], own_article)
            self._record(ctype, key, refs, self_id, obj[f])
            spans = [[utf16(obj[f], r.start), utf16(obj[f], r.end), slug(r.norm)] for r in refs if r.status == "linked"]
            if spans:
                ann[f] = spans
        if ann:
            obj.setdefault("_r", {}).update(ann)

    def ru_spans(self, ctype, key, text, scopes=(), own_article=None, self_id=None) -> list:
        """[start, end, slug] (Python indices) for one string, for server-side rendering."""
        refs = normref.find_ru(text)
        normref.resolve_ru(refs, self.ids, [normref.explicit_cites(refs), *scopes], own_article)
        self._record(ctype, key, refs, self_id, text)
        return [[r.start, r.end, slug(r.norm)] for r in refs if r.status == "linked"]

    # ---------- Georgian ticket explanations ----------
    def ka_field(self, ctype, key, obj: dict, f: str, confirmed, strict=False) -> None:
        text = obj.get(f)
        if not text:
            return
        refs = normref.resolve_ka(normref.find_ka(text), self.ids, self.ka_text, confirmed, strict)
        self._record(ctype, key, refs, context=text)
        spans = [[utf16(text, r.start), utf16(text, r.end), slug(r.norm)] for r in refs if r.status == "linked"]
        if spans:
            obj.setdefault("_r", {})[f] = spans

    # ---------- lesson HTML ----------
    def lesson_html(self, ctype, key, html: str, scopes=(), href_prefix="norm/") -> str:
        toks = TOKEN.findall(html)
        stack, texts = [], []               # texts: (token index, text, block id, section, linkable)
        section = 0
        for i, t in enumerate(toks):
            if t.startswith("<!--"):
                continue
            if t.startswith("</"):
                name = t[2:-1].strip().lower()
                for j in range(len(stack) - 1, -1, -1):
                    if stack[j][0] == name:
                        del stack[j:]
                        break
                continue
            if t.startswith("<"):
                m = re.match(r"<\s*([a-zA-Z][\w-]*)", t)
                if not m:
                    continue
                name = m.group(1).lower()
                if name == "h2":
                    section += 1
                if name not in VOID and not t.endswith("/>"):
                    stack.append((name, i))
                continue
            names = [n for n, _ in stack]
            bq = next((j for n, j in stack if n == "blockquote"), None)
            blk = bq if bq is not None else next((j for n, j in reversed(stack) if n in BLOCKS), -1)
            texts.append((i, htmlmod.unescape(t), blk, section, not (set(names) & SKIP)))
        blocks = collections.OrderedDict()
        for i, text, blk, sec, ok in texts:
            blocks.setdefault(blk, []).append((i, text, sec, ok))
        found = []
        for blk, parts in blocks.items():
            joined, offs, prev = "", [], None
            for i, text, sec, ok in parts:
                if prev is not None and any(_breaks(t) for t in toks[prev + 1:i]):
                    joined += SEP
                offs.append((len(joined), i, text, ok))
                joined += text
                prev = i
            refs = normref.find_ru(joined)
            found.append((blk, parts[0][2], joined, offs, refs))
        sec_cites = collections.defaultdict(list)
        doc = []
        for blk, sec, joined, offs, refs in found:
            c = normref.explicit_cites(refs)
            sec_cites[sec] += c
            doc += c
        edits = collections.defaultdict(list)
        for blk, sec, joined, offs, refs in found:
            normref.resolve_ru(refs, self.ids, [normref.explicit_cites(refs), sec_cites[sec], doc, *scopes])
            for r in refs:
                if r.status != "linked":
                    continue
                host = next(((o, i, text, ok) for o, i, text, ok in offs if o <= r.start and r.end <= o + len(text)), None)
                if host is None or not host[3]:
                    r.status = "split" if host is None else "unlinkable"
                    continue
                o, i, text, _ = host
                edits[i].append([r.start - o, r.end - o, slug(r.norm)])
            self._record(ctype, key, refs, context=joined)
        for i, spans in edits.items():
            toks[i] = render_linked(htmlmod.unescape(toks[i]), spans, href_prefix)
        return "".join(toks)

    def report(self) -> dict:
        """stats + every decision, so a change in what gets linked shows up as a reviewable diff of links.json."""
        linked = {}
        for ctype, key, text, status, norm, _ in self.log:
            if status == "linked":
                linked.setdefault(ctype, set()).add(f"{key} | {text} → {norm}")
        return {"stats": {k: dict(sorted(v.items())) for k, v in sorted(self.stats.items())},
                "not_linked": {k: sorted(set(v)) for k, v in sorted(self.misses.items())},
                "linked": {k: sorted(v) for k, v in sorted(linked.items())}}

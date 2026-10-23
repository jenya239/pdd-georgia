"""Own check items («наш вопрос») for the released lessons: loading, validation against the law and the
ontology, and export to docs/data/items.json.

An item never states a rule of its own: its answer is backed by a verbatim quote of a norm that the lesson
(or an earlier one) teaches, and it may only use concepts introduced (or assumed) by then.
"""
import json
import re

from pdd.assign import ANNEX_KIND
from pdd.ontology import covers_id
from pdd.paths import CHECKITEMS

TYPES = ("ticket", "diagram", "priority", "max-error", "flashcard", "cloze")
TYPE_LABEL = {"ticket": "в формате билета", "diagram": "схема", "priority": "очерёдность проезда",
              "max-error": "найдите ошибку Макса", "flashcard": "число из закона", "cloze": "вставьте слово из закона"}
REQUIRED = ("id", "lesson", "type", "q", "options", "answer", "norms", "concepts", "quote", "explain", "distractors")
FIG_KINDS = ("crossing", "section", "approach")
_ID = re.compile(r"^o-(ep\d\d)-\d\d$")


def norm_text(s: str) -> str:
    """Comparison form of law text: dashes unified, whitespace collapsed, case kept."""
    s = re.sub(r"[‐-―−]", "-", s)
    s = s.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip()


def quote_errors(quote: dict, law: dict) -> list:
    text = law.get(quote.get("norm"))
    if text is None:
        return [f"quote norm {quote.get('norm')!r} does not exist"]
    if not quote.get("text") or norm_text(quote["text"]) not in norm_text(text):
        return [f"quote is not verbatim in {quote['norm']}: {quote.get('text')!r}"]
    return []


def _numbers(s: str) -> list:
    return re.findall(r"\d+", s)


def type_errors(item: dict) -> list:
    t, opts, ans = item.get("type"), item.get("options", []), item.get("answer")
    if t not in TYPES:
        return [f"unknown type {t!r}"]
    if not isinstance(ans, int) or not 0 <= ans < len(opts):
        return [f"answer {ans!r} out of range"]
    quote = norm_text(item.get("quote", {}).get("text", ""))
    if t == "flashcard":
        nums = _numbers(opts[ans])
        if not nums or any(not re.search(rf"(?<!\d){n}(?!\d)", quote) for n in nums):
            return [f"flashcard answer {opts[ans]!r} is not a number from the quote"]
    if t == "cloze":
        q = item.get("q", "")
        if q.count("___") != 1:
            return ["cloze needs exactly one ___"]
        if norm_text(opts[ans]) not in quote:
            return [f"cloze answer {opts[ans]!r} is not in the quote"]
        m = re.search(r"«([^»]*___[^»]*)»", q)
        filled = norm_text(m.group(1).replace("___", opts[ans]).strip("… ")) if m else ""
        if not filled or filled not in quote:
            return ["cloze text with the answer filled in is not the quote"]
    if t == "diagram" and not item.get("fig"):
        return ["diagram needs fig"]
    if item.get("fig") and item["fig"].get("kind") not in FIG_KINDS:
        return [f"unknown fig kind {item['fig'].get('kind')!r}"]
    return []


def rule_for(norm_id: str) -> dict:
    """Same grouping key as the bank tickets' `rule` (assign.rule_key): article.paragraph or annex item."""
    if ":" in norm_id:
        annex, item = norm_id[1:].split(":", 1)
        if ".прим" in item:
            sec, rest = item.split(".прим", 1)
            letter = rest.lstrip("0123456789.")
            return {"key": norm_id, "label": f"прил. {annex}, примечание к разделу {sec}" + (f" «{letter}»" if letter else "")}
        return {"key": norm_id, "label": f"прил. {annex}, {ANNEX_KIND.get(annex, 'пункт')} {item}"}
    parts = norm_id.split(".")
    if len(parts) == 1:
        return {"key": parts[0], "label": f"ст. {parts[0]}"}
    sub = ".".join(parts[2:])
    return {"key": f"{parts[0]}.{parts[1]}", "label": f"ст. {parts[0]}, п. {parts[1]}" + (f" «{sub}»" if sub else "")}


def load_items(root=CHECKITEMS) -> list:
    out = []
    for path in sorted(root.glob("ep*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            out.append({"lesson": path.stem, **item})
    return out


def validate(items: list, world) -> list:
    err, seen = [], set()
    law = world.norm_text
    for it in items:
        key = it.get("id", "?")
        missing = [f for f in REQUIRED if f not in it]
        if missing:
            err.append(f"{key}: missing {missing}")
            continue
        m = _ID.match(it["id"])
        if not m or m.group(1) != it["lesson"]:
            err.append(f"{key}: id must be o-{it['lesson']}-NN")
        if it["id"] in seen:
            err.append(f"{key}: duplicate id")
        seen.add(it["id"])
        if it["lesson"] not in world.lesson_order:
            err.append(f"{key}: unknown lesson {it['lesson']}")
            continue
        if not 2 <= len(it["options"]) <= 4:
            err.append(f"{key}: needs 2–4 options")
        err += [f"{key}: {e}" for e in type_errors(it) + quote_errors(it["quote"], law)]
        upto = world.lesson_order[:world.lesson_order.index(it["lesson"]) + 1]
        stated = [s for lid in upto for s in world.quoted(lid)]
        if it["quote"]["norm"] not in it["norms"]:
            err.append(f"{key}: quote norm {it['quote']['norm']} is not among the item norms")
        for n in it["norms"]:
            if n not in law:
                err.append(f"{key}: unknown norm {n}")
            elif not any(covers_id(s, n) for s in stated):
                err.append(f"{key}: norm {n} is not taught by {it['lesson']} or earlier")
        avail = world.available_concepts(it["lesson"])
        for c in it["concepts"]:
            if c not in world.concepts:
                err.append(f"{key}: unknown concept {c}")
            elif c not in avail:
                err.append(f"{key}: concept {c} is not introduced by {it['lesson']}")
        wrong = {str(i) for i in range(len(it["options"])) if i != it["answer"]}
        if set(it["distractors"]) != wrong:
            err.append(f"{key}: distractors must map exactly the wrong options {sorted(wrong)}")
        for mc in it["distractors"].values():
            if mc is not None and mc not in world.misconceptions:
                err.append(f"{key}: unknown misconception {mc}")
        if len(it["explain"]) < 20:
            err.append(f"{key}: explanation too short")
    return err


def quote_ref(norm_id: str) -> str:
    return rule_for(norm_id)["label"]


def export(items: list, world) -> dict:
    used = {m for it in items for m in it["distractors"].values() if m}
    ticket_mc = {k: v["distractors"] for k, v in sorted(world.doc["tickets"].items(), key=lambda kv: int(kv[0]))
                 if v.get("distractors")}
    used |= {m for d in ticket_mc.values() for m in d.values() if m}
    out = []
    for it in items:
        rec = {k: it[k] for k in ("id", "lesson", "type", "q", "options", "answer", "explain", "distractors")}
        rec["type_label"] = TYPE_LABEL[it["type"]]
        rec["rule"] = rule_for(it["quote"]["norm"])
        rec["quote"] = {"ref": quote_ref(it["quote"]["norm"]), "text": it["quote"]["text"]}
        if it.get("fig"):
            rec["fig"] = it["fig"]
        out.append(rec)
    mcs = {m: {"belief": world.misconceptions[m]["belief"], "truth": world.misconceptions[m]["truth"]} for m in sorted(used)}
    return {"items": out, "misconceptions": mcs, "ticket_distractors": ticket_mc}

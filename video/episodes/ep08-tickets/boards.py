# Доски билетов ep08. Вопрос и варианты читаются из базы при рендере.
import json as _json
import re as _re
TK = str(TICKETS) + "/"
_T = {x["id"]: x for x in _json.load(open(TK + "tickets_ru.json", encoding="utf-8"))["questions"]}

def _clean(s):
    return _re.sub(r"\s+", " ", s).strip()

def ticket(img, d, t, B, tid, accent):
    raw = _T[tid]
    q = _clean(raw["question"])
    opts = [_clean(a["text"]) for a in raw["answers"]]
    correct = raw["correct"] - 1
    y = exam(img, d, t, q, opts, correct, B.S(1), f"№ {tid}", tag="Билет урока")
    if t > B.S(1) - 0.2:
        chip(d, 24, min(max(y + 6, 500), 640), accent, GOLD, appear(t, B.S(1)), 14)

def b_intro(img, d, t, B, D):
    txt(d, (30, 40), "Выпуск 8 · билеты про уступить и преимущество", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Вопрос и варианты — из базы. Снятого ролика нет.", 18, WHITE, appear(t, 0.3), "la")

def b_t879(img, d, t, B, D):
    ticket(img, d, t, B, 879, "Вопрос просит назвать, что такое преимущество. Ст. 5, п. 84 называет им право первым двигаться в намеченном направлен…")

def b_t889(img, d, t, B, D):
    ticket(img, d, t, B, 889, "Вопрос просит назвать, что значит уступить дорогу. Ст. 5, п. 14 требует не продолжать движение, не возобновлять его и…")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

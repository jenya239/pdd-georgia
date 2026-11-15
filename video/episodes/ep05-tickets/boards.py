# Доски билетов ep05. Вопрос и варианты читаются из базы при рендере.
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
    txt(d, (30, 40), "Выпуск 5 · билеты про роли", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Вопрос и варианты — из базы. Снятого ролика нет.", 18, WHITE, appear(t, 0.3), "la")

def b_t811(img, d, t, B, D):
    ticket(img, d, t, B, 811, "Вопрос о посадке со стороны проезжей части — ст. 23, п. 1.")

def b_t941(img, d, t, B, D):
    ticket(img, d, t, B, 941, "Кто ведёт велосипед или мопед, тот пешеход (ст. 5, п. 87), но сторона дороги у него не пешеходная.")

def b_t942(img, d, t, B, D):
    ticket(img, d, t, B, 942, "Человек в инвалидной коляске приравнен к пешеходу (ст. 5, п. 87), но ст. 24, п. 5 ставит его на ту же правую сторону,…")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

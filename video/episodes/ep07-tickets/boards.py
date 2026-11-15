# Доски билетов ep07. Вопрос и варианты читаются из базы при рендере.
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
    txt(d, (30, 40), "Выпуск 7 · билеты про остановку и стоянку", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Вопрос и варианты — из базы. Снятого ролика нет.", 18, WHITE, appear(t, 0.3), "la")

def b_t356(img, d, t, B, D):
    ticket(img, d, t, B, 356, "Вынужденная остановка — перерыв, которого водитель не выбирал. Ст. 5, п. 26 называет поломку, опасность груза, состоя…")

def b_t357(img, d, t, B, D):
    ticket(img, d, t, B, 357, "Машина считается на стоянке, если водитель сам прервал движение дольше чем на пять минут и это время не нужно для пос…")

def b_t886(img, d, t, B, D):
    ticket(img, d, t, B, 886, "Вопрос спрашивает, что закон называет остановкой. Первое предложение ст. 5, п. 11 относит к ней преднамеренный переры…")

def b_t894(img, d, t, B, D):
    ticket(img, d, t, B, 894, "Вопрос спрашивает, какой перерыв называется стоянкой. Стоянка — преднамеренная пауза дольше пяти минут, когда посадка…")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

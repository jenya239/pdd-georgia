# Доски билетов ep07. Вопрос и варианты читаются из базы при рендере.
import json as _json
import re as _re
TK = str(TICKETS) + "/"
_T = {x["id"]: x for x in _json.load(open(TK + "tickets_ru.json", encoding="utf-8"))["questions"]}

def _clean(s):
    return _re.sub(r"\s+", " ", s).strip()

_IM = {}

def shot(tid):
    if tid in _IM:
        return _IM[tid]
    rel = _T[tid].get("image")
    if not rel:
        _IM[tid] = None
        return None
    _IM[tid] = Image.open(TK + rel).convert("RGBA")
    return _IM[tid]

def draw_pic(img, d, tid, x, y, w=260, max_h=200):
    im = shot(tid)
    if im is None:
        return
    s = min(w / im.size[0], max_h / im.size[1])
    r = im.resize((max(1, int(im.size[0] * s * SS)), max(1, int(im.size[1] * s * SS))), Image.LANCZOS)
    put(img, r, (int(x * SS), int(y * SS)))
    txt(d, (x + int(im.size[0] * s), y + im.size[1] * s + 4), "рисунок из базы билетов", 11, GREY, 1, "ra")


def ticket(img, d, t, B, tid, accent):
    raw = _T[tid]
    q = _clean(raw["question"])
    opts = [_clean(a["text"]) for a in raw["answers"]]
    correct = raw["correct"] - 1
    has = bool(raw.get("image"))
    picture = (lambda img, d, t, x, y, tid=tid: draw_pic(img, d, tid, x, y)) if has else None
    y = exam(img, d, t, q, opts, correct, B.S(1), f"№ {tid}", picture=picture, pic_w=260 if has else 0, tag="Билет урока")
    if t > B.S(1) - 0.2:
        chip(d, 24, min(max(y + 6, 500), 640), accent, GOLD, appear(t, B.S(1)), 14)

def b_intro(img, d, t, B, D):
    txt(d, (30, 40), "Выпуск 7 · билеты про остановку и стоянку", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Сначала вопрос. Ответ откроется после паузы.", 18, WHITE, appear(t, 0.3), "la")

def b_t356(img, d, t, B, D):
    ticket(img, d, t, B, 356, "Вынужденная остановка — перерыв не по выбору: поломка, груз или состояние.")

def b_t357(img, d, t, B, D):
    ticket(img, d, t, B, 357, "Стоянка — сам остановился дольше пяти минут не ради посадки или погрузки.")

def b_t886(img, d, t, B, D):
    ticket(img, d, t, B, 886, "Остановка — сам прервал движение до пяти минут или дольше ради посадки.")

def b_t894(img, d, t, B, D):
    ticket(img, d, t, B, 894, "Стоянка — пауза дольше пяти минут, когда посадка и погрузка не нужны.")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

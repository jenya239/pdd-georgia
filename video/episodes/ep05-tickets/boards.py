# Доски билетов ep05. Вопрос и варианты читаются из базы при рендере.
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
    txt(d, (30, 40), "Выпуск 5 · билеты про роли", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Сначала вопрос. Ответ откроется после паузы.", 18, WHITE, appear(t, 0.3), "la")

def b_t811(img, d, t, B, D):
    ticket(img, d, t, B, 811, "Вопрос о посадке со стороны проезжей части — ст. 23, п. 1.")

def b_t941(img, d, t, B, D):
    ticket(img, d, t, B, 941, "Кто ведёт велосипед или мопед, тот пешеход (ст. 5, п. 87), но сторона дороги у него не пешеходная.")

def b_t942(img, d, t, B, D):
    ticket(img, d, t, B, 942, "На этой дороге коляска занимает правую сторону проезжей части.")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

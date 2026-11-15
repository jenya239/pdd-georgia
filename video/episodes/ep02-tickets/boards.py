# Доски билетов ep02. Вопрос и варианты читаются из базы при рендере.
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
    txt(d, (30, 40), "Выпуск 2 · билеты про дорогу", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Сначала вопрос. Ответ откроется после паузы.", 18, WHITE, appear(t, 0.3), "la")

def b_t265(img, d, t, B, D):
    ticket(img, d, t, B, 265, "Стрелка идёт по обочине. Механическому средству так ехать нельзя.")

def b_t351(img, d, t, B, D):
    ticket(img, d, t, B, 351, "Речь о дороге с двусторонним движением и тремя полосами — это последнее предложение ст. 31, п. 3.")

def b_t386(img, d, t, B, D):
    ticket(img, d, t, B, 386, "Трамвайные пути посередине, на одном уровне с проезжей частью, — случай из ст. 31, п. 3.")

def b_t390(img, d, t, B, D):
    ticket(img, d, t, B, 390, "Двойная линия — разметка, не разделитель. Проезжая часть одна.")

def b_t391(img, d, t, B, D):
    ticket(img, d, t, B, 391, "Конструктивный разделитель даёт две проезжие части, не четыре полосы.")

def b_t884(img, d, t, B, D):
    ticket(img, d, t, B, 884, "Вопрос — определение из ст. 5, п. 9.")

def b_t902(img, d, t, B, D):
    ticket(img, d, t, B, 902, "Полоса движения — про то, где помещается один ряд машин, а не про то, чем её нарисовали.")

def b_t948(img, d, t, B, D):
    ticket(img, d, t, B, 948, "Нет разметки и знаков — число полос выбирает водитель по ширине.")

def b_t949(img, d, t, B, D):
    ticket(img, d, t, B, 949, "Встречная сторона — проезжая часть слева от разделительной полосы.")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

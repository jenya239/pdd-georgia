# Доски билетов ep06. Вопрос и варианты читаются из базы при рендере.
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
    txt(d, (30, 40), "Выпуск 6 · билеты про средство и трамвай", 26, WHITE, 1, "la", DJB)
    txt(d, (30, 100), "Сначала вопрос. Ответ откроется после паузы.", 18, WHITE, appear(t, 0.3), "la")

def b_t47(img, d, t, B, D):
    ticket(img, d, t, B, 47, "Рельсовый раньше безрельсового. Грузовик — встречный, который едет прямо.")

def b_t53(img, d, t, B, D):
    ticket(img, d, t, B, 53, "Сначала оба трамвая, потом легковой: помеха справа внутри каждой группы.")

def b_t69(img, d, t, B, D):
    ticket(img, d, t, B, 69, "Легковой последний. Между трамваями решает, кто справа.")

def b_t75(img, d, t, B, D):
    ticket(img, d, t, B, 75, "Светофор выключен. Трамвай раньше, затем легковой: он справа от автобуса и мотоцикла.")

def b_t521(img, d, t, B, D):
    ticket(img, d, t, B, 521, "Возраст для мопеда — ст. 43, п. 1.")

def b_t537(img, d, t, B, D):
    ticket(img, d, t, B, 537, "Вопрос перечисляет мопед, велосипед, мотоцикл и двухколёсный электросамокат. Это ровно список ст. 21, п. 11.")

def b_t826(img, d, t, B, D):
    ticket(img, d, t, B, 826, "Трёхколёсный мопед — всё ещё мопед из ст. 21, п. 11. Пункт не говорит «два колеса» и не говорит «переднее».")

def b_t892(img, d, t, B, D):
    ticket(img, d, t, B, 892, "«Загруженная масса» — фактическая масса с нагрузкой, сейчас.")

def b_t893(img, d, t, B, D):
    ticket(img, d, t, B, 893, "Масса без нагрузки — заводская, без водителя и пассажиров.")

def b_t905(img, d, t, B, D):
    ticket(img, d, t, B, 905, "Разрешённая максимальная масса — не то, что машина весит сегодня, и не предел завода с грузом и людьми.")

def b_t906(img, d, t, B, D):
    ticket(img, d, t, B, 906, "Тихоходное — с двигателем, и порог скорости ему нельзя превысить.")

def b_t921(img, d, t, B, D):
    ticket(img, d, t, B, 921, "Вопрос — определение из ст. 5, п. 46 (в законе — «легкий автомобиль»).")

def b_t922(img, d, t, B, D):
    ticket(img, d, t, B, 922, "Лёгкий прицеп: разрешённая максимальная масса не больше 750 кг.")

def b_t925(img, d, t, B, D):
    ticket(img, d, t, B, 925, "Полная масса — снаряжённое ТС с грузом, водителем и пассажирами, и предел этой суммы ставит завод (ст. 5, п. 80).")

def b_outro(img, d, t, B, D):
    txt(d, (30, 40), "Условие, не номер", 26, WHITE, 1, "la", DJB)
    chip(d, 30, 120, "соседний вариант проверяют отдельно", GOLD, appear(t, 0.4), 18)

# Доски ролика по билетам выпуска 4. Вопрос и варианты — из базы, акцент — одна плашка.
import json as _json
import re as _re
TK = str(TICKETS) + "/"
_T = {x["id"]: x for x in _json.load(open(TK + "tickets_ru.json", encoding="utf-8"))["questions"]}
_IM = {}

def _clean(s):
    return _re.sub(r"\s+", " ", s).strip()

def tk(i):
    x = _T[i]
    return _clean(x["question"]), [_clean(a["text"]) for a in x["answers"]], x["correct"] - 1, x

def shot(tid):
    if tid in _IM:
        return _IM[tid]
    rel = _T[tid].get("image")
    if not rel:
        _IM[tid] = None
        return None
    im = Image.open(TK + rel).convert("RGBA")
    w, h = im.size
    if h > int(w * 0.72):
        im = im.crop((0, 0, w, int(h * 0.72)))
    _IM[tid] = im
    return im

def draw_pic(img, d, tid, x, y, w=300):
    im = shot(tid)
    if im is None:
        return
    s = w / im.size[0]
    r = im.resize((int(w * SS), int(im.size[1] * s * SS)), Image.LANCZOS)
    put(img, r, (x * SS, y * SS))
    txt(d, (x + w, y + im.size[1] * s + 4), "рисунок из базы билетов", 11, GREY, 1, "ra")

def ticket(img, d, t, B, tid, accent):
    q, opts, correct, raw = tk(tid)
    has = bool(raw.get("image"))
    picture = (lambda img, d, t, x, y, tid=tid: draw_pic(img, d, tid, x, y)) if has else None
    y = exam(img, d, t, q, opts, correct, B.S(1), f"№ {tid}", picture=picture, pic_w=300 if has else 0,
             t_opts=[0.25 + i * 0.15 for i in range(len(opts))], tag="Билет урока")
    if t > B.S(1) - 0.2:
        chip(d, 24, min(max(y + 6, 500), 532), accent, GOLD, appear(t, B.S(1)), 14)

def b_q_chat(img, d, t, B, D):
    txt(d, (24, 36), "Билеты выпуска 4", 26, WHITE, 1, "la", DJB)
    txt(d, (24, 84), "Не пересказ урока.", 20, WHITE, appear(t, 0.2), "la")
    if t > B.S(1) - 0.2:
        chip(d, 24, 140, "один признак на билет", GOLD, appear(t, B.S(1)), 18)
        rows = [("переход", "человек и зебра под колёсами"), ("переезд", "где встать и закрытая встречная"), ("режим", "знак, не крыши; в жилой зоне 20")]
        for i, (h, s_) in enumerate(rows):
            a = appear(t, B.S(1) + 0.4 + i * 0.3)
            y = 200 + i * 78
            txt(d, (24, y), h, 20, GOLD, a, "la", DJB)
            txt(d, (24, y + 30), s_, 16, WHITE, a, "la")

def b_to_rail(img, d, t, B, D):
    txt(d, (40, 80), "Дальше — переезд", 32, WHITE, appear(t, 0.2), "la", DJB)
    chip(d, 40, 150, "где встать", GOLD, appear(t, 0.5), 18)
    chip(d, 40, 200, "встречная перед переездом закрыта", RED, appear(t, 0.9), 18)

def b_to_town(img, d, t, B, D):
    txt(d, (40, 80), "Два билета про режим", 32, WHITE, appear(t, 0.2), "la", DJB)
    chip(d, 40, 150, "населённый пункт — со знака", GOLD, appear(t, 0.5), 18)
    chip(d, 40, 200, "жилая зона — 20, не 60", BLUE, appear(t, 0.9), 18)

def b_outro(img, d, t, B, D):
    txt(d, (24, 36), "Три признака", 26, WHITE, 1, "la", DJB)
    rows = [
        (0, "Переход", "есть ли человек и не встанете ли вы на нём"),
        (0, "Переезд", "сначала светофор или линия, метры — только если их нет"),
        (1, "Жилая зона", "двадцать километров в час, не шестьдесят"),
    ]
    for i, (k, h, s_) in enumerate(rows):
        a = appear(t, B.S(k))
        y = 100 + i * 120
        txt(d, (24, y), h, 22, GOLD, a, "la", DJB)
        txt(d, (24, y + 36), s_, 16, WHITE, a, "la")

ACCENT = {
    20: "уступают все, кто поворачивает, не «самый большой»",
    150: "зелёный пускает машину, вступившего пешехода не отменяет",
    171: "поворот без зебры тоже пропускает вступившего",
    280: "шагнул с тротуара — уже «вступающий»",
    314: "5 м — перед переходом; карман знака — не автобусу",
    288: "человек на переходе — обгон закрыт",
    289: "скорость спасает только пустой переход",
    296: "можно медленно и только если на переходе никого",
    874: "низкая скорость: пешеход может вступить в момент поворота",
    875: "сигнал — когда стоять, переход и разметка — где",
    876: "гудок не вместо остановки",
    878: "не въезжать, если встанете на переходе",
    908: "один уровень, не разные; «равнина» — это полотно",
    601: "со шлагбаумом — поезд за оградой, рисунок II",
    607: "без шлагбаума — паровоз без ограды, рисунок III",
    611: "вне пункта — 150–300 м",
    670: "у перекрёстка та же дистанция, не длиннее",
    671: "в пункте — 50–100 м",
    415: "«не менее 5 м» = «не ближе»; брус не объезжать",
    422: "светофор есть — метры не выбирают",
    418: "встречная вокруг очереди перед переездом закрыта",
    435: "закрытый шлагбаум — не повод обойти сбоку",
    440: "за путями нет места — не въезжать",
    441: "остановиться надо до рельса, не на нём",
    891: "держат знаки, не слово «обустроенная»",
    515: "жилая зона — 20 км/ч",
}

def _bind(tid):
    def board(img, d, t, B, D, tid=tid):
        ticket(img, d, t, B, tid, ACCENT[tid])
    return board

for _tid in ACCENT:
    globals()[f"b_t{_tid}"] = _bind(_tid)

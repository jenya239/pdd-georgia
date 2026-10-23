# -*- coding: utf-8 -*-
"""Инлайн-SVG схемы для текстового выпуска 4. Цвета — через CSS-классы (.fig …) из web/assets/app.css,
поэтому схемы следуют светлой/тёмной теме сайта. Знаки — PNG из приложения 1 (content/assets/signs).

Все схемы вставлены в одну страницу, поэтому id внутри SVG (штриховка, стрелка) делаются
уникальными: svg(..., uid=...) заменяет локальные ссылки "#hatch"/"#ar" на "#<uid>-hatch"/"#<uid>-ar"."""
IMG = "lessons/ep04/"

LOCAL_IDS = ("hatch", "ar")


def svg(w, h, body, label, uid):
    out = (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">'
            f'<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<rect width="10" height="10" class="nozone"/><line x1="0" y1="0" x2="0" y2="10" class="nohatch"/></pattern>'
            f'<marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>'
            f'{body}</svg>')
    for name in LOCAL_IDS:
        out = out.replace(f'id="{name}"', f'id="{uid}-{name}"').replace(f"url(#{name})", f"url(#{uid}-{name})")
    return out

def car(x, y, w=74, h=36, cls="car"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" class="{cls}"/>'
            f'<rect x="{x+w-24}" y="{y+5}" width="12" height="{h-10}" rx="3" class="glass"/>'
            f'<line x1="{x+w+6}" y1="{y+h/2}" x2="{x+w+44}" y2="{y+h/2}" class="move" marker-end="url(#ar)"/>')

def sign(x, y, name, s=40):
    # столб + картинка знака на светлой подложке
    return (f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y+s+14}" class="pole"/>'
            f'<rect x="{x-s/2-3}" y="{y-3}" width="{s+6}" height="{s+6}" rx="5" class="plate"/>'
            f'<image href="{IMG}{name}.png" x="{x-s/2}" y="{y}" width="{s}" height="{s}"/>')

def street(w, top=0, road=(70, 210), bottom=280):
    y0, y1 = road
    return (f'<rect x="0" y="{top}" width="{w}" height="{y0-top}" class="walk"/>'
            f'<rect x="0" y="{y0}" width="{w}" height="{y1-y0}" class="road"/>'
            f'<rect x="0" y="{y1}" width="{w}" height="{bottom-y1}" class="walk"/>'
            f'<line x1="0" y1="{(y0+y1)/2}" x2="{w}" y2="{(y0+y1)/2}" class="paint dash"/>')

def fig_crossing_zebra():
    W, H = 600, 280
    b = street(W)
    # зона запрета остановки: 5 м перед переходом + сам переход (только правая полоса — схема)
    b += f'<rect x="300" y="142" width="50" height="66" fill="url(#hatch)"/>'
    for i in range(6):
        b += f'<rect x="350" y="{76+i*22}" width="56" height="12" class="paint"/>'
    b += car(140, 157)
    b += f'<text x="300" y="134" class="t small onroad" text-anchor="end">5 м</text>'
    b += f'<line x1="300" y1="138" x2="350" y2="138" class="dimw"/>'
    b += f'<text x="12" y="40" class="t">С разметкой 1.14.2 («зебра»)</text>'
    b += f'<text x="12" y="246" class="t small bad">Штриховка: остановка запрещена</text>'
    b += f'<text x="12" y="268" class="t small mut">ст. 37, п. 6 «а.а»: на переходе и ближе 5 м перед ним</text>'
    return svg(W, H, b, "Переход с разметкой зебра: остановка запрещена на переходе и ближе 5 метров перед ним", "ep04-f1a")

def fig_crossing_signs():
    W, H = 600, 280
    b = street(W)
    # граница перехода между знаками
    b += f'<rect x="350" y="70" width="64" height="140" class="band"/>'
    b += f'<line x1="350" y1="70" x2="350" y2="210" class="edge"/><line x1="414" y1="70" x2="414" y2="210" class="edge"/>'
    b += f'<rect x="300" y="142" width="50" height="66" fill="url(#hatch)"/>'
    b += sign(350, 214, "sign_5_19_1")   # справа по ходу движения, ближняя граница
    b += sign(414, 12, "sign_5_19_2")    # слева, дальняя граница
    b += car(140, 157)
    b += f'<text x="300" y="134" class="t small onroad" text-anchor="end">5 м</text>'
    b += f'<line x1="300" y1="138" x2="350" y2="138" class="dimw"/>'
    b += f'<text x="12" y="40" class="t">Без разметки: только знаки</text>'
    b += f'<text x="12" y="246" class="t small">5.19.1 — ближняя граница</text>'
    b += f'<text x="438" y="40" class="t small">5.19.2 —</text><text x="438" y="60" class="t small">дальняя</text>'
    b += f'<text x="382" y="110" class="t small onroad" text-anchor="middle">пере-</text><text x="382" y="128" class="t small onroad" text-anchor="middle">ход</text>'
    b += f'<text x="12" y="268" class="t small mut">прил. 1, п. 5.19; ст. 5, п. 86 (груз. текст)</text>'
    return svg(W, H, b, "Переход без разметки: границы задают знак 5.19.1 справа и знак 5.19.2 слева", "ep04-f1b")

def fig_railway():
    W, H = 640, 330
    y0, y1 = 120, 220
    b = f'<rect x="0" y="0" width="{W}" height="{H}" class="verge"/>'
    b += f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" class="road"/>'
    b += f'<line x1="0" y1="{(y0+y1)/2}" x2="{W}" y2="{(y0+y1)/2}" class="paint dash"/>'
    # путь: шпалы и рельсы (вертикально)
    for yy in range(4, H, 14):
        if y0 - 4 < yy < y1 + 4: continue
        b += f'<rect x="496" y="{yy}" width="48" height="6" class="sleeper"/>'
    b += f'<line x1="506" y1="0" x2="506" y2="{H}" class="rail"/><line x1="534" y1="0" x2="534" y2="{H}" class="rail"/>'
    # шлагбаум в правой полосе
    b += f'<rect x="452" y="{y1+4}" width="12" height="12" class="pole2"/>'
    b += f'<line x1="458" y1="{y1+8}" x2="458" y2="{(y0+y1)/2+4}" class="barrier"/>'
    # стоп-место
    b += f'<line x1="410" y1="{(y0+y1)/2+2}" x2="410" y2="{y1-2}" class="paint thick"/>'
    b += car(300, 178, w=70, h=32)
    # размеры (не в масштабе)
    b += f'<line x1="40" y1="34" x2="506" y2="34" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>'
    b += f'<text x="44" y="26" class="t small">100 м перед переездом: обгон запрещён</text>'
    b += f'<line x1="250" y1="86" x2="506" y2="86" class="dim bad" marker-start="url(#ar)" marker-end="url(#ar)"/>'
    b += f'<line x1="534" y1="86" x2="636" y2="86" class="dim bad" marker-start="url(#ar)"/>'
    b += f'<text x="254" y="78" class="t small bad">50 м: стоянка запрещена</text>'
    b += f'<line x1="410" y1="{y1+30}" x2="458" y2="{y1+30}" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>'
    b += f'<text x="404" y="{y1+36}" class="t small" text-anchor="end">≥ 5 м до шлагбаума</text>'
    b += f'<text x="404" y="{y1+60}" class="t small mut" text-anchor="end">нет шлагбаума — ≥ 10 м до рельса</text>'
    b += sign(70, y1+16, "sign_1_1", s=44)
    b += f'<text x="100" y="{y1+100}" class="t small mut">1.1 — за 150–300 м вне н. п.</text>'
    b += f'<text x="{W-8}" y="20" class="t small mut" text-anchor="end">не в масштабе</text>'
    return svg(W, H, b, "Железнодорожный переезд: 100 метров без обгона, 50 метров без стоянки, остановка не ближе 5 метров до шлагбаума", "ep04-f2")

def fig_levels():
    W, H = 640, 270
    # левая панель: трамвай на своём полотне пересекает дорогу на одном уровне
    b = f'<rect x="0" y="0" width="310" height="{H}" class="verge"/>'
    b += f'<rect x="0" y="100" width="310" height="80" class="road"/>'
    b += f'<rect x="185" y="0" width="70" height="{H}" class="bed"/>'
    b += f'<rect x="185" y="100" width="70" height="80" class="road"/>'
    b += f'<line x1="205" y1="0" x2="205" y2="{H}" class="rail"/><line x1="235" y1="0" x2="235" y2="{H}" class="rail"/>'
    b += car(40, 124, w=64, h=32)
    b += f'<text x="12" y="30" class="t">Одном уровне</text><text x="12" y="52" class="t small">трамвай на своём полотне</text>'
    b += f'<text x="12" y="215" class="t small ok">= переезд (ст. 5, п. 58)</text>'
    b += f'<text x="12" y="238" class="t small mut">действуют правила ст. 39</text>'
    # правая панель: мост над железной дорогой
    x = 330
    b += f'<rect x="{x}" y="0" width="310" height="{H}" class="verge"/>'
    for xx in range(x+4, x+310, 14): b += f'<rect x="{xx}" y="156" width="6" height="48" class="sleeper"/>'
    b += f'<line x1="{x}" y1="166" x2="{x+310}" y2="166" class="rail"/><line x1="{x}" y1="194" x2="{x+310}" y2="194" class="rail"/>'
    b += f'<rect x="{x+150}" y="0" width="80" height="{H}" class="shadow"/>'
    b += f'<rect x="{x+140}" y="0" width="80" height="{H}" class="road"/>'
    b += f'<line x1="{x+140}" y1="0" x2="{x+140}" y2="{H}" class="railing"/><line x1="{x+220}" y1="0" x2="{x+220}" y2="{H}" class="railing"/>'
    b += f'<text x="{x+12}" y="30" class="t">Разные уровни</text><text x="{x+12}" y="52" class="t small">дорога по мосту</text>'
    b += f'<text x="{x+12}" y="238" class="t small bad">≠ переезд</text>'
    b += f'<line x1="320" y1="0" x2="320" y2="{H}" class="sep"/>'
    return svg(W, H, b, "Слева: пересечение с трамваем на своём полотне на одном уровне — переезд. Справа: мост — не переезд", "ep04-f3")

def house(x, y, w=26, h=22):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="house"/><path d="M{x-3},{y} L{x+w/2},{y-12} L{x+w+3},{y} z" class="roof"/>'

def plate(x, y, txt, end=False):
    s = (f'<line x1="{x}" y1="{y+30}" x2="{x}" y2="{y+58}" class="pole"/>'
         f'<rect x="{x-44}" y="{y}" width="88" height="34" rx="3" class="plate2"/>'
         f'<text x="{x}" y="{y+23}" class="t small" text-anchor="middle">{txt}</text>')
    if end: s += f'<line x1="{x-40}" y1="{y+31}" x2="{x+40}" y2="{y+3}" class="slash"/>'
    return s

def fig_town():
    W, H = 640, 300
    b = f'<rect x="0" y="0" width="{W}" height="{H}" class="verge"/>'
    b += f'<rect x="0" y="176" width="{W}" height="56" class="road"/>'
    b += f'<line x1="0" y1="204" x2="{W}" y2="204" class="paint dash"/>'
    for xx in list(range(96, 190, 34)) + list(range(256, 470, 34)) + list(range(530, 620, 34)):
        b += house(xx, 140)
    b += plate(222, 92, "5.23.x")
    b += plate(500, 92, "5.24.x", end=True)
    b += f'<line x1="222" y1="64" x2="500" y2="64" class="dim" marker-start="url(#ar)" marker-end="url(#ar)"/>'
    b += f'<text x="361" y="54" class="t" text-anchor="middle">режим н. п.: 60 км/ч</text>'
    b += f'<text x="12" y="30" class="t small">вне н. п. (B — до 90)</text>'
    b += f'<text x="{W-12}" y="30" class="t small" text-anchor="end">вне н. п.</text>'
    b += f'<text x="12" y="262" class="t small mut">Дома до знака — ещё не населённый пункт.</text>'
    b += f'<text x="12" y="286" class="t small mut">Границу режима задаёт знак (ст. 5, п. 17; ст. 33, п. 6).</text>'
    b += car(20, 186, w=56, h=28)
    return svg(W, H, b, "Населённый пункт начинается со знака начала, а не с первых домов; внутри — 60 км/ч", "ep04-f4")

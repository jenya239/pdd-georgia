# -*- coding: utf-8 -*-
"""Инлайн-SVG схемы для текстового выпуска 5 (участники движения). Цвета — через CSS-классы (.fig …)
из web/assets/app.css, поэтому схемы следуют светлой/тёмной теме. Uid каждой схемы начинается с "ep05-"."""

LOCAL_IDS = ("ar",)


def svg(w, h, body, label, uid):
    out = (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">'
           f'<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
           f'<path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>{body}</svg>')
    for name in LOCAL_IDS:
        out = out.replace(f'id="{name}"', f'id="{uid}-{name}"').replace(f"url(#{name})", f"url(#{uid}-{name})")
    return out


def person(x, y, s=1.0):
    """Стоящий человечек; (x, y) — макушка."""
    return (f'<circle cx="{x}" cy="{y+7*s}" r="{7*s}" class="head"/>'
            f'<path d="M{x},{y+14*s} L{x},{y+38*s} M{x},{y+20*s} L{x-10*s},{y+32*s} M{x},{y+20*s} L{x+10*s},{y+32*s} '
            f'M{x},{y+38*s} L{x-8*s},{y+56*s} M{x},{y+38*s} L{x+8*s},{y+56*s}" class="ppl"/>')


def bike(x, y, r=13):
    """Велосипед; (x, y) — центр заднего колеса."""
    d = 2.6 * r
    return (f'<circle cx="{x}" cy="{y}" r="{r}" class="ppl"/><circle cx="{x+d}" cy="{y}" r="{r}" class="ppl"/>'
            f'<path d="M{x},{y} L{x+d*.45},{y-r*1.2} L{x+d*.9},{y-r*1.2} L{x+d},{y} M{x+d*.45},{y-r*1.2} L{x+d*.5},{y} L{x},{y} '
            f'M{x+d*.9},{y-r*1.2} L{x+d*.85},{y-r*1.8}" class="ppl"/>')


def wheelchair(x, y):
    """Человек в инвалидной коляске; (x, y) — центр большого колеса."""
    return (f'<circle cx="{x}" cy="{y}" r="15" class="ppl"/><circle cx="{x+26}" cy="{y+10}" r="5" class="ppl"/>'
            f'<circle cx="{x}" cy="{y-46}" r="7" class="head"/>'
            f'<path d="M{x},{y-39} L{x},{y-18} L{x+22},{y-18} L{x+24},{y+4} M{x},{y-32} L{x+14},{y-24} M{x-12},{y-28} L{x-12},{y-8}" class="ppl"/>')


def car_side(x, y, w=86):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="26" rx="7" class="car"/>'
            f'<rect x="{x+18}" y="{y-16}" width="{w-38}" height="20" rx="6" class="car"/>'
            f'<rect x="{x+24}" y="{y-12}" width="{(w-50)/2}" height="13" rx="3" class="glass"/>'
            f'<circle cx="{x+18}" cy="{y+28}" r="8" class="head"/><circle cx="{x+w-18}" cy="{y+28}" r="8" class="head"/>')


def role_row(y, cls, title, verdict, cite, drawing):
    return (f'<rect x="8" y="{y}" width="624" height="104" rx="10" class="box {cls}"/>'
            f'<text x="24" y="{y+28}" class="t small">{title}</text>'
            f'<text x="24" y="{y+56}" class="t">{verdict}</text>'
            f'<text x="24" y="{y+84}" class="t small mut">{cite}</text>{drawing}')


def fig_roles():
    b = ""
    b += role_row(8, "hl", "Управляет машиной", "водитель", "ст. 5, п. 49", car_side(470, 48) + person(524, 8, .5))
    b += role_row(120, "eq", "Ведёт велосипед рядом", "пешеход", "ст. 5, п. 87", person(470, 128) + bike(510, 176, 11))
    b += role_row(232, "eq", "В инвалидной коляске", "пешеход", "ст. 5, п. 87", wheelchair(500, 292))
    b += role_row(344, "hl", "Входит в машину", "пассажир", "ст. 5, п. 34",
                  f'<rect x="500" y="360" width="90" height="64" rx="8" class="car"/>' + person(470, 352, .7))
    b += role_row(456, "hl", "Инструктор, идёт учебная езда", "приравнен к водителю", "ст. 5, п. 49",
                  car_side(470, 496) + person(500, 456, .45) + person(530, 456, .45))
    b += role_row(568, "hl", "Регулировщик", "управляет движением", "ст. 5, п. 32",
                  person(520, 576) + '<line x1="530" y1="608" x2="560" y2="586" class="ppl"/>')
    return svg(640, 680, b, "Роль зависит от действия. Регулировщик управляет движением: это не четвёртая роль участника", "ep05-roles")


def fig_outside():
    W, H = 660, 360
    b = f'<rect x="0" y="0" width="{W}" height="{H}" class="verge"/>'
    b += f'<rect x="0" y="62" width="{W}" height="26" class="bed"/><rect x="0" y="228" width="{W}" height="26" class="bed"/>'
    b += f'<rect x="0" y="88" width="{W}" height="140" class="road"/>'
    b += f'<line x1="0" y1="158" x2="{W}" y2="158" class="paint dash"/>'
    # машины: верхняя полоса едет влево, нижняя — вправо
    b += f'<rect x="470" y="104" width="74" height="36" rx="8" class="car"/><line x1="462" y1="122" x2="410" y2="122" class="move" marker-end="url(#ar)"/>'
    b += f'<rect x="60" y="176" width="74" height="36" rx="8" class="car"/><line x1="142" y1="194" x2="194" y2="194" class="move" marker-end="url(#ar)"/>'
    # пешеход на левой (для него) обочине идёт навстречу машинам верхней полосы
    b += person(250, 30, .75) + f'<line x1="266" y1="56" x2="306" y2="56" class="move" marker-end="url(#ar)"/>'
    b += f'<text x="290" y="22" class="t small">пешеход: обочина слева, навстречу движению</text>'
    # ведёт велосипед — правая сторона проезжей части
    b += person(300, 166, .75) + bike(318, 212, 10)
    b += f'<line x1="372" y1="200" x2="412" y2="200" class="move" marker-end="url(#ar)"/>'
    b += wheelchair(470, 212)
    b += f'<text x="12" y="280" class="t small">ведёт велосипед, мопед, мотоцикл; в инвалидной коляске —</text><text x="12" y="300" class="t small">по правой стороне проезжей части</text>'
    b += f'<text x="12" y="324" class="t small mut">ст. 24, п. 5: вне населённого пункта, двустороннее движение,</text><text x="12" y="344" class="t small mut">нет разделительной полосы и тротуара</text>'
    b += f'<text x="12" y="80" class="t small mut">обочина</text><text x="12" y="246" class="t small mut">обочина</text>'
    return svg(W, H, b, "Вне населённого пункта пешеход идёт по обочине навстречу движению, а ведущий велосипед и человек в инвалидной коляске — по правой стороне проезжей части", "ep05-out")


def fig_boarding():
    W, H = 660, 300
    b = f'<rect x="0" y="0" width="{W}" height="70" class="walk"/><text x="12" y="26" class="t small mut">тротуар</text>'
    b += f'<rect x="0" y="70" width="{W}" height="200" class="road"/><line x1="0" y1="170" x2="{W}" y2="170" class="paint dash"/>'
    # машина у тротуара, едет вправо
    b += f'<rect x="200" y="82" width="150" height="70" rx="12" class="car"/><rect x="216" y="90" width="34" height="54" rx="5" class="glass"/>'
    b += f'<line x1="262" y1="82" x2="300" y2="56" class="ppl"/><line x1="262" y1="152" x2="300" y2="178" class="ppl"/>'
    b += person(300, 4, .6) + f'<text x="318" y="30" class="t small ok">сначала — сторона тротуара</text>'
    b += person(300, 178, .6) + f'<text x="318" y="212" class="t small warn">со стороны дороги — если иначе нельзя</text><text x="318" y="232" class="t small warn">и без помех другим</text>'
    b += f'<rect x="20" y="186" width="70" height="34" rx="8" class="car"/><line x1="96" y1="203" x2="150" y2="203" class="move" marker-end="url(#ar)"/>'
    b += f'<text x="12" y="290" class="t small mut">ст. 23, п. 1: садиться и выходить — после полной остановки</text>'
    return svg(W, H, b, "Посадка и высадка: сначала со стороны тротуара, со стороны проезжей части — только если иначе нельзя и нет помех", "ep05-board")

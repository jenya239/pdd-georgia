# -*- coding: utf-8 -*-
"""Инлайн-SVG схемы для текстового выпуска 6 (транспортные средства). Цвета — через CSS-классы (.fig …),
поэтому схемы следуют светлой/тёмной теме. Uid каждой схемы начинается с "ep06-"."""

LOCAL_IDS = ("ar",)


def svg(w, h, body, label, uid):
    out = (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">'
           f'<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
           f'<path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>{body}</svg>')
    for name in LOCAL_IDS:
        out = out.replace(f'id="{name}"', f'id="{uid}-{name}"').replace(f"url(#{name})", f"url(#{uid}-{name})")
    return out


def node(x, y, w, txt, cls="", sub=""):
    h = 46 if sub else 32
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" class="box {cls}"/>'
    out += f'<text x="{x+w/2}" y="{y+21}" text-anchor="middle" class="t small">{txt}</text>'
    if sub:
        out += f'<text x="{x+w/2}" y="{y+38}" text-anchor="middle" class="t small mut">{sub}</text>'
    return out


def edge(x1, y1, x2, y2):
    return f'<path d="M{x1},{y1} L{x1},{(y1+y2)/2} L{x2},{(y1+y2)/2} L{x2},{y2}" class="tree"/>'


def fig_tree():
    W, H = 680, 330
    b = node(240, 8, 200, "Транспортное средство", "hl", "п. 73")
    b += edge(340, 54, 120, 92) + edge(340, 54, 340, 92) + edge(340, 54, 570, 92)
    b += node(20, 92, 200, "Без двигателя", "", "велосипед п. 22, гужевой п. 78")
    b += node(240, 92, 200, "Механическое (самоход)", "hl", "с двигателем, п. 35")
    b += node(460, 92, 210, "С двигателем, но НЕ механ.", "no", "исключения п. 35")
    b += edge(340, 138, 110, 180) + edge(340, 138, 270, 180) + edge(340, 138, 420, 180)
    b += node(20, 180, 180, "Автомобиль, п. 5", "", "троллейбус да, трактор нет")
    b += node(210, 180, 120, "Мопед", "", "п. 42")
    b += node(340, 180, 120, "Мотоцикл", "", "п. 44")
    b += node(476, 180, 194, "электросамокат", "no", "п. 56")
    b += node(476, 232, 194, "велосипед с подв. двиг.", "no", "п. 28 → велосипед")
    b += node(476, 284, 194, "рельсовое: трамвай", "no", "п. 40 (электротранспорт)")
    b += f'<text x="20" y="262" class="t small mut">Прицеп (п. 39) — тоже ТС,</text><text x="20" y="282" class="t small mut">хотя сам «движется» только</text><text x="20" y="302" class="t small mut">с помощью «иной силы» — тягача.</text>'
    return svg(W, H, b, "Дерево определений: транспортное средство, механическое, исключения из механических", "ep06-tree")


def fig_scale():
    W, H = 680, 330
    x0, k = 40, 12  # 1 км/ч = 12 px; шкала 0..50
    X = lambda v: x0 + v * k
    b = f'<line x1="{X(0)}" y1="270" x2="{X(50)}" y2="270" class="tree"/>'
    for v in (0, 25, 40, 45):
        b += f'<line x1="{X(v)}" y1="264" x2="{X(v)}" y2="276" class="tree"/><text x="{X(v)}" y="294" text-anchor="middle" class="t small">{v}</text>'
    b += f'<text x="{X(50)}" y="318" text-anchor="end" class="t small mut">км/ч (конструктивная скорость)</text>'
    rows = [
        (0, 25, "eq", "велосипед с подвесным двигателем: ≤ 50 см³ или электро ≤ 4 кВт", "п. 28"),
        (25, 45, "eq", "…он же до 45 км/ч, если электромотор ≤ 1 кВт", "п. 28"),
        (25, 45, "hl", "мопед: ≤ 50 см³ или электро > 1 и ≤ 4 кВт", "п. 42"),
        (45, 50, "no", "мотоцикл: > 45 км/ч или > 50 см³", "п. 44"),
        (0, 40, "", "тихоходное ТС: ≤ 40 км/ч", "п. 53"),
    ]
    for i, (a, z, cls, txt, cite) in enumerate(rows):
        y = 8 + i * 50
        b += f'<text x="{x0}" y="{y+14}" class="t small">{txt} <tspan class="mut">({cite})</tspan></text>'
        b += f'<rect x="{X(a)}" y="{y+22}" width="{(z-a)*k}" height="20" rx="5" class="box {cls}"/>'
    return svg(W, H, b, "Шкала конструктивной скорости: велосипед с подвесным двигателем до 25 или до 45 при малой мощности, мопед 25–45, мотоцикл свыше 45, тихоходное до 40", "ep06-scale")


def fig_tram():
    W, H = 520, 460
    c = 260
    b = f'<rect x="0" y="0" width="{W}" height="{H}" class="verge"/>'
    b += f'<rect x="{c-70}" y="0" width="140" height="{H}" class="road"/><rect x="0" y="{c-70}" width="{W}" height="140" class="road"/>'
    b += f'<line x1="{c}" y1="0" x2="{c}" y2="{c-70}" class="paint dash"/><line x1="{c}" y1="{c+70}" x2="{c}" y2="{H}" class="paint dash"/>'
    b += f'<line x1="0" y1="{c}" x2="{c-70}" y2="{c}" class="paint dash"/><line x1="{c+70}" y1="{c}" x2="{W}" y2="{c}" class="paint dash"/>'
    # рельсы по горизонтальной дороге (нижняя полоса, трамвай едет слева направо — для A он слева)
    b += f'<line x1="0" y1="{c+24}" x2="{W}" y2="{c+24}" class="rail"/><line x1="0" y1="{c+46}" x2="{W}" y2="{c+46}" class="rail"/>'
    b += f'<rect x="{c-236}" y="{c+12}" width="130" height="46" rx="8" class="car tram"/><text x="{c-171}" y="{c+41}" text-anchor="middle" class="t">Т</text>'
    b += f'<line x1="{c-98}" y1="{c+35}" x2="{c-50}" y2="{c+35}" class="move" marker-end="url(#ar)"/>'
    # автомобиль снизу (трамвай для него слева)
    b += f'<rect x="{c+12}" y="{c+110}" width="40" height="66" rx="8" class="car"/><text x="{c+32}" y="{c+149}" text-anchor="middle" class="t small">A</text>'
    b += f'<line x1="{c+32}" y1="{c+102}" x2="{c+32}" y2="{c+76}" class="move" marker-end="url(#ar)"/>'
    b += '<rect x="4" y="6" width="412" height="88" rx="8" class="box"/>'
    b += f'<text x="12" y="24" class="t small">Равнозначные дороги, знаков и светофора нет.</text>'
    b += f'<text x="12" y="44" class="t small">Трамвай слева от A, но едет первым:</text>'
    b += f'<text x="12" y="64" class="t small ok">рельсовое ТС имеет преимущество (ст. 36, п. 4 «в»)</text>'
    b += f'<text x="12" y="84" class="t small mut">правило правой руки — только между безрельсовыми</text>'
    return svg(W, H, b, "Перекрёсток равнозначных дорог: трамвай приближается слева от автомобиля и проезжает первым", "ep06-tram")

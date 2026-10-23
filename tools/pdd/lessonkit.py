"""HTML building blocks for text lessons (pure string functions).

Verbatim law quotes are rendered with `lq`; tests check every quote against the law text
(tests/py/test_lessons.py), so `lq` must only ever receive text copied from data/sources."""
from __future__ import annotations

WHO = {"a": "Аня", "m": "Макс", "t": "Сергей Павлович"}


def chat(*lines):
    return '<div class="chat">' + "".join(
        f'<div class="say {k}"><span class="ava" aria-hidden="true">{WHO[k][0]}</span>'
        f'<div class="bub"><b class="who">{WHO[k]}</b>{t}</div></div>'
        for k, t in lines) + "</div>"


def lq(text, cite, src="law"):
    """Verbatim quote; data-src tells the checker where to look (law / annex)."""
    return f'<blockquote class="lq" data-src="{src}"><p>«{text}»</p><cite>{cite}</cite></blockquote>'


def fig(svgcode, cap):
    return f'<figure class="fig">{svgcode}<figcaption>{cap}</figcaption></figure>'


def gl(term, expl):
    return f'<span class="gl"><b>{term}</b> — {expl}</span>'


def signrow(items, img_dir, caption):
    return '<figure class="signs">' + "".join(
        f'<div class="sg"><span class="sgimg"><img src="{img_dir}{f}.png" alt="Знак {n}" loading="lazy"></span>'
        f'<b>{n}</b><span>{c}</span></div>'
        for f, n, c in items) + f'<figcaption>{caption}</figcaption></figure>'

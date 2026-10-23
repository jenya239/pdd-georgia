# -*- coding: utf-8 -*-
"""Shared cast and script conventions of the series (identical in every episode).

Beat = (who, setting, chat_bubble_or_None, [sentences], board_key); sentence = str, float pause, or (subtitle, spoken).
"""
VOICES = {"a": ("ru-RU-SvetlanaNeural", "+10%", "+0Hz"),
          "t": ("ru-RU-DmitryNeural", "+8%", "-6Hz"),
          "m": ("en-US-BrianMultilingualNeural", "+12%", "+0Hz")}
NAMES = {"a": "Аня", "m": "Макс", "t": "Сергей Павлович"}
ROLES = {"a": "учится водить", "m": "водитель со стажем", "t": "инструктор"}
CHAT_TITLE = "Права · Тбилиси"
CHAT_AV = ("ПДД", (40, 110, 200))
LOC_BASE = {"chat": "Чат «Права · Тбилиси»", "board": "Автошкола · класс теории", "web": "Браузер · matsne.gov.ge"}


def say(s):
    """What the voice speaks (float = pause in seconds)."""
    return s[1] if isinstance(s, tuple) else s


def sub(s):
    """What the subtitle shows."""
    return s[0] if isinstance(s, tuple) else s

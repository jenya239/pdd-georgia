#!/usr/bin/env python3
"""Turn a raw chat transcript (ReadTranscript dumps: JSON lines {role, message:{content:[...]}}) into history/dialog.md.

What the reader gets: every message of Evgeniy verbatim (with its timestamp) and every message the bot showed him
(SendToUser content, cards, attachments as plain paths). Hidden reasoning, tool calls and tool results are dropped;
a few notable actions (background tasks, pushes) are summarised in italics. Secrets are redacted (pdd.secretscan).

usage: python3 tools/dialog_export.py OUT.md PART1.txt [PART2.txt …]   (parts in chronological order)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdd import secretscan  # noqa: E402

TS = re.compile(r"<timestamp>(.*?)</timestamp>")
TAG = re.compile(r"^\[(t\d+u)\]\s*$")
MACHINE = re.compile(r"^\[Sent from machine [^\]]*\]\s*$")
ANSWER = re.compile(r'^\[Answering your question [^:]*: "(.*)"\]\s*$')
TASK = re.compile(r'Background task "(.*?)" \((\w+)\) (finished|failed)')
SHA = re.compile(r"(?<![0-9a-f])[0-9a-f]{7}(?![0-9a-f])")
MONTHS = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}


def load(paths):
    out = []
    for p in paths:
        for line in Path(p).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("{"):
                out.append(json.loads(line))
    return out


def short_ts(ts):
    """'Friday, Oct 23, 2026, 4:09 PM (UTC+4)' → '2026-10-23 16:09 (UTC+4, Тбилиси)'."""
    m = re.match(r"\w+, (\w{3}) (\d+), (\d{4}), (\d+):(\d+) (AM|PM)", ts or "")
    if not m:
        return ts or ""
    mon, day, year, h, mi, ap = m.groups()
    h = int(h) % 12 + (12 if ap == "PM" else 0)
    return f"{year}-{MONTHS[mon]:02d}-{int(day):02d} {h:02d}:{mi} (UTC+4, Тбилиси)"


def query_body(text):
    m = re.search(r"<user_query>\n?(.*?)\n?</user_query>", text, re.S)
    return m.group(1) if m else text


def user_message(text):
    """→ (kind, body): kind 'user' | 'voice' | 'answer' | 'task' | 'secret' | None (internal prompt, skipped)."""
    body = query_body(text)
    if "GROK_BOT_OWNER_VOICE_PROMPT" in body:
        said = [ln.strip()[len("the call:"):].strip() for ln in body.splitlines() if ln.strip().startswith("the call:")]
        return "voice", "\n".join(s for s in said if not s.startswith("The call ended"))
    if "A background task just completed" in body:
        m = TASK.search(body)
        rest = body[m.end():] if m else ""
        shas = sorted(set(SHA.findall(rest)))
        return "task", (m.group(1), m.group(3), shas) if m else ("?", "finished", [])
    if "securely provided the requested secret" in body:
        m = re.search(r'requested secret: "(.*?)"', body)
        return "secret", m.group(1) if m else ""
    if "GROK_BOT_HIDDEN_PROMPT" in body or text.lstrip().startswith("<memory_context"):
        return None, ""
    lines = body.splitlines()
    kind = "user"
    if lines and ANSWER.match(lines[0]):
        kind = "answer"
    lines = [ln for ln in lines if not TAG.match(ln) and not MACHINE.match(ln)]
    return kind, "\n".join(lines).strip()


def tag_of(text):
    m = re.search(r"^\[(t\d+u)\]", query_body(text), re.M)
    return m.group(1) if m else ""


def quote(text):
    return "\n".join("> " + ln if ln else ">" for ln in text.splitlines())


def bot_message(inp):
    parts = []
    kind = inp.get("type")
    if inp.get("channel", "").startswith("voice:"):
        parts.append("_(ответ в голосовой звонок)_")
    if kind == "widget":
        w = inp.get("widget", {})
        opts = "\n".join(f"- {o.get('label', '')}" for o in w.get("options", []))
        parts.append(f"_Карточка-вопрос:_ **{w.get('prompt', '')}**\n\n{opts}")
    elif kind == "attachment":
        parts.append(f"_Вложение:_ `{inp.get('url', '').replace('file://', '')}` — {inp.get('alt', '')}")
    elif kind == "secret-request":
        s = inp.get("secret", {})
        label = s.get("label") or s.get("name") or "секрет"
        parts.append(f"_Запрос секрета через защищённую форму: «{label}» (значение в диалог не попадает)_")
    if inp.get("content"):
        parts.append(inp["content"])
    for img in inp.get("images", []) or []:
        parts.append(f"_Скриншот:_ `{img.get('url', '').replace('file://', '')}` — {img.get('alt', '')}")
    return "\n\n".join(parts)


def notable(tool):
    name, inp = tool.get("name"), tool.get("input", {})
    if name == "CallDynamicTool" and inp.get("toolName") == "Task":
        d = inp.get("arguments", {}).get("description", "")
        return f"_⚙ запущена фоновая задача: {d}_" if d else ""
    if name == "Shell" and re.search(r"\bgit\b[^\n]*\bpush\b", inp.get("command", "")):
        return "_⚙ push в github.com/jenya239/pdd-georgia (main)_"
    return ""


def memory_snapshot(entries):
    """Latest <memory_context> the platform injected: the bot's durable facts about the user (a summary of earlier context)."""
    snap = []
    for e in entries:
        text = "".join(it.get("text", "") for it in e.get("message", {}).get("content", []) if e.get("role") == "user")
        m = re.search(r"<memory_context>(.*?)</memory_context>", text, re.S)
        if m:
            snap = [ln.strip() for ln in m.group(1).splitlines() if ln.strip().startswith("- (learned")]
    return snap


def missing_tags(entries):
    nums = sorted({int(t[1:-1]) for e in entries if e.get("role") == "user"
                   for t in [tag_of("".join(it.get("text", "") for it in e["message"]["content"]))] if t})
    return [f"t{n}u" for n in range(nums[0], nums[-1] + 1) if n not in nums] if nums else []


def render(entries):
    out = ["# Диалог: курс «ПДД Грузии» (и предыстория — видео по матанализу)", "",
           "Архив переписки Евгения с ботом «3» (Grok Bot) с 18.10.2026 по 27.10.2026. Сообщения Евгения — дословно, "
           "ответы бота — дословно так, как их видел пользователь. Скрытые рассуждения, вызовы инструментов и их результаты "
           "опущены; заметные действия кратко отмечены курсивом (⚙). Время — Тбилиси (UTC+4). Секреты вычищены "
           "(`tools/pdd/secretscan.py`, тест `tests/py/test_secretscan.py`). Сгенерировано `tools/dialog_export.py`.", ""]
    out += ["## Сводка более раннего контекста", "",
            "Выгрузка начинается с самого первого хода бота (18.10.2026, 13:48), сжатой сводки более ранней истории в ней нет. "
            "Ниже — последний снимок долговременной памяти бота о пользователе (так платформа подавала боту контекст, "
            "дословно, по-английски):", ""]
    out += memory_snapshot(entries) + [""]
    gaps = missing_tags(entries)
    if gaps:
        out += [f"**Пробелы выгрузки.** Не попали в выгрузку: {', '.join(gaps)}. Длинные служебные записи "
                "в транскрипте обрезаны на ~4000 символах вместе с идущим за ними текстом. Судя по памяти бота (выше) "
                "и ответам бота, это была просьба сделать единую панель «после ответа» у каждого билета "
                "(пояснение, перевод, история ответов и т.п.).", ""]
    out += ["## Переписка", ""]
    ts, users, last_bot = "", 0, None
    for e in entries:
        role, items = e.get("role"), e.get("message", {}).get("content", [])
        if role == "user":
            text = "".join(it.get("text", "") for it in items)
            m = TS.search(text)
            ts = short_ts(m.group(1)) if m else ts
            kind, body = user_message(text)
            if kind in ("user", "answer"):
                users += 1
                head = f"### 👤 Евгений — {ts}" + (f" `[{tag_of(text)}]`" if tag_of(text) else "")
                if kind == "answer":
                    q = ANSWER.match(query_body(text).splitlines()[0]).group(1)
                    body = f"_(ответ на карточку «{q}»)_\n\n" + body.split("\n", 1)[-1].strip()
                out += [head, "", body, ""]
            elif kind == "voice":
                users += 1
                out += [f"### 👤 Евгений (голосовой звонок, пересказ платформы) — {ts}", "", quote(body), ""]
            elif kind == "task":
                title, status, shas = body
                st = "завершена" if status == "finished" else "прервана"
                extra = f"; в отчёте упомянуты коммиты: {', '.join(shas)}" if shas else ""
                out += [f"_⚙ {ts}: фоновая задача {st}: «{title}»{extra}_", ""]
            elif kind == "secret":
                out += [f"_⚙ {ts}: Евгений передал секрет «{body}» через защищённую форму (значение в диалоге отсутствует)_", ""]
        elif role == "assistant":
            for it in items:
                if it.get("type") != "tool_use":
                    continue
                if it.get("name") == "SendToUser":
                    msg = bot_message(it.get("input", {}))
                    if msg and msg != last_bot:
                        out += [f"**🤖 Бот** — {ts}", "", msg, ""]
                    elif msg:
                        out += ["_(бот повторно отправил предыдущее сообщение)_", ""]
                    last_bot = msg or last_bot
                else:
                    n = notable(it)
                    if n:
                        out += [n, ""]
    text = "\n".join(out).rstrip() + "\n"
    return secretscan.redact(text), users


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    text, users = render(load(argv[2:]))
    Path(argv[1]).write_text(text, encoding="utf-8")
    print(f"{argv[1]}: {len(text.encode())} bytes, {users} user messages")


if __name__ == "__main__":
    main(sys.argv)

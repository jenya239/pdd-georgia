#!/usr/bin/env python3
import glob, re, json, os, collections
from bs4 import BeautifulSoup as B
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "tickets")  # repo data/tickets
TOPICS = {}
def parse(loc):
    out = {}
    for f in sorted(glob.glob(f"{D}/raw/{loc}_t*_p*.html")):
        topic = int(re.search(r"_t(\d+)_", f).group(1))
        s = B(open(f).read(), "html.parser")
        if not TOPICS:
            for a in s.select('.tickets-topics-list a[href^="/tickets/2/"]'):
                n = int(a["href"].rsplit("/", 1)[1]); TOPICS[n] = a.get("title") or a.get_text(" ", strip=True)
        for a in s.select("article.ticket-container"):
            tid = int(a.select_one(".t-num").get_text(strip=True).lstrip("#"))
            img = a.select_one("figure.t-image img")
            q = a.select_one(".t-question-inner").get_text(" ", strip=True)
            answers, correct = [], []
            for p in a.select(".t-cover p.t-answer"):
                if "ans-empty" in p.get("class", []): continue
                num = int(p.select_one(".t-a-num").get_text(strip=True))
                answers.append({"n": num, "text": p.select_one(".t-a-text").get_text(" ", strip=True)})
                if p.get("data-is-correct-list") == "true": correct.append(num)
            d = a.select_one(".desc-box-inner")
            expl = "\n".join(p.get_text(" ", strip=True) for p in d.find_all("p") if "sorry" not in (p.get("class") or [])) if d else ""
            expl = re.sub(r"[ \t\u00a0]+", " ", expl).strip()
            rec = {"id": tid, "topic": topic, "question": q, "answers": answers, "correct": correct,
                   "image_url": img["src"] if img else None, "explanation_ka": expl}
            if tid in out and out[tid]["topic"] != topic: out[tid].setdefault("extra_topics", []).append(topic)
            else: out[tid] = rec
    return out
if __name__ == "__main__":
    res = {loc: parse(loc) for loc in ("ru", "ka", "en")}
    json.dump({"topics": TOPICS, "data": {k: list(v.values()) for k, v in res.items()}}, open(f"{D}/parsed_all.json", "w"), ensure_ascii=False)
    for k, v in res.items(): print(k, len(v))

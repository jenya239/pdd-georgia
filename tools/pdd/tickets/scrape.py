#!/usr/bin/env python3
"""Polite fetch of teoria.on.ge category B (cat_id=2) ticket list pages, per topic and locale.
Saves raw HTML to data/tickets/raw/{loc}_t{topic}_p{page}.html. ~1 req / 1.2 s."""
import json, os, re, sys, time, urllib.parse, requests
BASE = "https://teoria.on.ge"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "tickets", "raw")  # git-ignored: teoria.on.ge HTML is not republished
s = requests.Session(); s.headers["User-Agent"] = UA
def get(url, loc):
    ck = urllib.parse.quote(json.dumps({"category": 2, "locale": loc, "skin": "dark", "user": 0}, separators=(",", ":")))
    for attempt in range(3):
        r = s.get(url, cookies={"exam-settings": ck}, timeout=30)
        time.sleep(1.2)
        if r.status_code == 200: return r.text
        print("HTTP", r.status_code, url, file=sys.stderr)
        if r.status_code in (403, 429): sys.exit("blocked -> stop")
        time.sleep(5)
    raise SystemExit("failed " + url)
for loc in sys.argv[1:]:
    for topic in range(1, 33):
        page = 1
        while True:
            fn = f"{OUT}/{loc}_t{topic}_p{page}.html"
            if os.path.exists(fn): html = open(fn).read()
            else:
                html = get(f"{BASE}/tickets/2/{topic}?page={page}", loc)
                if 'captcha' in html.lower() and 'recaptcha' not in html.lower(): sys.exit("captcha -> stop")
                open(fn, "w").write(html)
            m = re.search(r"სულ (\d+) ბილეთი", html); total = int(m.group(1)) if m else 0
            n = html.count('<article class="ticket-container')
            print(loc, topic, page, n, total, flush=True)
            if page * 20 >= total or n == 0: break
            page += 1

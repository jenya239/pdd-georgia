import json, os, time, requests, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "tickets")  # repo data/tickets
d = json.load(open(f"{D}/parsed_all.json"))
urls = sorted({r["image_url"] for r in d["data"]["ru"] if r["image_url"]})
s = requests.Session(); s.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
bad = []
for i, u in enumerate(urls):
    fn = f"{D}/images/" + u.rsplit("/", 1)[1]
    if os.path.exists(fn) and os.path.getsize(fn) > 0: continue
    try:
        r = s.get(u.replace("http://", "https://"), timeout=30)
        if r.status_code in (403, 429): sys.exit(f"blocked {r.status_code} -> stop")
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"): open(fn, "wb").write(r.content)
        else: bad.append((u, r.status_code, r.headers.get("content-type")))
    except Exception as e: bad.append((u, str(e), None))
    time.sleep(1.0)
    if i % 50 == 0: print(i, len(urls), flush=True)
json.dump(bad, open(f"{D}/images_failed.json", "w"), indent=1)
print("done", len(urls), "failed", len(bad))

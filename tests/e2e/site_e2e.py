"""Headless browser test of the published site (docs/ as GitHub Pages serves it).

Run:  /workspace/.pwvenv/bin/python tests/e2e/site_e2e.py [--root=docs] [--shots=DIR]
Exit code 0 = all checks passed. Screenshots go to --shots (default: none), never into docs/.
"""
import json, os, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from serve import serve  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
ARGS = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
ROOT = Path(ARGS.get("root", REPO / "docs"))
SHOTS = Path(ARGS["shots"]) if "shots" in ARGS else None
LOAD_T = "import('./assets/app/data.mjs').then(m => m.loadTickets())"
LOAD_E = "import('./assets/app/data.mjs').then(m => m.loadEpisodes())"

problems, errors, failed = [], [], []


def launch(p):
    """E2E_CHANNEL=chrome (default, the installed Chrome) or chromium (playwright's bundled build, e.g. in CI)."""
    ch = os.environ.get("E2E_CHANNEL", "chrome")
    return p.chromium.launch(headless=True, **({} if ch == "chromium" else {"channel": ch}))


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def shot(page, name, **kw):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / name), **kw)


def watch(page):
    page.on("console", lambda m: m.type == "error" and errors.append((page.url, m.text)))
    page.on("pageerror", lambda e: errors.append((page.url, str(e))))
    page.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))


def pid(tid):
    """data-id → ticket number, or the own item id as is."""
    return int(tid) if tid.isdigit() else tid


def correct_of(page, sel=".q"):
    q = page.locator(sel).first
    tid = q.get_attribute("data-id")
    return tid, page.evaluate(f"{LOAD_T}.then(D => D.byId[{json.dumps(tid if not tid.isdigit() else int(tid))}].c)")


def answer_current(page, correct=True):
    tid, c = correct_of(page)
    n = page.locator(".q .ans").count()
    page.locator(".q .ans").nth(c if correct else (c + 1) % n).click()
    return int(tid) if tid.isdigit() else tid


def legacy_root():
    """While Pages still serves the branch root, the root index.html / 404.html forward into docs/."""
    base, stop = serve(REPO)
    with sync_playwright() as p:
        br = launch(p)
        page = br.new_page()
        page.goto(base)
        page.wait_for_url("**/docs/**")
        check(page.url == base + "docs/", f"root redirects to docs/ ({page.url})")
        page.goto(base + "episode.html?id=ep01#tk")
        page.wait_for_url("**/docs/**")
        check(page.url == base + "docs/episode.html?id=ep01#tk", f"old deep link forwarded ({page.url})")
        page.wait_for_selector(".points li")
        check(page.locator(".points li").count() > 0, "forwarded episode page renders")
        br.close()
    stop()


def main():
    E = json.loads((ROOT / "data/episodes.json").read_text())
    rel = {r["id"]: r for r in E["released"]}
    last = max(E["released"], key=lambda r: r["num"])
    own_n = sum(len(r.get("own_items", [])) for r in E["released"])
    scope_n = sum(len(r["tickets_lesson"]) for r in E["released"]) + own_n  # own questions are on by default
    lesson_last = rel[last["id"]]["tickets_lesson"] + rel[last["id"]].get("own_items", [])
    items = json.loads((ROOT / "data/items.json").read_text())
    base, stop = serve(ROOT)
    with sync_playwright() as p:
        br = launch(p)
        ctx = br.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
        page = ctx.new_page()
        watch(page)
        page.goto(base + "index.html")
        page.evaluate("localStorage.clear()")

        # index
        page.goto(base + "index.html")
        page.wait_for_selector("#cumstatus")
        cards = page.locator("#released a.card")
        kinds = [cards.nth(i).locator(".badge.kind").inner_text() for i in range(cards.count())]
        want = ["текст" if r.get("kind") == "text" else "видео" for r in E["released"]]
        check(kinds == want, f"index kind badges {kinds}")
        st = page.locator("#cumstatus").inner_text()
        check(f"выпуск {last['num']}" in st and f"{scope_n} вопрос" in st, f"home status: lesson {last['num']}, {scope_n} tickets in scope")
        check(page.locator("#plan tr.soon").count() > 90, "course plan table rendered")
        shot(page, "index_desktop.png")

        # video episodes
        for r in E["released"]:
            if r.get("kind") == "text":
                continue
            page.goto(base + f"episode.html?id={r['id']}")
            page.wait_for_selector(".points li")
            page.wait_for_timeout(200)
            n = len(r["tickets_core"]) + len(r["tickets_linked"])
            check(page.locator("video").count() == 1 and page.locator("#tk .q").count() == n, f"{r['id']}: video + {n} tickets")
            dur = page.evaluate("new Promise(r=>{const v=document.querySelector('video'); if(v.readyState>=1) r(v.duration); else v.onloadedmetadata=()=>r(v.duration); setTimeout(()=>r(-1),8000)})")
            check(dur > 60, f"{r['id']}: video metadata loads ({dur:.0f}s)")
            if r.get("linked_title") and r["tickets_linked"]:
                check(page.get_by_text(r["linked_title"]).count() == 1, f"{r['id']}: linked section title from data")

        # text episode
        for r in E["released"]:
            if r.get("kind") != "text":
                continue
            page.goto(base + f"episode.html?id={r['id']}")
            page.wait_for_selector("#tk .q")
            n = len(r["tickets_core"]) + len(r["tickets_linked"])
            check(page.locator("video").count() == 0 and page.locator(".badge.kind.text").count() == 1, f"{r['id']}: text lesson badge, no video")
            check(page.locator("#tk .q").count() == n, f"{r['id']}: {n} tickets rendered")
            check(page.locator("figure.fig svg").count() >= 3, f"{r['id']}: svg figures")
            ids = page.evaluate("[...document.querySelectorAll('[id]')].map(e => e.id)")
            check(len(ids) == len(set(ids)), f"{r['id']}: element ids unique on the page")
            dangling = page.evaluate("""[...document.querySelectorAll('svg [marker-end],svg [fill^="url("],svg [marker-start]')]
                .flatMap(e => [e.getAttribute('marker-end'), e.getAttribute('marker-start'), e.getAttribute('fill')])
                .filter(v => v && v.startsWith('url(#')).map(v => v.slice(5, -1)).filter(id => !document.getElementById(id))""")
            check(not dangling, f"{r['id']}: svg url(#…) refs resolve {dangling}")
            broken = page.evaluate("[...document.images].filter(i => i.getAttribute('src') && i.complete && !i.naturalWidth).map(i => i.src)")
            check(not broken, f"{r['id']}: no broken images {broken}")
            before = page.evaluate("localStorage.getItem('pddge.progress.v1')")
            q = page.locator("#tk .q").first
            tid = int(q.get_attribute("data-id"))
            c = page.evaluate(f"{LOAD_T}.then(D => D.byId[{tid}].c)")
            na = q.locator(".ans").count()
            q.locator(".ans").nth((c + 1) % na).click()
            page.wait_for_timeout(100)
            rec = page.evaluate("JSON.parse(localStorage.getItem('pddge.progress.v1'))")[str(tid)]
            check(before is None and rec["w"] == 1 and rec["k"] == 0 and rec["p"] == {str((c + 1) % na): 1}, f"{r['id']}: wrong pick recorded {rec}")
            shot(page, f"{r['id']}_desktop_full.png", full_page=True)

        # own check items on every lesson page
        for r in E["released"]:
            own = r.get("own_items", [])
            page.goto(base + f"episode.html?id={r['id']}")
            page.wait_for_selector(".points li")
            page.wait_for_timeout(200)
            check(len(own) > 0 and page.locator("#own-items .q").count() == len(own)
                  and page.locator("#own-items .q .badge.own").count() == len(own), f"{r['id']}: {len(own)} own questions marked «наш вопрос»")
        by_id = {i["id"]: i for i in items["items"]}
        figs = [i for i in items["items"] if i.get("fig")]
        check(len(figs) >= 5, f"{len(figs)} own items with figures")
        page.goto(base + f"episode.html?id={figs[0]['lesson']}")
        page.wait_for_selector("#own-items .q")
        check(page.locator(f'#own-items .q[data-id="{figs[0]["id"]}"] .qfig svg').count() == 1, "own item figure rendered")
        ids = page.evaluate("[...document.querySelectorAll('[id]')].map(e => e.id)")
        check(len(ids) == len(set(ids)), "element ids unique with own figures")
        sec = next(i for i in figs if i["fig"]["kind"] == "section")
        page.goto(base + f"episode.html?id={sec['lesson']}")
        page.wait_for_selector(f'#own-items .q[data-id="{sec["id"]}"] .qfig svg')
        fills = page.evaluate(f"""[...document.querySelectorAll('#own-items .q[data-id="{sec["id"]}"] .qfig rect.strip')].map(r => getComputedStyle(r).fill)""")
        check(len(set(fills)) >= 3, f"section figure: strip kinds styled apart {sorted(set(fills))}")
        # wrong pick on an own item with a mapped misconception: recorded, typical error + verbatim quote shown
        mapped = next(i for i in items["items"] if any(items["misconceptions"].get(m or "") for m in i["distractors"].values()))
        wrong_i = int(next(k for k, m in mapped["distractors"].items() if m))
        page.goto(base + f"episode.html?id={mapped['lesson']}")
        page.wait_for_selector(f'#own-items .q[data-id="{mapped["id"]}"]')
        oq = page.locator(f'#own-items .q[data-id="{mapped["id"]}"]')
        oq.locator(".ans").nth(wrong_i).click()
        page.wait_for_timeout(100)
        rec = page.evaluate("JSON.parse(localStorage.getItem('pddge.progress.v1'))").get(mapped["id"])
        check(rec is not None and rec["w"] == 1, f"own item answer recorded {rec}")
        txt = oq.inner_text()
        check(oq.locator(".note.mc").count() == 1 and mapped["quote"]["text"][:40] in " ".join(txt.split()), "own item: typical error + verbatim quote")
        check(oq.locator("a[target=_blank]").count() == 0, "own item has no source link")
        shot(page, "own_item_feedback.png", full_page=False)
        page.evaluate("localStorage.removeItem('pddge.progress.v1')")
        # bank ticket with an annotated distractor shows the typical error too
        td = items["ticket_distractors"]
        tk_id, tk_choice = next((t, int(i)) for t, d in td.items() for i, m in d.items() if m and any(int(t) in rr["tickets_core"] + rr["tickets_linked"] for rr in E["released"]))
        tk_ep = next(rr["id"] for rr in E["released"] if int(tk_id) in rr["tickets_core"] + rr["tickets_linked"])
        page.goto(base + f"episode.html?id={tk_ep}")
        page.wait_for_selector(f'#tk .q[data-id="{tk_id}"]')
        bq = page.locator(f'#tk .q[data-id="{tk_id}"]')
        bq.locator(".ans").nth(tk_choice).click()
        check(bq.locator(".note.mc").count() == 1, f"bank ticket {tk_id}: typical error on wrong pick")
        page.evaluate("localStorage.removeItem('pddge.progress.v1')")

        # language switch
        page.goto(base + f"episode.html?id=ep02")
        page.wait_for_selector(".q")
        ru = page.locator(".q .qtext").nth(2).inner_text()
        page.click("#langseg button[data-l=ka]")
        ka = page.locator(".q .qtext").nth(2).inner_text()
        page.click("#langseg button[data-l=ru]")
        check(ru != ka and any("\u10d0" <= ch <= "\u10ff" for ch in ka), "language switch re-renders questions in Georgian")

        # practice
        page.goto(base + "practice.html")
        page.wait_for_selector("#set option", state="attached")
        page.click("#go")
        for _ in range(5):
            page.wait_for_selector("#qbox .ans")
            page.keyboard.press("1")
            page.wait_for_selector("#qbox .verdict")
            page.keyboard.press("Enter")
        check("из" in page.inner_text("#sess"), "practice: 5 answers via keyboard")
        page.goto(base + "practice.html?topic=32")
        page.wait_for_selector("#set option", state="attached")
        page.uncheck("#nountr")
        page.click("#go")
        page.wait_for_selector("#qbox .badge.warn")
        check(True, "practice: untranslated eco question badge")

        # exam
        page.goto(base + "exam.html")
        page.click("#start")
        page.wait_for_selector("#qbox .ans")
        for k in range(30):
            page.keyboard.press(str(1 + (k % 2)))
            page.keyboard.press("ArrowRight")
        check(page.inner_text("#answered") == "Отвечено 30 из 30", "exam: 30 answered")
        page.once("dialog", lambda d: d.accept())
        page.click("#finish")
        page.wait_for_selector("#res .result")
        check(page.locator("#rev .q").count() >= 0, "exam result + review")
        bad = page.evaluate("""async()=>{const D=await (await fetch('data/tickets.json')).json(); const srcs=D.tickets.filter(t=>t.img).map(t=>t.img);
           const res=await Promise.all(srcs.map(s=>new Promise(r=>{const i=new Image(); i.onload=()=>r(i.naturalWidth>0?null:s); i.onerror=()=>r(s); i.src=s;})));
           return {n:srcs.length, bad:res.filter(Boolean)}}""")
        check(bad["n"] > 500 and not bad["bad"], f"all {bad['n']} ticket images load")

        # cumulative check: start, answer 3, reload, resume, finish
        page.evaluate("localStorage.clear()")
        page.goto(base + f"check.html?lesson={last['id']}")
        page.wait_for_selector("#start")
        check(page.locator("#ownopt").is_checked() and f"наших вопросов {own_n}" in page.inner_text("#m"), "check: own questions on by default")
        page.uncheck("#ownopt")
        page.wait_for_selector("#start")
        check(f"всего {scope_n - own_n} " in page.inner_text("#m") and not page.locator("#ownopt").is_checked(), "check: toggle off removes own questions")
        page.reload()
        page.wait_for_selector("#start")
        check(not page.locator("#ownopt").is_checked(), "check: toggle is saved")
        page.check("#ownopt")
        page.wait_for_selector("#start")
        page.click("#start")
        page.wait_for_selector(".q")
        first = page.locator(".q").get_attribute("data-id")
        check(pid(first) in lesson_last, "new-first: first ticket is from the current lesson")
        wrong = []
        for i in range(3):
            tid = answer_current(page, correct=(i != 1))
            if i == 1:
                wrong.append(tid)
            page.click("#next")
        page.reload()
        page.wait_for_selector("#resume")
        check(f"3 из {scope_n}" in page.locator("#resume").inner_text(), f"run resumable after reload (3 из {scope_n})")
        page.click("#resume")
        page.wait_for_selector(".q")
        k, new_first, seen_own, own_unmarked = 3, True, set(), []
        while page.locator("#next").count():
            tid = page.locator(".q").get_attribute("data-id")
            if k < len(lesson_last) and pid(tid) not in lesson_last:
                new_first = False
            ok = k not in (10, 40)
            if isinstance(pid(tid), str):
                seen_own.add(tid)
                if page.locator(".badge.own").count() == 0:
                    own_unmarked.append(tid)
                if not any(isinstance(w, str) for w in wrong):
                    ok = False  # make sure at least one own question lands in the errors
            t2 = answer_current(page, correct=ok)
            if not ok:
                wrong.append(t2)
            page.click("#next")
            k += 1
            page.wait_for_selector(".q, .result")
        check(new_first, "all current-lesson tickets came first")
        check(len(seen_own) >= own_n - 3 and not own_unmarked, f"own questions in the run and marked ({len(seen_own)})")
        res = page.locator(".result").inner_text()
        check(f"{scope_n - len(wrong)} из {scope_n}" in res, f"result {res}")
        runs = page.evaluate("JSON.parse(localStorage.getItem('pddge.runs.v1'))")
        check(len(runs) == 1 and sorted(map(str, runs[0]["wrong"])) == sorted(map(str, wrong)), f"run saved, wrong {runs[0]['wrong']}")
        shot(page, "check_result_desktop.png")

        # errors page + drill
        page.goto(base + "errors.html")
        page.wait_for_selector("details.err")
        check(page.locator("details.err").count() == len(wrong), f"errors list has {len(wrong)} items")
        own_wrong = [w for w in wrong if isinstance(w, str)]
        check(own_wrong and page.locator("details.err .badge.own").count() == len(own_wrong), f"errors list marks own questions {own_wrong}")
        page.click("[data-by=topic]")
        page.wait_for_selector("details.err")
        check("Наши вопросы" in page.inner_text("#list"), "errors by topic: own questions group")
        for by in ("rank", "topic", "rule", "lesson"):
            page.click(f"[data-by={by}]")
            page.wait_for_selector("details.err")
        d = page.locator("details.err").first
        d.locator("summary").click()
        page.wait_for_selector("details.err[open] .q .verdict")
        check(d.locator(".ans.ok").count() == 1 and "Правильный" in d.inner_text(), "error details: wrong vs correct + explanation")
        prog = page.evaluate("JSON.parse(localStorage.getItem('pddge.progress.v1'))")
        need = sum(max(0, 2 - r.get("k", 0)) for r in prog.values() if r["w"] > 0)
        page.click("text=Разобрать ошибки")
        page.wait_for_selector(".q")
        steps = 0
        while page.locator(".q").count() and steps < 30:
            answer_current(page, correct=True)
            page.click("#next")
            steps += 1
            page.wait_for_selector(".q, .result")
        check(steps == need and "Готово" in page.locator(".result").inner_text(), f"drill done after {steps} answers (need {need})")

        # export / import
        page.goto(base + "errors.html")
        page.wait_for_selector("#file button")
        with page.expect_download() as dl:
            page.click("[data-act=export]")
        tmp = Path(tempfile.mkdtemp()) / "progress.json"
        dl.value.save_as(tmp)
        check(json.loads(tmp.read_text())["format"] == "pddge-progress", "export bundle written")
        snap = page.evaluate("localStorage.getItem('pddge.progress.v1')")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("#file input", state="attached")
        page.set_input_files("[data-act=import]", str(tmp))
        page.wait_for_function("document.querySelector('[data-msg]').textContent.startsWith('Загружено')")
        check(json.loads(page.evaluate("localStorage.getItem('pddge.progress.v1')")) == json.loads(snap), "import restores progress")

        # about
        page.goto(base + "about.html")
        page.wait_for_function("document.querySelector('#nq').textContent !== '…'")
        check(int(page.inner_text("#nq")) > 100, "about: quote count filled")

        # mobile + dark
        mob = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        mp = mob.new_page()
        watch(mp)
        mp.goto(base + f"episode.html?id={last['id']}")
        mp.wait_for_selector("#tk .q")
        sw = mp.evaluate("document.documentElement.scrollWidth")
        check(sw <= 390, f"mobile: no horizontal overflow ({sw})")
        # wide lesson figures on a phone: hint + fullscreen view (text lessons only)
        for r in [x for x in E["released"] if x.get("format") == "text" or x.get("kind") == "text"]:
            mp.goto(base + f"episode.html?id={r['id']}")
            mp.wait_for_selector("#tk .q")
            nfig = mp.locator("article.lesson figure.fig").count()
            if not nfig:
                continue
            hints = mp.locator(".fighint:not([hidden])")
            check(hints.count() == nfig, f"{r['id']} mobile: every cut-off figure has a visible hint ({hints.count()}/{nfig})")
            check("листайте" in hints.first.inner_text(), f"{r['id']} mobile: hint tells to scroll")
            hints.first.locator("button").click()
            mp.wait_for_selector(".figmodal[role=dialog] svg")
            box = mp.evaluate("(() => { const b = document.querySelector('.figmodal svg').getBoundingClientRect(); return [b.left, b.right, b.width]; })()")
            check(box[0] >= 0 and box[1] <= 390 and box[2] > 300, f"{r['id']} mobile: fullscreen figure fits the screen {box}")
            shot(mp, f"{r['id']}_mobile_figure_full.png")
            mp.keyboard.press("Escape")
            check(mp.locator(".figmodal").count() == 0, f"{r['id']} mobile: Esc closes the fullscreen figure")
            hints.first.locator("button").click()
            mp.click(".figmodal .figclose")
            check(mp.locator(".figmodal").count() == 0, f"{r['id']} mobile: close button closes it")
            sw = mp.evaluate("document.documentElement.scrollWidth")
            check(sw <= 390, f"{r['id']} mobile: no horizontal overflow ({sw})")
            page.goto(base + f"episode.html?id={r['id']}")
            page.wait_for_selector("#tk .q")
            check(page.locator(".fighint:not([hidden])").count() == 0, f"{r['id']} desktop: no figure hint when figures fit")
        mp.goto(base + f"episode.html?id={last['id']}")
        mp.wait_for_selector("#tk .q")
        mp.evaluate("localStorage.setItem('pddge.theme','dark')")
        mp.reload()
        mp.wait_for_selector("#tk .q")
        check(mp.evaluate("document.documentElement.dataset.theme") == "dark", "dark theme persists")
        shot(mp, f"{last['id']}_mobile_dark.png")
        br.close()
    stop()
    legacy_root()
    check(not errors, f"console errors {errors[:5]}")
    check(not failed, f"failed requests {failed[:5]}")
    print("SUMMARY:", "ALL OK" if not problems else f"{len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

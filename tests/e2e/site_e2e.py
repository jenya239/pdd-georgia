"""Headless browser test of the published site (docs/ as GitHub Pages serves it).

Run:  /workspace/.pwvenv/bin/python tests/e2e/site_e2e.py [--root=docs] [--shots=DIR]
Exit code 0 = all checks passed. Screenshots go to --shots (default: none), never into docs/.
"""
import json, os, re, sys, tempfile
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


def norms(br, base):
    """Norm links: hover panel (desktop), bottom sheet (touch), permanent norm pages and the index."""
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    watch(page)
    page.goto(base + "episode.html?id=ep05")
    page.wait_for_selector("article.lesson a.nref")
    n_links = page.locator("article.lesson a.nref").count()
    check(n_links > 10, f"norm links: ep05 lesson has {n_links} auto-linked references")
    a = page.locator('article.lesson a.nref[data-norm="st5-p87"]').first
    a.scroll_into_view_if_needed()
    page.evaluate("window.scrollBy(0, 200 - document.querySelector('article.lesson a.nref[data-norm=\"st5-p87\"]').getBoundingClientRect().top)")
    a.hover()
    page.wait_for_selector("#npop:not([hidden]) .npop-x[lang=ru]")
    ru = page.evaluate("fetch('norm/chunks/st5.json').then(r => r.json()).then(c => c['st5-p87'].ru)")
    shown = page.inner_text("#npop .npop-x")
    check(ru and " ".join(shown.split())[:120] == " ".join(ru.split())[:120], f"hover panel shows the verbatim RU text of ст. 5, п. 87 ({shown[:50]!r})")
    side = page.get_attribute("#npop", "data-side")
    pb, lb = page.locator("#npop").bounding_box(), page.locator("article.lesson").first.bounding_box()
    check(side == "right" and pb["x"] >= lb["x"] + lb["width"], f"panel sits in the right margin beside the text ({side}, x={pb['x']:.0f})")
    check(page.get_attribute("#npop a.btn", "href").endswith("norm/st5-p87.html") and page.locator("#npop [data-copy]").count() == 1,
          "panel has the permanent link and a copy button")
    check(a.get_attribute("aria-expanded") == "true", "link reports aria-expanded")
    page.locator("#npop").hover()
    page.wait_for_timeout(500)
    check(page.locator("#npop:not([hidden])").count() == 1, "panel stays open while the pointer is inside")
    shot(page, "norm_hover_panel_desktop.png")
    page.keyboard.press("Escape")
    check(page.locator("#npop[hidden]").count() == 1, "Esc closes the panel")
    page.mouse.move(5, 5)
    page.wait_for_timeout(400)
    page.locator("article.lesson a.nref").nth(3).focus()
    page.wait_for_selector("#npop:not([hidden]) .npop-x")
    check(True, "keyboard focus opens the panel")
    page.keyboard.press("Escape")
    page.evaluate("localStorage.setItem('pddge.theme','dark')")  # norm page in the dark theme
    page.goto(base + "norm/st5-p87.html")
    page.wait_for_selector("header.top")
    txt = page.inner_text("main")
    check("ст. 5, п. 87" in txt and "Пешеход" in txt, "norm page: citation and RU text")
    check(page.locator(".backlinks a[href*='episode.html?id=ep05']").count() > 0, "norm page: backlink to the ep05 lesson")
    check(page.locator(".backlinks a.btn[href*='practice.html?ids=']").count() >= 1, "norm page: «solve all» questions link")
    check(page.locator(".nnav a").count() >= 2 and page.locator("a[href*='matsne.gov.ge']").count() >= 1, "norm page: navigation and matsne source")
    shot(page, "norm_page_st5-p87.png", full_page=False)
    page.locator(".backlinks a.btn[href*='practice.html?ids=']").first.click()
    page.wait_for_selector("#set option[value=ids]", state="attached")
    check(page.input_value("#set") == "ids", "«solve all» opens practice with exactly these questions")
    page.goto(base + "norm/sign-5.19.1.html")
    check(page.locator("figure.nimg img").evaluate("i => i.complete && i.naturalWidth > 0"), "sign page shows the sign image")
    page.goto(base + "norm/index.html")
    page.wait_for_selector("#ncount")
    total = page.locator("ul.nindex li").count()
    page.fill("#nq", "ст. 37, п. 6")
    vis = page.locator("ul.nindex li:not([hidden])")
    ids = vis.evaluate_all("ls => ls.map(l => l.dataset.id)")
    check(total > 1400 and ids and all(i.startswith("st37-p6") for i in ids), f"index search filters ({len(ids)} of {total}: {ids[:4]})")
    ctx.close()
    mob = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = mob.new_page()
    watch(mp)
    mp.goto(base + "episode.html?id=ep05")
    mp.wait_for_selector("article.lesson a.nref")
    link = mp.locator('article.lesson a.nref[data-norm="st5-p87"]').first
    link.scroll_into_view_if_needed()
    link.tap()
    mp.wait_for_selector("#npop.sheet:not([hidden]) .npop-x")
    box = mp.locator("#npop").bounding_box()
    check(abs(box["y"] + box["height"] - 844) < 2 and box["width"] >= 388, f"mobile: tap opens a bottom sheet {box}")
    check("episode.html" in mp.url, "mobile: first tap does not navigate")
    shot(mp, "norm_mobile_sheet.png")
    mp.click("#npop .npop-close")
    check(mp.locator("#npop[hidden]").count() == 1, "mobile: close button closes the sheet")
    sw = mp.evaluate("document.documentElement.scrollWidth")
    check(sw <= 390, f"mobile: no horizontal overflow with the «Закон» nav item ({sw})")
    mp.goto(base + "norm/st37-p6-a-a.html")
    sw = mp.evaluate("document.documentElement.scrollWidth")
    check(sw <= 390, f"mobile: norm page has no horizontal overflow ({sw})")
    mob.close()


HEADER_PAGES = [("index.html", "eps"), ("practice.html", "practice"), ("exam.html", "exam"), ("errors.html", "errors"),
                ("about.html", "about"), ("check.html?ep=ep04", "eps"), ("episode.html?id=ep05", "eps"),
                ("norm/index.html", "law"), ("norm/st5-p87.html", "law")]
# the visible top-level header items; all of them must sit on one line
HEADER_ITEMS = """[...document.querySelectorAll('header.top .brand, header.top .menubtn, header.top nav.main > a, header.top .tools .iconbtn')]
  .filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && !e.closest('nav.main.open'))
  .map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]; })"""


def breakdowns(br, base):
    """Pilot «Разбор»: a tab of the post-answer panel; tickets without one have no such tab."""
    page = br.new_page(viewport={"width": 1280, "height": 1000})
    watch(page)
    page.goto(base + "practice.html?ids=54")
    page.wait_for_selector("#set option[value=ids]", state="attached")
    page.click("#go")
    page.wait_for_selector('.q[data-id="54"] .ans')
    check(page.locator(".br, .tdet").count() == 0, "breakdown hidden before answering")
    answer_current(page, correct=False)
    page.click('.q .tdet [role=tab][data-tab="br"]')
    d = page.locator('.q .tdet [data-panel="br"]')
    check(d.is_visible() and d.locator(".br").count() == 1, "answered ticket 54: «Разбор» tab")
    check(d.locator("blockquote.lawquote a.nref[href='norm/st5-p37.html']").count() == 1, "breakdown quote links its norm")
    check(d.locator(".whynot li").count() == 2 and d.locator("a[href='episode.html?id=ep03']").count() == 1,
          "breakdown: one line per wrong option + lesson link")
    d.evaluate("e => e.scrollIntoView({block: 'end'})")
    shot(page, "breakdown_open.png")
    page.goto(base + "practice.html?ids=1")
    page.wait_for_selector("#set option[value=ids]", state="attached")
    page.click("#go")
    page.wait_for_selector('.q[data-id="1"] .ans')
    answer_current(page)
    check(page.locator(".q .fb .verdict").count() == 1 and page.locator('.tdet [data-tab="br"], .br').count() == 0, "ticket without breakdown: no «Разбор» tab")
    page.close()


def machine_translation(br, base):
    """Georgian-only bank explanation: Russian machine translation first (with norm links), original collapsed."""
    page = br.new_page(viewport={"width": 1280, "height": 1000})
    watch(page)
    page.goto(base + "practice.html?ids=1")
    page.wait_for_selector("#set option[value=ids]", state="attached")
    page.click("#go")
    page.wait_for_selector('.q[data-id="1"] .ans')
    answer_current(page)
    page.click('.q .tdet [role=tab][data-tab="ex"]')
    e = page.locator('.q .tdet [data-panel="ex"] .expl')
    check("машинный перевод" in e.locator(".small").first.inner_text() and e.locator(".exru a.nref").count() >= 1,
          "ticket 1: explanation in Russian machine translation with norm links")
    d = e.locator("details.exka")
    check(d.get_attribute("open") is None and d.locator(".ka").is_hidden(), "Georgian original collapsed by default")
    d.locator("summary").click()
    check(d.locator(".ka").is_visible() and d.locator(".ka a.nref").count() >= 1, "original (KA) opens with its links")
    e.evaluate("e => e.scrollIntoView({block: 'end'})")
    shot(page, "explanation_mt.png")
    page.close()


TAB_ORDER = ["ex", "br", "norms", "hist", "mc", "note"]


def panel_ok(q):
    """The one post-answer panel: tabs in the fixed order, one selected, a panel per tab, note tab always there."""
    tabs = q.locator(".tdet [role=tablist] [role=tab]")
    ids = [tabs.nth(i).get_attribute("data-tab") for i in range(tabs.count())]
    sel = [tabs.nth(i).get_attribute("aria-selected") for i in range(tabs.count())]
    panels = q.locator(".tdet [role=tabpanel]")
    vis = [panels.nth(i).is_visible() for i in range(panels.count())]
    return (q.locator(".tdet").count() == 1 and len(ids) >= 2 and ids == [t for t in TAB_ORDER if t in ids] and "note" in ids
            and sel.count("true") == 1 and panels.count() == len(ids) and vis.count(True) == 1)


def ticket_details(br, base):
    """Unified post-answer panel: same structure everywhere, history from two views, a note that survives export/import."""
    ctx = br.new_context(viewport={"width": 1280, "height": 1000})
    page = ctx.new_page()
    watch(page)
    page.goto(base + "practice.html?ids=54")
    page.wait_for_selector("#set option[value=ids]", state="attached")
    page.click("#go")
    page.wait_for_selector('.q[data-id="54"] .ans')
    check(page.locator(".tdet").count() == 0, "details: nothing before answering")
    answer_current(page, correct=False)
    q = page.locator('.q[data-id="54"]')
    check(panel_ok(q), "practice: details panel under the verdict")
    labels = q.locator(".tdet [role=tab]").all_inner_texts()
    check(labels[:3] == ["Пояснение", "Разбор", "Нормы"] and "Моя история" in labels and "Заметка" in labels, f"ticket 54 tabs {labels}")
    q.locator('.tdet [data-tab="norms"]').click()
    page.wait_for_function("document.querySelector('.tdet [data-panel=norms] .dntext')?.textContent.length > 20")
    check(q.locator('.tdet [data-panel="norms"] a.nref[href="norm/st36-p4-v.html"]').count() >= 1
          and q.locator('.tdet [data-panel="norms"] a[href="episode.html?id=ep03"]').count() == 1, "norms tab: permalinks, verbatim text, lesson link")
    # keyboard: arrows move between tabs, End → last; the choice is remembered
    q.locator('.tdet [role=tab][aria-selected=true]').focus()
    page.keyboard.press("ArrowRight")
    check(q.locator('.tdet [role=tab][aria-selected=true]').get_attribute("data-tab") == "hist"
          and page.evaluate("document.activeElement.dataset.tab") == "hist", "keyboard: ArrowRight → next tab, focused")
    hist = q.locator('.tdet [data-panel="hist"] .dhist li')
    check(hist.count() == 1 and "самопроверка" in hist.first.inner_text() and "неверно" in hist.first.inner_text(), "history: the practice attempt")
    page.keyboard.press("End")
    check(q.locator('.tdet [role=tab][aria-selected=true]').get_attribute("data-tab") == "note", "keyboard: End → «Заметка»")
    check(page.evaluate("JSON.parse(localStorage.getItem('pddge.settings.v1')).tab") == "note", "last tab stored in settings")
    q.locator(".dnote").fill("Помеха справа — уступить.")
    q.locator("[data-save]").click()
    check("сохранена" in q.locator("[data-status]").inner_text() and q.locator(".notemark").is_visible()
          and q.locator('.tdet [data-tab="note"]').inner_text() == "Заметка •", "note saved, marker shown")
    # second view: the lesson page — note marker before answering, remembered tab, two attempts in history
    page.goto(base + "episode.html?id=ep03")
    page.wait_for_selector('#tk .q[data-id="54"] .ans')
    lq = page.locator('#tk .q[data-id="54"]')
    check(lq.locator(".notemark").is_visible() and lq.locator(".tdet").count() == 0, "lesson: note marker on the unanswered ticket, no panel yet")
    c = page.evaluate(f"{LOAD_T}.then(D => D.byId[54].c)")
    lq.locator(".ans").nth(c).click()
    check(panel_ok(lq) and lq.locator('.tdet [role=tab][aria-selected=true]').get_attribute("data-tab") == "note"
          and lq.locator(".dnote").input_value() == "Помеха справа — уступить.", "lesson: same panel, opens on the remembered tab with the note")
    lq.locator('.tdet [data-tab="hist"]').click()
    items = lq.locator('.tdet [data-panel="hist"] .dhist li').all_inner_texts()
    check(len(items) == 2 and "урок" in items[0] and "верно" in items[0] and "самопроверка" in items[1], f"history from two views, newest first {items}")
    lq.evaluate("e => e.scrollIntoView({block: 'center'})")
    shot(page, "details_desktop.png")
    # own item: the applicable subset
    own = page.locator("#own-items .q").first
    if own.count():
        own.locator(".ans").first.click()
        tabs = [own.locator(".tdet [role=tab]").nth(i).get_attribute("data-tab") for i in range(own.locator(".tdet [role=tab]").count())]
        check(panel_ok(own) and "br" not in tabs and "norms" in tabs, f"own item: same panel, its subset {tabs}")
    # errors page: marker + «only with notes» filter
    page.goto(base + "errors.html")
    page.wait_for_selector("details.err")
    check(page.locator('details.err[data-id="54"] .badge.note').count() == 1, "errors: note marker on the ticket")
    page.check("#onlynotes")
    page.wait_for_selector("details.err")
    check(page.locator("details.err").count() == 1 and "notes=1" in page.url, "errors: filter «only with notes»")
    # export → clear → import keeps the note and the history
    with page.expect_download() as dl:
        page.click("header.top [data-act=export]")
    tmp = Path(tempfile.mkdtemp()) / "notes.json"
    dl.value.save_as(tmp)
    data = json.loads(tmp.read_text())["data"]
    check(data.get("notes", {}).get("54", {}).get("x") == "Помеха справа — уступить." and len(data["progress"]["54"]["h"]) == 2, "export: note + history")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector("header.top [data-act=import]", state="attached")
    page.set_input_files("header.top [data-act=import]", str(tmp))
    page.wait_for_selector("#pfdlg[open] [data-preview]")
    check(page.inner_text("#pfdlg [data-preview] tr[data-k=notes]").split("\t")[2].strip() == "1", "import preview counts notes")
    with page.expect_navigation():
        page.click("#pfdlg [data-act=apply]")
    page.goto(base + "practice.html?ids=54")
    page.wait_for_selector("#set option[value=ids]", state="attached")
    page.click("#go")
    page.wait_for_selector('.q[data-id="54"] .ans')
    answer_current(page)
    q = page.locator('.q[data-id="54"]')
    q.locator('.tdet [data-tab="note"]').click()
    check(q.locator(".dnote").input_value() == "Помеха справа — уступить." and q.locator('.tdet [data-panel="hist"] .dhist li').count() == 3,
          "after import: note kept, history continues")
    ctx.close()
    # mobile: the tab strip scrolls, the page does not
    mob = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = mob.new_page()
    watch(mp)
    mp.goto(base + "practice.html?ids=54")
    mp.wait_for_selector("#set option[value=ids]", state="attached")
    mp.click("#go")
    mp.wait_for_selector('.q[data-id="54"] .ans')
    answer_current(mp, correct=False)
    mq = mp.locator('.q[data-id="54"]')
    mq.locator('.tdet [data-tab="hist"]').click()
    sw = mp.evaluate("document.documentElement.scrollWidth")
    check(panel_ok(mq) and sw <= 390, f"mobile: details panel, no page overflow ({sw})")
    mq.locator(".tdet").evaluate("e => e.scrollIntoView({block: 'start'})")
    mp.evaluate("window.scrollBy(0, -120)")
    shot(mp, "details_mobile.png")
    mob.close()


def header_layout(br, base):
    """Compact one-line header on every page at desktop, tablet and phone widths; menu and icon buttons."""
    for w in [1280, 1024, 768, 390, 320]:
        mobile = w < 1024
        ctx = br.new_context(viewport={"width": w, "height": 800}, **({"is_mobile": True, "has_touch": True} if w <= 390 else {}))
        page = ctx.new_page()
        watch(page)
        for pg, key in HEADER_PAGES:
            page.goto(base + pg)
            page.wait_for_selector("header.top .tools [data-act=export]")
            hb = page.locator("header.top").bounding_box()
            items = page.evaluate(HEADER_ITEMS)
            tops = {t for _, t, _, _, _ in items}
            check(hb["height"] <= 56 and len(items) >= 4 and max(tops) - min(tops) <= 2 and all(r <= w and l >= 0 for _, _, _, l, r in items),
                  f"{w}px {pg}: header {hb['height']:.0f}px, one line ({len(items)} items, tops {sorted(tops)})")
            sw = page.evaluate("document.documentElement.scrollWidth")
            check(sw <= w, f"{w}px {pg}: no horizontal overflow ({sw})")
            cur = page.locator("header.top nav.main a[aria-current=page]")
            check(cur.count() == 1 and "on" in (cur.get_attribute("class") or "") and cur.get_attribute("data-k") == key,
                  f"{w}px {pg}: current page highlighted ({key})")
            btns = page.locator("header.top .tools .iconbtn")
            labels = btns.evaluate_all("bs => bs.map(b => [b.getAttribute('aria-label'), b.title, b.innerText.trim()])")
            check(len(labels) == 3 and all(a and t and len(x) <= 2 for a, t, x in labels)
                  and {a for a, _, _ in labels} == {"Сохранить прогресс", "Загрузить прогресс", "Светлая / тёмная тема"},
                  f"{w}px {pg}: icon buttons with tooltips and aria-labels {labels}")
            menu = page.locator("header.top .menubtn")
            if not mobile:
                check(not menu.is_visible() and page.locator("header.top nav.main a").first.is_visible(), f"{w}px {pg}: nav inline, no menu button")
                continue
            check(menu.is_visible() and menu.get_attribute("aria-expanded") == "false" and not page.locator("header.top nav.main a").first.is_visible(),
                  f"{w}px {pg}: nav collapsed behind the menu button")
            if pg not in ("index.html", "norm/st5-p87.html"):
                continue
            menu.click()
            links = page.locator("header.top nav.main a")
            boxes = links.evaluate_all("as => as.map(a => { const r = a.getBoundingClientRect(); return [r.left, r.right, r.height]; })")
            check(menu.get_attribute("aria-expanded") == "true" and links.nth(5).is_visible() and all(l >= 0 and r <= w and h >= 32 for l, r, h in boxes),
                  f"{w}px {pg}: menu opens, all 6 links visible and tappable")
            check(page.evaluate("document.documentElement.scrollWidth") <= w, f"{w}px {pg}: open menu does not overflow")
            if w == 390 and pg == "index.html":
                shot(page, "header_mobile_menu_open.png")
            page.keyboard.press("Escape")
            check(menu.get_attribute("aria-expanded") == "false" and not links.first.is_visible()
                  and page.evaluate("document.activeElement.classList.contains('menubtn')"), f"{w}px {pg}: Esc closes the menu, focus back on the button")
            page.keyboard.press("Enter")
            check(menu.get_attribute("aria-expanded") == "true", f"{w}px {pg}: Enter on the focused menu button opens it")
            page.keyboard.press("Tab")
            check(page.evaluate("document.activeElement.closest('nav.main') !== null"), f"{w}px {pg}: Tab moves into the menu")
            page.mouse.click(w // 2, 700)
            check(menu.get_attribute("aria-expanded") == "false" and not links.first.is_visible(), f"{w}px {pg}: click outside closes the menu")
            menu.click()
            links.nth(1).click()
            page.wait_for_url("**/practice.html")
            check(True, f"{w}px {pg}: menu link navigates")
        if w == 1280:
            page.goto(base + "episode.html?id=ep05")
            page.wait_for_selector("header.top .tools [data-act=export]")
            shot(page, "header_desktop_1280.png", clip={"x": 0, "y": 0, "width": 1280, "height": 120})
            with page.expect_file_chooser() as fc:
                page.locator("header.top [aria-label='Загрузить прогресс']").focus()
                page.keyboard.press("Enter")
            check(fc.value is not None, "load button opens the file chooser from the keyboard")
            # layers above the sticky header: norm hover panel right under the header, full-screen image zoom
            a = page.locator('article.lesson a.nref').first
            a.scroll_into_view_if_needed()
            page.evaluate("y => window.scrollBy(0, y)", a.bounding_box()["y"] - 60)
            a.hover()
            page.wait_for_selector("#npop:not([hidden])")
            pb = page.locator("#npop").bounding_box()
            hit = page.evaluate("([x, y]) => !!document.elementFromPoint(x, y)?.closest('#npop')", [pb["x"] + 20, pb["y"] + 5])
            check(hit, f"norm hover panel layers above the header (panel top {pb['y']:.0f})")
            page.keyboard.press("Escape")
            page.evaluate("import('./assets/app/layout.mjs').then(m => m.zoom(document.querySelector('img').src))")
            page.wait_for_selector("#zoom.on")
            check(page.evaluate("!!document.elementFromPoint(640, 20)?.closest('#zoom')"), "full-screen image covers the header")
        if w == 390:
            page.goto(base + "index.html")
            page.wait_for_selector("header.top .tools [data-act=export]")
            shot(page, "header_mobile_390.png", clip={"x": 0, "y": 0, "width": 390, "height": 200})
            page.goto(base + "episode.html?id=ep05")
            page.wait_for_selector("article.lesson a.nref")
            page.evaluate("window.scrollTo(0, 1500)")
            check(page.locator("header.top").bounding_box()["y"] == 0, "390px: header stays on top while scrolling (sticky)")
            link = page.locator("article.lesson a.nref").first
            link.scroll_into_view_if_needed()
            link.tap()
            page.wait_for_selector("#npop.sheet:not([hidden])")
            pb = page.locator("#npop").bounding_box()
            check(page.evaluate("([x, y]) => !!document.elementFromPoint(x, y)?.closest('#npop')", [pb["x"] + 30, pb["y"] + 10]), "390px: norm bottom sheet above everything")
            page.click("#npop .npop-close")
            hint = page.locator(".fighint:not([hidden]) button").first
            if hint.count():
                hint.scroll_into_view_if_needed()
                hint.click()
                page.wait_for_selector(".figmodal")
                check(page.evaluate("!!document.elementFromPoint(195, 20)?.closest('.figmodal')"), "390px: full-screen figure covers the header")
                page.keyboard.press("Escape")
        ctx.close()


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
            check((before is None or str(tid) not in json.loads(before)) and rec["w"] == 1 and rec["k"] == 0 and rec["p"] == {str((c + 1) % na): 1}, f"{r['id']}: wrong pick recorded {rec}")
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
        oq.locator('.tdet [role=tab][data-tab="norms"]').click()
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

        # per-question «оригинал (KA)» toggle (no global language switch)
        page.goto(base + "episode.html?id=ep05")
        page.wait_for_selector("#tk .q")
        q = page.locator("#tk .q:has(.katoggle)").first
        tid = int(q.get_attribute("data-id"))
        T = page.evaluate(f"{LOAD_T}.then(D => D.byId[{tid}])")
        ru = q.locator(".qtext").inner_text()
        check(q.locator(".qka").is_hidden() and q.locator(".aka:visible").count() == 0, f"ticket {tid}: Georgian original hidden by default")
        q.locator(".katoggle").click()
        check(q.locator(".qka").is_visible() and " ".join(q.locator(".qka").inner_text().split()) == " ".join(T["q"]["ka"].split())
              and q.locator(".qtext").inner_text() == ru == T["q"]["ru"].strip(), f"ticket {tid}: toggle shows the Georgian question under the Russian")
        ws = lambda x: " ".join(x.split())
        check([ws(a) for a in q.locator(".aka:visible").all_inner_texts()] == [ws(a) for a in T["a"]["ka"]]
              and q.locator(".katoggle").get_attribute("aria-pressed") == "true", f"ticket {tid}: and the Georgian options")
        shot(page, "ticket_ka_toggle.png", clip=q.bounding_box())
        q.locator(".katoggle").click()
        check(q.locator(".qka").is_hidden(), f"ticket {tid}: toggle back hides the original")
        own = page.locator('.q[data-id^="o-"]')
        check(own.count() > 0 and own.locator(".katoggle").count() == 0, "own questions have no KA toggle")
        q.locator(".ans").first.click()
        check(q.locator(".katoggle").count() == 1, "toggle stays after answering")
        page.evaluate("localStorage.removeItem('pddge.progress.v1')")

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
        check("машинный перевод" in page.inner_text("#qbox .badge.warn") and page.locator("#qbox .katoggle").count() == 1
              and page.get_attribute("#qbox .qtext", "lang") == "ru", "practice: untranslated eco question in machine translation with the badge and the KA toggle")
        page.goto(base + "practice.html")
        page.wait_for_selector("#set option", state="attached")
        page.click("#go")
        page.wait_for_selector("#qbox .ans")
        check(page.locator("#qbox .katoggle").count() == 1, "practice: KA toggle on the ticket")

        # exam
        page.goto(base + "exam.html")
        page.click("#start")
        page.wait_for_selector("#qbox .ans")
        check(page.locator("#qbox .katoggle, #qbox .qka").count() == 0, "running mock exam: no KA toggle")
        for k in range(30):
            page.keyboard.press(str(1 + (k % 2)))
            page.keyboard.press("ArrowRight")
        check(page.inner_text("#answered") == "Отвечено 30 из 30", "exam: 30 answered")
        check(page.locator("#qbox .tdet, #qbox .verdict, #qbox .notemark").count() == 0, "running mock exam: no verdict, no details panel")
        page.once("dialog", lambda d: d.accept())
        page.click("#finish")
        page.wait_for_selector("#res .result")
        check(page.locator("#rev .q").count() >= 0, "exam result + review")
        nrev = page.locator("#rev .q").count()
        check(nrev == 0 or page.locator("#rev .q .katoggle").count() >= 1, f"exam review: KA toggle ({nrev} reviewed)")
        if nrev:
            check(page.locator("#rev .q .tdet").count() == nrev and panel_ok(page.locator("#rev .q").first), "exam review: details panel on every reviewed ticket")
            check("экзамен" in page.locator("#rev .q").first.locator('.tdet [data-panel="hist"]').inner_html(), "exam answers recorded with «экзамен»")
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
            if k == 0:
                check(panel_ok(page.locator(".q").first), "cumulative check: details panel after the answer")
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
        check(panel_ok(d) and d.locator(".errbody > .note").count() == 0, "errors list: details panel, no duplicate notes above it")
        prog = page.evaluate("JSON.parse(localStorage.getItem('pddge.progress.v1'))")
        need = sum(max(0, 2 - r.get("k", 0)) for r in prog.values() if r["w"] > 0)
        page.click("text=Разобрать ошибки")
        page.wait_for_selector(".q")
        steps = 0
        while page.locator(".q").count() and steps < 30:
            answer_current(page, correct=True)
            if steps == 0:
                check(panel_ok(page.locator(".q").first), "drill: details panel after the answer")
            page.click("#next")
            steps += 1
            page.wait_for_selector(".q, .result")
        check(steps == need and "Готово" in page.locator(".result").inner_text(), f"drill done after {steps} answers (need {need})")

        # global save / load of all progress (header buttons on every page)
        for pg, _ in HEADER_PAGES:
            page.goto(base + pg)
            page.wait_for_selector("header.top [data-act=export]")
            check(page.locator("#langseg, header.top [data-l]").count() == 0 and not re.search(r"\b(RU|KA|EN)\b", page.inner_text("header.top")),
                  f"{pg}: no global language switch in the header")
            check(page.locator("header.top [data-act=export][aria-label='Сохранить прогресс']").count() == 1
                  and page.locator("header.top [aria-label='Загрузить прогресс']").count() == 1,
                  f"{pg}: header has Сохранить / Загрузить прогресс")
        page.goto(base + "errors.html")
        page.wait_for_selector("header.top [data-act=export]")
        page.evaluate("""() => { localStorage.setItem('pddge.exams.v1', JSON.stringify([{d: 5, ok: 27, pass: true, s: 1000}]));
            localStorage.setItem('pddge.theme', 'light'); localStorage.setItem('pddge.settings.v1', JSON.stringify({order: 'mixed', own: true})); }""")
        keys = page.evaluate("import('./assets/domain/registry.mjs').then(m => m.STORAGE.map(s => s.key))")
        snap = page.evaluate("ks => Object.fromEntries(ks.map(k => [k, localStorage.getItem(k)]))", keys)
        with page.expect_download() as dl:
            page.click("header.top [data-act=export]")
        tmp = Path(tempfile.mkdtemp()) / "progress.json"
        dl.value.save_as(tmp)
        bundle = json.loads(tmp.read_text())
        check(bundle["format"] == "pddge-progress" and bundle["schema"] == 3 and bundle["app"] and bundle["exportedAt"]
              and {"progress", "runs", "exams", "theme", "settings"} <= set(bundle["data"]) and "lang" not in bundle["data"], f"export bundle: schema 3, sections {sorted(bundle['data'])}")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("header.top [data-act=import]", state="attached")
        page.set_input_files("header.top [data-act=import]", str(tmp))
        page.wait_for_selector("#pfdlg[open] [data-preview]")
        prev = page.inner_text("#pfdlg [data-preview] tr[data-k=tickets]")
        check(prev.split("\t")[1].strip() == "0" and int(prev.split("\t")[2]) > 0, f"import preview before applying: {prev!r}")
        check(page.evaluate("localStorage.getItem('pddge.progress.v1')") is None, "preview writes nothing")
        shot(page, "progress_import_preview.png")
        page.check("#pfdlg input[value=replace]")
        page.wait_for_selector("#pfdlg input[value=replace]:checked")
        with page.expect_navigation():
            page.click("#pfdlg [data-act=apply]")
        page.wait_for_selector("header.top [data-act=export]")
        after = page.evaluate("ks => Object.fromEntries(ks.map(k => [k, localStorage.getItem(k)]))", keys)
        same = all((json.loads(after[k]) if after[k] and after[k][:1] in "[{" else after[k]) == (json.loads(snap[k]) if snap[k] and snap[k][:1] in "[{" else snap[k]) for k in keys)
        check(same, "import (replace) restores every registered key")
        newer = Path(tempfile.mkdtemp()) / "newer.json"
        newer.write_text(json.dumps({"format": "pddge-progress", "schema": 99, "data": {}}))
        page.set_input_files("header.top [data-act=import]", str(newer))
        page.wait_for_selector("#pfdlg[open] [data-err]")
        check("более новой версией" in page.inner_text("#pfdlg [data-err]") and page.evaluate("localStorage.getItem('pddge.progress.v1')") == snap[keys[0]],
              "newer-schema file rejected, data untouched")
        page.click("#pfdlg [data-act=close]")
        # an old (≤ 0.6) export with the retired «lang» section imports fine; the stale browser key is cleaned
        page.evaluate("localStorage.setItem('pddge.lang', 'ka')")
        page.reload()
        page.wait_for_selector("header.top [data-act=import]", state="attached")
        check(page.evaluate("localStorage.getItem('pddge.lang')") is None, "stale pddge.lang removed from the browser")
        old = Path(tempfile.mkdtemp()) / "old.json"
        old.write_text(json.dumps({"format": "pddge-progress", "schema": 2, "app": "0.6", "exportedAt": "2026-10-23T10:00:00Z",
                                   "data": {"progress": {"5": {"s": 1, "c": 1, "w": 0, "l": 1, "t": 1, "k": 1}}, "lang": "en", "theme": "dark"}}))
        page.set_input_files("header.top [data-act=import]", str(old))
        page.wait_for_selector("#pfdlg[open] [data-preview]")
        page.check("#pfdlg input[value=replace]")
        with page.expect_navigation():
            page.click("#pfdlg [data-act=apply]")
        page.wait_for_selector("header.top [data-act=export]")
        got = page.evaluate("[localStorage.getItem('pddge.progress.v1'), localStorage.getItem('pddge.lang'), localStorage.getItem('pddge.theme')]")
        check(got[0] and json.loads(got[0]).get("5", {}).get("c") == 1 and got[1] is None and got[2] == "dark", f"old export with «lang» imports OK, lang ignored {got}")

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
        bx = mp.evaluate("""[...document.querySelectorAll('header.top .pfbtns .iconbtn')].map(b => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.height]; })""")
        check(len(bx) == 2 and all(l >= 0 and r <= 390 and h >= 28 for l, r, h in bx), f"mobile: save/load progress buttons visible in the header {bx}")
        shot(mp, "mobile_header_progress.png")
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
        norms(br, base)
        header_layout(br, base)
        breakdowns(br, base)
        machine_translation(br, base)
        ticket_details(br, base)
        br.close()
    stop()
    legacy_root()
    check(not errors, f"console errors {errors[:5]}")
    check(not failed, f"failed requests {failed[:5]}")
    print("SUMMARY:", "ALL OK" if not problems else f"{len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

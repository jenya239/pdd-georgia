"""Fill content/translations/explanations_ru.json with machine translations (ka → ru) of the Georgian-only ticket text.

Only new or changed sources are sent (the cache is keyed by ticket id + source hash). Free Google Translate via the
`translators` package, one request per text with a pause between requests. Run:
    /workspace/.pyt/bin/python tools/translate_ka.py [--limit=N] [--dry] [--redo-unmasked]
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdd import mt, normref, ontology, paths            # noqa: E402
from pdd.normlink import Linker                          # noqa: E402

ENGINE = "Google Translate (free web endpoint via the `translators` package)"
PAUSE = 1.0


def masker():
    world = ontology.load_world()
    L = Linker(world.norms)

    def refs(key, text):
        bank = world.bank_norms(int(key.split(":")[0]))
        return normref.resolve_ka(normref.find_ka(text), L.ids, L.ka_text, bank["norms"], bool(bank["unresolved"]))
    return refs


def google(text: str) -> str:
    import translators as ts
    for wait in (10, 30, 60, 120, 300, 600):
        try:
            return ts.translate_text(text, translator="google", from_language="ka", to_language="ru", timeout=30)
        except Exception as e:                            # network hiccup / throttling: back off politely
            print(f"  retry in {wait}s after", type(e).__name__, file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError("translation failed")


def main():
    args = dict(a.lstrip("-").split("=", 1) if "=" in a else (a.lstrip("-"), "1") for a in sys.argv[1:])
    Q = json.loads(paths.TICKETS_JSON.read_text(encoding="utf-8"))["questions"]
    jobs, cache, refs = mt.jobs(Q), mt.load_cache(), masker()
    if "redo-unmasked" in args:                           # retry the plain-text fallbacks
        cache = {k: e for k, e in cache.items() if e.get("masked", True)}
    todo = {k: s for k, s in jobs.items() if cache.get(k, {}).get("h") != mt.source_hash(s)}
    print(f"{len(jobs)} texts, {len(todo)} to translate ({len({mt.source_hash(s) for s in todo.values()})} unique)")
    if "dry" in args:
        return
    limit, done, stats = int(args.get("limit", 10 ** 6)), [0], {"masked": 0, "fallback": 0}

    def translate(key, src):
        if done[0] >= limit:
            raise KeyboardInterrupt
        src = mt.clean(src)
        masked, labels = mt.mask(src, refs(key, src) if key.endswith(":ex") else [])
        entry = None
        # one sentence per line, then the whole text (Google sometimes drops a sentence of a long text with its placeholder)
        for attempt in ("\n".join(mt.sentences(masked)), masked):
            time.sleep(PAUSE)
            try:
                entry = {"ru": " ".join(mt.unmask(google(attempt), labels).replace("\u200b", "").split())}
                stats["masked"] += bool(labels)
                break
            except ValueError:
                pass
        if entry is None:                                # placeholders lost: plain text, its Russian is not auto-linked
            time.sleep(PAUSE)
            entry = {"ru": " ".join(google(src).replace("\u200b", "").split()), "masked": False}
            stats["fallback"] += 1
            print("  fallback (placeholders lost):", key, file=sys.stderr)
        done[0] += 1
        if done[0] % 25 == 0:
            print(f"  {done[0]} translated", flush=True)
        return entry

    out = dict(cache)
    try:
        for i, key in enumerate(todo):          # one job at a time so progress is saved even if interrupted
            out.update(mt.fill({key: jobs[key]}, out, translate))
            mt.save_cache({k: v for k, v in out.items() if k in jobs}, ENGINE)   # every text: a crash loses nothing
    except KeyboardInterrupt:
        pass
    mt.save_cache({k: v for k, v in out.items() if k in jobs}, ENGINE)
    print(f"done: {done[0]} requests, {stats}, errors: {len(mt.cache_errors(jobs, mt.load_cache()))}")


if __name__ == "__main__":
    main()

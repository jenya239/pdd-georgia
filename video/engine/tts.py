# edge-tts, one mp3 per sentence, cached by md5(voice+text) (run by video/render.py).
import sys, os; sys.path.insert(0, os.getcwd())
import asyncio, edge_tts, os, hashlib
from scenes import BEATS, VOICES, say
def fn(who, s): return "audio/s_"+hashlib.md5((who+s).encode()).hexdigest()[:10]+".mp3"
async def one(who, s):
    v, r, p = VOICES[who]
    for a in range(20):
        try:
            await edge_tts.Communicate(s, v, rate=r, pitch=p).save(fn(who, s)+".part")
            if os.path.getsize(fn(who, s)+".part")>1000: os.replace(fn(who, s)+".part", fn(who, s)); return
            raise RuntimeError("empty audio")
        except Exception as e: print("retry", e.__class__.__name__, flush=True); await asyncio.sleep(min(60, 5*(a+1)))
    raise SystemExit("tts failed: "+s)
async def main():
    for who, _, _, sents, _ in BEATS:
        for s in sents:
            if isinstance(s,(int,float)): continue
            if not (os.path.exists(fn(who, say(s))) and os.path.getsize(fn(who, say(s)))>1000): await one(who, say(s))
if __name__ == "__main__": asyncio.run(main())

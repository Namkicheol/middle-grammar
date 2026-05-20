#!/usr/bin/env python3
"""Generate 6-frame attack animation for all 6 boss-battle characters via Pollinations.

Hero characters: pencil/spellbook/sword attack motion
Boss characters: hit-reaction motion (recoil/stagger/flinch)

Same seed per character to maximize identity consistency across frames.
Strips white background to transparent PNG.
"""
import os, urllib.parse, urllib.request, time
from io import BytesIO
from PIL import Image

OUT = "/Users/namgicheol/Library/Mobile Documents/com~apple~CloudDocs/Developments/middle-grammar/.claude/worktrees/sprite-anim/game/assets/chars/anim"
os.makedirs(OUT, exist_ok=True)

# (prefix, seed, base_description, frame_actions[6])
CHARACTERS = [
    ("hero-lv1", 11,
     "cute chibi anime game character, cheerful young student schoolboy with bright blue baseball cap with golden star, white school t-shirt with red star, blue shorts, sneakers, gentle smile, holding glowing yellow magic pencil sword, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in calm ready idle pose facing right, pencil sword held at side",
        "winding up by drawing the pencil sword BACK over right shoulder, body coiled, eyes determined",
        "swinging the pencil sword DOWNWARD in mid-arc, body twisted forward, motion lines, sparkles",
        "pencil sword extended FORWARD striking impact, body leaning forward, yellow star burst, action",
        "follow-through with pencil sword pointing low forward, body still leaning forward",
        "recovering back to neutral ready stance, pencil sword raised to ready position",
     ]),
    ("hero-lv2", 22,
     "cute chibi anime game character, young magical scholar boy wizard, royal purple wizard robe with golden trim, tall pointed purple wizard hat with gold star, round glasses, holding open glowing magic spellbook, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in calm ready idle pose facing right, holding spellbook closed at chest",
        "winding up by raising spellbook above head, glowing purple energy gathering, body coiled",
        "casting a HUGE purple-gold magic blast forward from open spellbook, arms outstretched, magical runes flying, motion lines",
        "magic blast reaching full extension forward, spellbook glowing white-hot, body leaning forward, sparkling explosion",
        "follow-through with spellbook lowered forward, residual magic sparkles, body still leaning",
        "recovering back to neutral pose, spellbook closing at chest, calm",
     ]),
    # hero-lv3 already done — included here in case re-run is needed
    ("hero-lv3", 33,
     "cute chibi anime game character, noble awakened hero boy in golden armor, red flowing cape, glowing white feathered angel wings spread, golden crown halo, holding massive glowing golden sword, vibrant divine light, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in calm ready idle pose facing right, sword held at side",
        "winding up by drawing the golden sword BACK over right shoulder, body coiled",
        "swinging the golden sword DOWNWARD in mid-arc, body twisted forward, motion blur",
        "sword reaching FORWARD at full extension hitting target, body leaning forward, spark burst",
        "follow-through with sword pointing low forward, body still leaning forward",
        "recovering back to neutral ready stance, sword raised to ready position",
     ]),
    ("boss-lv1", 44,
     "cute chibi cartoon red purple demon imp boss, two short horns, small bat wings, glowing red eyes, mischievous menacing grin, simple stylized villain, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in idle pose facing left, claws ready, smirking",
        "leaning slightly forward growling, claws raised, snarling",
        "RECOILING backward sharply from heavy hit, head twisted, eyes shut tight, hurt expression",
        "flying backward in pain, body twisted, wings folded, dark sparks around, agony face",
        "landing back on ground, head down, shoulders hunched, dazed",
        "recovering, looking up angrily, shaking head, returning to idle stance",
     ]),
    ("boss-lv2", 55,
     "cute chibi enraged dark crimson demon king boss, four glowing orange eyes, fire crown burning on head, four sharp horns, dark red metal armor, holding dark magic sphere, menacing tall pose, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in idle pose facing left, dark sphere in one hand, fire flickering on crown",
        "rearing back, all four eyes wide, fire flaring up, dark sphere raised",
        "STAGGERING backward from massive hit, one arm shielding face, fire still burning, hurt grimace",
        "knocked further back, body twisted, dark sphere falling, smoke and sparks erupting",
        "kneeling slightly from impact, head down, hands on ground, fire weakening",
        "recovering, standing back up, fire reignited, eyes glowing brighter angrily",
     ]),
    ("boss-lv3", 66,
     "cute chibi terrifying massive true demon lord boss, six glowing purple eyes, huge curved black horns, cracked black obsidian body with purple glowing cracks, large dark dragon wings spread, holding two black scythes, intimidating final boss, soft cel-shading, clean illustration, isolated pure white background, centered single character only, mobile game asset, vibrant colors",
     [
        "standing in idle pose facing left, scythes crossed at chest, wings spread, eyes glowing",
        "rising up taller, wings flared wide, scythes raised high, intimidating roar",
        "FLINCHING violently from massive impact, body twisted, wings recoiling, dark cracks pulsing, agony",
        "thrown back further, scythes flying out of hands, body arched in pain, dark mist erupting from cracks",
        "crouching in damaged pose, one knee down, wings drooping, head bowed, embers fading",
        "rising back up with fury, eyes blazing purple, dark aura flaring, scythes recalled to hands",
     ]),
]

def fetch(prompt, seed):
    url = ("https://image.pollinations.ai/prompt/"
           + urllib.parse.quote(prompt)
           + f"?width=512&height=640&nologo=true&model=flux&seed={seed}&enhance=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=140) as r:
                return r.read()
        except Exception as e:
            print(f"  retry {attempt+1}: {e}")
            time.sleep(2)
    return None

def strip_white(img_bytes):
    im = Image.open(BytesIO(img_bytes)).convert("RGBA")
    px = im.load()
    w, h = im.size
    visited = set()
    stack = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    threshold = 240
    while stack:
        x, y = stack.pop()
        if (x,y) in visited or x<0 or y<0 or x>=w or y>=h:
            continue
        r,g,b,a = px[x,y]
        if r < threshold or g < threshold or b < threshold:
            continue
        visited.add((x,y))
        px[x,y] = (0,0,0,0)
        stack.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
    return im

if __name__ == "__main__":
    import sys
    only = sys.argv[1:]  # optional filter, e.g. "boss-lv1 boss-lv2"
    for prefix, seed, base, actions in CHARACTERS:
        if only and prefix not in only:
            continue
        for i, action in enumerate(actions, 1):
            tag = f"{i:02d}-" + ["idle", "windup", "midswing", "impact", "follow", "recover"][i-1]
            out_path = os.path.join(OUT, f"{prefix}-{tag}.png")
            if os.path.exists(out_path):
                print(f"[skip] {prefix}-{tag} already exists")
                continue
            full_prompt = f"{base}, {action}"
            print(f"[fetch] {prefix}-{tag}")
            raw = fetch(full_prompt, seed)
            if not raw:
                print(f"[fail] {prefix}-{tag}")
                continue
            im = strip_white(raw)
            im.save(out_path, "PNG", optimize=True)
            print(f"[ok]   {out_path}")
    print("done.")

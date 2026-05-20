#!/usr/bin/env python3
"""Test sprite frame generation via Pollinations — same character, 6 attack poses, same seed."""
import os, urllib.parse, urllib.request, time
from io import BytesIO
try:
    from PIL import Image
except ImportError:
    os.system("pip3 install --quiet Pillow")
    from PIL import Image

OUT = "/Users/namgicheol/Library/Mobile Documents/com~apple~CloudDocs/Developments/middle-grammar/game/assets/chars/anim"
os.makedirs(OUT, exist_ok=True)

# Base character signature — must be IDENTICAL across all frames
BASE = ("cute chibi anime game character, noble awakened hero boy in golden armor, "
        "red flowing cape, glowing white feathered angel wings spread, golden crown halo, "
        "holding massive glowing golden sword, vibrant divine light, "
        "soft cel-shading, clean illustration, isolated pure white background, "
        "centered single character only, mobile game asset, vibrant colors")

# 6 action frames — change only the pose verb
FRAMES = [
    ("01-idle",      "standing in calm ready idle pose facing right, sword held at side"),
    ("02-windup",    "winding up by drawing the golden sword BACK over right shoulder, body coiled"),
    ("03-midswing",  "swinging the golden sword DOWNWARD in mid-arc, body twisted forward, motion blur"),
    ("04-impact",    "sword reaching FORWARD at full extension hitting target, body leaning forward, spark burst"),
    ("05-follow",    "follow-through with sword pointing low forward, body still leaning forward"),
    ("06-recover",   "recovering back to neutral ready stance, sword raised to ready position"),
]

SEED = 33  # same seed used for hero-lv3.png

def fetch(name, action):
    prompt = f"{BASE}, {action}"
    url = ("https://image.pollinations.ai/prompt/"
           + urllib.parse.quote(prompt)
           + f"?width=512&height=640&nologo=true&model=flux&seed={SEED}&enhance=true")
    print(f"[fetch] {name}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=140) as r:
                return r.read()
        except Exception as e:
            print(f"  retry {attempt+1}: {e}")
            time.sleep(2)
    return None

def strip_white(img_bytes, name):
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
    out = os.path.join(OUT, f"{name}.png")
    im.save(out, "PNG", optimize=True)
    return out

for name, action in FRAMES:
    raw = fetch(f"hero-lv3-{name}", action)
    if not raw: continue
    out = strip_white(raw, f"hero-lv3-{name}")
    print(f"[ok]  {out}")
print("done.")

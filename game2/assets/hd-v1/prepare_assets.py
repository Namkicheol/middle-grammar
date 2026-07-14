"""Prepare transparent boss-fight cutouts as uniform 512px Canvas-ready art."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent

for path in sorted(ROOT.glob("*.png")):
    if path.name == "arena.png":
        continue
    image = Image.open(path).convert("RGBA")
    box = image.getchannel("A").getbbox()
    if not box:
        continue
    pad = max(14, round(max(image.size) * 0.018))
    left, top, right, bottom = box
    image = image.crop((
        max(0, left - pad), max(0, top - pad),
        min(image.width, right + pad), min(image.height, bottom + pad),
    ))
    image.thumbnail((476, 476), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    x = (512 - image.width) // 2
    y = 496 - image.height
    canvas.alpha_composite(image, (x, y))
    canvas.save(path, optimize=True)
    print(f"prepared {path.name}: 512x512")

"""Crop transparent margins and resize HD cutouts for real-time Canvas use."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
TARGETS = [*sorted((ROOT / "units").glob("*.png")), ROOT / "cannon.png"]


for path in TARGETS:
    image = Image.open(path).convert("RGBA")
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        continue

    pad = max(12, round(max(image.size) * 0.02))
    left, top, right, bottom = alpha_box
    crop_box = (
        max(0, left - pad),
        max(0, top - pad),
        min(image.width, right + pad),
        min(image.height, bottom + pad),
    )
    image = image.crop(crop_box)
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    image.save(path, optimize=True)
    print(f"optimized {path.name}: {image.width}x{image.height}")

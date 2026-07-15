#!/usr/bin/env python3
"""Create the tower's teal-and-silver climber variant from the HD ranger strips."""

import colorsys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "grammar-rangers" / "assets" / "hd-v2" / "units" / "forest-archer"
OUTPUT = Path(__file__).resolve().parent / "units" / "sky-climber"


def recolor(image: Image.Image) -> Image.Image:
    pixels = []
    for red, green, blue, alpha in image.convert("RGBA").getdata():
        if alpha == 0:
            pixels.append((0, 0, 0, 0))
            continue
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if saturation > 0.12 and 0.12 < hue < 0.48:
            hue = min(0.58, hue + 0.20)
            saturation = min(1, saturation * 1.14)
            value = min(1, value * 1.12)
        elif saturation < 0.2:
            value = min(1, value * 1.13)
        rr, gg, bb = colorsys.hsv_to_rgb(hue, saturation, value)
        pixels.append((round(rr * 255), round(gg * 255), round(bb * 255), alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(pixels)
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    idle = None
    for action in ("idle", "run", "attack", "hurt"):
        processed = recolor(Image.open(SOURCE / f"{action}.png"))
        processed.save(OUTPUT / f"{action}.png", optimize=True)
        if action == "idle":
            idle = processed
        if action == "hurt":
            processed.save(OUTPUT / "death.png", optimize=True)
    if idle:
        frame = idle.crop((0, 0, 256, 256))
        bounds = frame.getchannel("A").getbbox()
        if bounds:
            frame = frame.crop(bounds)
        portrait = Image.new("RGBA", (220, 220))
        frame.thumbnail((200, 200), Image.Resampling.LANCZOS)
        portrait.alpha_composite(frame, ((220 - frame.width) // 2, 220 - frame.height - 8))
        portrait.save(OUTPUT / "portrait.png", optimize=True)
    print(f"created sky climber strips in {OUTPUT}")


if __name__ == "__main__":
    main()

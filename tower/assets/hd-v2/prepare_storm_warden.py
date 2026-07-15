#!/usr/bin/env python3
"""Remove the generated checkerboard and build aligned Storm Warden strips."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "raw" / "storm-warden-atlas.png"
OUTPUT = ROOT / "units" / "storm-warden"
ACTIONS = ("idle", "run", "attack", "death")


def remove_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    keyed = []
    for red, green, blue, _ in rgba.getdata():
        neutral = max(red, green, blue) - min(red, green, blue) <= 9
        alpha = 0 if neutral and min(red, green, blue) >= 210 else 255
        keyed.append((red, green, blue, alpha))
    rgba.putdata(keyed)
    return rgba


def main() -> None:
    source = remove_checkerboard(Image.open(SOURCE))
    side = min(source.size) - min(source.size) % 4
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    source = source.crop((left, top, left + side, top + side))
    source = source.resize((1024, 1024), Image.Resampling.LANCZOS)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    portrait = None
    for row, action in enumerate(ACTIONS):
        strip = Image.new("RGBA", (1024, 256))
        for column in range(4):
            cell = source.crop((column * 256, row * 256, (column + 1) * 256, row * 256 + 256))
            bounds = cell.getchannel("A").getbbox()
            if bounds:
                shift_y = 248 - bounds[3]
                aligned = Image.new("RGBA", (256, 256))
                aligned.alpha_composite(cell, (0, shift_y))
                cell = aligned
            strip.alpha_composite(cell, (column * 256, 0))
            if row == 0 and column == 0:
                portrait = cell.copy()
        strip.save(OUTPUT / f"{action}.png", optimize=True)

    if portrait:
        portrait.save(OUTPUT / "portrait.png", optimize=True)
    print(f"created Storm Warden strips in {OUTPUT}")


if __name__ == "__main__":
    main()

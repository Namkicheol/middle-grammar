#!/usr/bin/env python3
"""Split a transparent 4x4 atlas into ground-aligned animation strips."""

from pathlib import Path
import sys

from PIL import Image


ACTIONS = ("idle", "run", "attack", "death")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare_sheets.py ATLAS.png OUTPUT_DIR")

    source = Image.open(sys.argv[1]).convert("RGBA")
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)

    side = min(source.size)
    side -= side % 4
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    source = source.crop((left, top, left + side, top + side))
    source = source.resize((1024, 1024), Image.Resampling.LANCZOS)

    for row, action in enumerate(ACTIONS):
        strip = Image.new("RGBA", (1024, 256))
        for column in range(4):
            cell = source.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            bounds = cell.getchannel("A").getbbox()
            if bounds:
                shift_y = 248 - bounds[3]
                if shift_y:
                    aligned = Image.new("RGBA", (256, 256))
                    aligned.alpha_composite(cell, (0, shift_y))
                    cell = aligned
            strip.alpha_composite(cell, (column * 256, 0))
        strip.save(output / f"{action}.png", optimize=True)

    print("frames=256x256; strips=1024x256; actions=" + ",".join(ACTIONS))


if __name__ == "__main__":
    main()

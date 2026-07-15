#!/usr/bin/env python3
"""Split a chroma-keyed 4x4 atlas into four horizontal animation strips."""

from pathlib import Path
import sys

from PIL import Image


ACTIONS = ("idle", "run", "attack", "hurt")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare_sheets.py ATLAS.png OUTPUT_DIR")

    atlas_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    image = Image.open(atlas_path).convert("RGBA")

    side = min(image.size)
    side -= side % 4
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    frame = side // 4

    output_dir.mkdir(parents=True, exist_ok=True)
    for row, action in enumerate(ACTIONS):
        cells = []
        for column in range(4):
            cell = image.crop((column * frame, row * frame, (column + 1) * frame, (row + 1) * frame))
            alpha_box = cell.getchannel("A").getbbox()
            if alpha_box:
                bottom_pad = frame - alpha_box[3]
                shift_y = bottom_pad - 8
                if shift_y:
                    aligned = Image.new("RGBA", cell.size)
                    aligned.alpha_composite(cell, (0, shift_y))
                    cell = aligned
            cells.append(cell)

        strip = Image.new("RGBA", (side, frame))
        for column, cell in enumerate(cells):
            strip.alpha_composite(cell, (column * frame, 0))
        strip.save(output_dir / f"{action}.png", optimize=True)

    print(f"frames={frame}x{frame}; strips={side}x{frame}; actions={','.join(ACTIONS)}")


if __name__ == "__main__":
    main()

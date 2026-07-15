#!/usr/bin/env python3
"""Split a chroma-keyed 4x4 atlas into four horizontal animation strips."""

from pathlib import Path
import sys
from collections import deque

from PIL import Image


ACTIONS = ("idle", "run", "attack", "hurt")


def remove_row_spill(cell: Image.Image) -> Image.Image:
    """Remove small disconnected fragments that crossed an atlas row boundary."""
    width, height = cell.size
    alpha = list(cell.getchannel("A").getdata())
    opaque_total = sum(value > 16 for value in alpha)
    if not opaque_total:
        return cell

    visited = bytearray(width * height)
    boundary = []
    edge_band = max(4, height // 12)
    for y in (*range(edge_band), *range(height - edge_band, height)):
        boundary.extend(y * width + x for x in range(width) if alpha[y * width + x] > 16)

    remove = []
    for seed in boundary:
        if visited[seed]:
            continue
        queue = deque([seed])
        visited[seed] = 1
        component = []
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    nxt = ny * width + nx
                    if not visited[nxt] and alpha[nxt] > 16:
                        visited[nxt] = 1
                        queue.append(nxt)
        if len(component) < opaque_total * 0.22:
            remove.extend(component)

    if remove:
        pixels = list(cell.getdata())
        for index in remove:
            pixels[index] = (0, 0, 0, 0)
        cell = Image.new("RGBA", cell.size)
        cell.putdata(pixels)
    return cell


def main() -> None:
    if len(sys.argv) not in (3, 4):
        raise SystemExit("usage: prepare_sheets.py ATLAS.png OUTPUT_DIR [FRAME_SIZE]")

    atlas_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    image = Image.open(atlas_path).convert("RGBA")

    side = min(image.size)
    side -= side % 4
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    if len(sys.argv) == 4:
        target_side = int(sys.argv[3]) * 4
        image = image.resize((target_side, target_side), Image.Resampling.LANCZOS)
        side = target_side
    frame = side // 4

    output_dir.mkdir(parents=True, exist_ok=True)
    for row, action in enumerate(ACTIONS):
        cells = []
        for column in range(4):
            cell = image.crop((column * frame, row * frame, (column + 1) * frame, (row + 1) * frame))
            cell = remove_row_spill(cell)
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

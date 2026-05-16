import argparse
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "game" / "assets"
FRAME = 160
FRAMES = 6
SCALE = 3


def sheet(draw_frame, path):
    img = Image.new("RGBA", (FRAME * FRAMES * SCALE, FRAME * SCALE), (0, 0, 0, 0))
    for frame in range(FRAMES):
        frame_img = Image.new("RGBA", (FRAME * SCALE, FRAME * SCALE), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame_img)
        draw_frame(d, frame, SCALE)
        img.alpha_composite(frame_img, (frame * FRAME * SCALE, 0))
    img = img.resize((FRAME * FRAMES, FRAME), Image.Resampling.LANCZOS)
    img.save(path)


def p(points, s):
    return [(int(x * s), int(y * s)) for x, y in points]


def line(d, pts, color, width, s):
    d.line(p(pts, s), fill="#101827", width=int((width + 5) * s), joint="curve")
    d.line(p(pts, s), fill=color, width=int(width * s), joint="curve")


def hero(d, frame, s):
    attack = frame in (2, 3, 5)
    guard = frame == 4
    lean = {1: 2, 2: 10, 4: -8, 5: 7}.get(frame, 0)

    def xy(x, y):
        return ((x + lean) * s, y * s)

    d.ellipse([xy(31, 138), xy(122, 156)], fill=(0, 0, 0, 72))
    d.polygon(p([(49 + lean, 55), (27 + lean, 82), (32 + lean, 128), (59 + lean, 121), (64 + lean, 54)], s), fill=(20, 184, 166, 212))

    line(d, [(65 + lean, 91), (55 + lean, 137)], "#2563eb", 16, s)
    line(d, [(89 + lean, 91), (106 + lean, 137)], "#1d4ed8", 16, s)
    line(d, [(55 + lean, 137), (42 + lean, 144)], "#111827", 11, s)
    line(d, [(106 + lean, 137), (126 + lean, 141)], "#111827", 11, s)
    line(d, [(55 + lean, 76), (42 + lean if guard else 34 + lean, 86 if guard else 101)], "#f59e0b", 15, s)
    hand = (137 + lean, 69) if frame == 2 else (112 + lean, 31) if attack else (93 + lean, 77) if guard else (120 + lean, 84)
    line(d, [(101 + lean, 75), hand], "#fbbf24", 16, s)

    d.polygon(p([(52 + lean, 57), (102 + lean, 54), (114 + lean, 110), (80 + lean, 123), (47 + lean, 107)], s), fill="#101827")
    d.polygon(p([(58 + lean, 60), (97 + lean, 58), (107 + lean, 104), (79 + lean, 114), (54 + lean, 101)], s), fill="#2563eb")
    d.polygon(p([(68 + lean, 65), (91 + lean, 64), (86 + lean, 79), (70 + lean, 78)], s), fill=(255, 255, 255, 58))

    d.ellipse([xy(46, 16), xy(108, 70)], fill="#101827")
    d.ellipse([xy(51, 20), xy(104, 68)], fill="#f59e0b")
    d.pieslice([xy(45, 6), xy(112, 52)], 188, 350, fill="#78350f")
    d.polygon(p([(48 + lean, 31), (68 + lean, 14), (108 + lean, 24), (100 + lean, 40), (76 + lean, 31), (52 + lean, 42)], s), fill="#78350f")
    d.rectangle([xy(67, 44), xy(72, 49)], fill="#111827")
    d.rectangle([xy(88, 43), xy(94, 48)], fill="#111827")
    d.rectangle([xy(73, 56), xy(93, 60)], fill="#111827")

    if attack:
        d.line([xy(hand[0] - lean, hand[1]), xy(hand[0] - lean + 46, hand[1] - 33)], fill=(103, 232, 249, 220), width=int((12 if frame == 5 else 8) * s))
        d.line([xy(hand[0] - lean + 3, hand[1] - 2), xy(hand[0] - lean + 49, hand[1] - 35)], fill=(254, 240, 138, 180), width=int(4 * s))
    if guard:
        d.arc([xy(68, 46), xy(126, 104)], 290, 70, fill=(125, 211, 252, 150), width=int(8 * s))


def boss(d, frame, s):
    rage = frame >= 3
    hit = frame == 2
    casting = frame in (1, 5)
    lean = -12 if hit else 6 if casting else 0

    def xy(x, y):
        return ((x + lean) * s, y * s)

    d.ellipse([xy(25, 137), xy(137, 157)], fill=(0, 0, 0, 82))
    if casting:
        d.ellipse([xy(10, 0), xy(150, 130)], fill=(249, 115, 22, 35))

    line(d, [(62 + lean, 88), (51 + lean, 138)], "#7f1d1d" if not rage else "#581c87", 19, s)
    line(d, [(91 + lean, 88), (108 + lean, 138)], "#581c87", 19, s)
    line(d, [(51 + lean, 138), (35 + lean, 145)], "#111827", 13, s)
    line(d, [(108 + lean, 138), (129 + lean, 143)], "#111827", 13, s)
    lh = (33 + lean, 45) if casting else (42 + lean, 92) if hit else (28 + lean, 87)
    rh = (126 + lean, 39) if casting else (120 + lean, 76) if hit else (132 + lean, 85)
    line(d, [(55 + lean, 72), lh], "#991b1b" if rage else "#b91c1c", 20, s)
    line(d, [(103 + lean, 72), rh], "#dc2626", 20, s)

    body = "#7e22ce" if rage else "#991b1b"
    d.polygon(p([(43 + lean, 50), (112 + lean, 48), (127 + lean, 113), (82 + lean, 128), (36 + lean, 110)], s), fill="#101827")
    d.polygon(p([(49 + lean, 55), (107 + lean, 53), (120 + lean, 105), (82 + lean, 116), (43 + lean, 103)], s), fill=body)
    d.rectangle([xy(63, 76), xy(102, 102)], fill="#111827")

    horn = "#f97316" if rage else "#fef3c7"
    d.polygon(p([(38 + lean, 24), (25 + lean, 2), (54 + lean, 17)], s), fill="#101827")
    d.polygon(p([(42 + lean, 22), (29 + lean, 5), (55 + lean, 19)], s), fill=horn)
    d.polygon(p([(111 + lean, 22), (137 + lean, 5), (120 + lean, 36)], s), fill="#101827")
    d.polygon(p([(108 + lean, 23), (132 + lean, 8), (116 + lean, 34)], s), fill=horn)

    face = "#be123c" if rage else "#dc2626"
    d.ellipse([xy(38, 10), xy(117, 73)], fill="#101827")
    d.ellipse([xy(44, 16), xy(111, 69)], fill=face)
    d.pieslice([xy(39, 2), xy(118, 52)], 184, 350, fill="#7f1d1d")
    d.polygon(p([(56 + lean, 40), (73 + lean, 39), (67 + lean, 50)], s), fill="#fef2f2")
    d.polygon(p([(88 + lean, 39), (109 + lean, 41), (94 + lean, 50)], s), fill="#fef2f2")
    d.rectangle([xy(65, 58), xy(99, 65)], fill="#111827")

    if hit:
        d.line([xy(34, 48), xy(121, 81)], fill=(254, 242, 242, 195), width=int(8 * s))


def is_edge_bg(pixel):
    r, g, b, _ = pixel
    return min(r, g, b) > 205 and max(r, g, b) - min(r, g, b) < 24


def remove_checker_background(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    seen = set()
    queue = deque()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        if not is_edge_bg(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return img


def alpha_bbox(img):
    alpha = img.getchannel("A")
    return alpha.getbbox()


def frame_ranges(img):
    alpha = img.getchannel("A")
    ranges = []
    start = None
    for x in range(img.width):
        count = 0
        for y in range(img.height):
            if alpha.getpixel((x, y)) > 20:
                count += 1
        if count > 8 and start is None:
            start = x
        if (count <= 8 or x == img.width - 1) and start is not None:
            end = x if count <= 8 else x + 1
            if end - start > 8:
                ranges.append((start, end))
            start = None
    return ranges if len(ranges) == FRAMES else None


def normalize_generated_strip(src, out):
    src_img = remove_checker_background(Image.open(src))
    ranges = frame_ranges(src_img)
    slot_w = src_img.width / FRAMES
    cropped = []
    heights = []
    is_hero = "hero" in out.name
    out_img = Image.new("RGBA", (FRAME * FRAMES, FRAME), (0, 0, 0, 0))
    for frame in range(FRAMES):
        if ranges:
            left, right = ranges[frame]
            left = max(0, left - 8)
            right = min(src_img.width, right + 8)
        else:
            left = int(round(frame * slot_w))
            right = int(round((frame + 1) * slot_w))
        slot = src_img.crop((left, 0, right, src_img.height))
        bbox = alpha_bbox(slot)
        if not bbox:
            cropped.append(None)
            continue
        sprite = slot.crop(bbox)
        cropped.append(sprite)
        heights.append(sprite.height)

    stable_heights = sorted(heights)[: min(4, len(heights))]
    ref_height = sum(stable_heights) / len(stable_heights)
    scale = 142 / ref_height

    for frame, sprite in enumerate(cropped):
        if sprite is None:
            continue
        resized = sprite.resize(
            (max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
        if resized.width > FRAME and is_hero:
            x = frame * FRAME - 8
        elif resized.width > FRAME:
            x = frame * FRAME + FRAME - resized.width + 8
        else:
            x = frame * FRAME + (FRAME - resized.width) // 2
        y = FRAME - resized.height - 4
        out_img.alpha_composite(resized, (x, y))
    out_img.save(out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hero-source")
    parser.add_argument("--boss-source")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.hero_source and args.boss_source:
        normalize_generated_strip(Path(args.hero_source), OUT / "boss-hero-sheet.png")
        normalize_generated_strip(Path(args.boss_source), OUT / "boss-enemy-sheet.png")
    else:
        sheet(hero, OUT / "boss-hero-sheet.png")
        sheet(boss, OUT / "boss-enemy-sheet.png")

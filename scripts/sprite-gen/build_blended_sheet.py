#!/usr/bin/env python3
"""Compose a 6-frame sprite sheet from base + attack/hit pose images via PIL blending.

Used as fallback when only 2 keyframes are available (base idle + attack pose).
Produces frames:
  1: base idle
  2: base 90% + attack 10% with slight forward tilt -3deg
  3: base 30% + attack 70% (mid-swing)
  4: attack 100% with brightness flash +15%
  5: base 30% + attack 70% (follow through, motion blur)
  6: base idle

Output is a horizontal strip, frame_w × 6 × frame_h, transparent background.
"""
import os, sys
from PIL import Image, ImageEnhance, ImageFilter, ImageChops

ANIM = "/Users/namgicheol/Library/Mobile Documents/com~apple~CloudDocs/Developments/middle-grammar/.claude/worktrees/sprite-anim/game/assets/chars/anim"
CHARS = "/Users/namgicheol/Library/Mobile Documents/com~apple~CloudDocs/Developments/middle-grammar/.claude/worktrees/sprite-anim/game/assets/chars"

def load(path):
    if not os.path.exists(path):
        return None
    return Image.open(path).convert("RGBA")

def normalize_size(im, target_w, target_h):
    """Resize image to fit (target_w, target_h) preserving aspect."""
    bb = im.getbbox()
    if not bb:
        return im
    cropped = im.crop(bb)
    scale = min(target_w / cropped.width, target_h / cropped.height)
    nw, nh = int(cropped.width * scale), int(cropped.height * scale)
    cropped = cropped.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_w, target_h), (0,0,0,0))
    # Place: horizontally centered, baseline near bottom
    x = (target_w - nw) // 2
    y = target_h - nh - 6
    canvas.paste(cropped, (x, y), cropped)
    return canvas

def rotate_tilt(im, degrees):
    if degrees == 0:
        return im
    return im.rotate(degrees, resample=Image.BICUBIC, expand=False)

def brighten(im, factor):
    if factor == 1.0:
        return im
    # Brighten only RGB, keep alpha intact
    r, g, b, a = im.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Brightness(rgb).enhance(factor)
    r, g, b = rgb.split()
    return Image.merge("RGBA", (r, g, b, a))

def motion_blur(im, radius=4):
    return im.filter(ImageFilter.GaussianBlur(radius=radius))

def blend(im_a, im_b, ratio_b):
    """Alpha-respectful blend: result = im_a * (1-ratio_b) + im_b * ratio_b."""
    return Image.blend(im_a, im_b, ratio_b)

def build_blended_sheet(prefix, base_path, attack_path, frame_w=512, frame_h=640):
    base = load(base_path)
    attack = load(attack_path)
    if not base:
        print(f"[skip] {prefix}: no base at {base_path}")
        return None
    if not attack:
        print(f"[skip] {prefix}: no attack at {attack_path}")
        return None
    base = normalize_size(base, frame_w, frame_h)
    attack = normalize_size(attack, frame_w, frame_h)
    frames = [
        base,                                          # 1 idle
        blend(base, rotate_tilt(base, -3), 1.0),       # 2 windup (slight tilt back)
        blend(rotate_tilt(base, -3), attack, 0.7),     # 3 midswing
        brighten(attack, 1.18),                        # 4 impact (flash)
        blend(motion_blur(attack, 3), base, 0.4),      # 5 follow
        base,                                          # 6 recover
    ]
    sheet = Image.new("RGBA", (frame_w * len(frames), frame_h), (0,0,0,0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (frame_w * i, 0), fr)
    out_path = os.path.join(ANIM, f"{prefix}-sheet.png")
    sheet.save(out_path, "PNG", optimize=True)
    meta_path = os.path.join(ANIM, f"{prefix}-sheet.txt")
    with open(meta_path, "w") as f:
        f.write(f"frames={len(frames)}\nframe_w={frame_w}\nframe_h={frame_h}\nbuilt=blended\n")
    print(f"[ok] {out_path} (blended 6-frame from base + attack)")
    return out_path

if __name__ == "__main__":
    # Build for the chars we don't have real frames for
    todo = [
        ("hero-lv1", f"{CHARS}/hero-lv1.png", f"{CHARS}/hero-lv1-attack.png"),
        ("hero-lv2", f"{CHARS}/hero-lv2.png", f"{CHARS}/hero-lv2-attack.png"),
        ("boss-lv2", f"{CHARS}/boss-lv2.png", f"{CHARS}/boss-lv2-hit.png"),
        ("boss-lv3", f"{CHARS}/boss-lv3.png", f"{CHARS}/boss-lv3-hit.png"),
    ]
    only = sys.argv[1:]
    for prefix, base, attack in todo:
        if only and prefix not in only:
            continue
        build_blended_sheet(prefix, base, attack)
    print("done.")

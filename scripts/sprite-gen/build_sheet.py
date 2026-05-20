#!/usr/bin/env python3
"""Compose 6 frame PNGs into a single horizontal sprite sheet PNG.
- Auto-detects character bounding box per frame (alpha > 0).
- Centers each frame on a unified canvas of the largest bounding box.
- Strips horizontally."""
import os, sys, glob
from PIL import Image

ANIM = "/Users/namgicheol/Library/Mobile Documents/com~apple~CloudDocs/Developments/middle-grammar/game/assets/chars/anim"

def bbox(im):
    """Return alpha bounding box (l,t,r,b) — fallback to full image if no alpha."""
    if im.mode != "RGBA":
        return (0, 0, im.width, im.height)
    bb = im.getbbox()
    return bb or (0, 0, im.width, im.height)

def build_sheet(name_prefix, num_frames=6, padding=12):
    """Build sprite sheet for character `name_prefix` (e.g., 'hero-lv3').
    Reads files like {prefix}-01-idle.png ... {prefix}-06-recover.png in order."""
    frame_files = sorted(glob.glob(os.path.join(ANIM, f"{name_prefix}-[0-9][0-9]-*.png")))
    if len(frame_files) < num_frames:
        print(f"[skip] {name_prefix}: only {len(frame_files)} frames found")
        return None
    frame_files = frame_files[:num_frames]
    print(f"[build] {name_prefix}: {len(frame_files)} frames")
    frames = [Image.open(f).convert("RGBA") for f in frame_files]
    # Use a uniform canvas size = max of all original sizes
    cw = max(im.width for im in frames)
    ch = max(im.height for im in frames)
    # Normalize: center each frame's bounding box on (cw,ch) canvas with stable foot baseline
    norm_frames = []
    target_h = ch - padding * 2
    foot_y = ch - padding  # baseline near bottom
    for im in frames:
        l, t, r, b = bbox(im)
        cropped = im.crop((l, t, r, b))
        # Scale to fit within target_h while keeping aspect
        scale = min(1.0, target_h / cropped.height)
        nw, nh = int(cropped.width * scale), int(cropped.height * scale)
        if (nw, nh) != cropped.size:
            cropped = cropped.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (cw, ch), (0,0,0,0))
        # Place: horizontally centered, baseline (foot) at foot_y
        x = (cw - cropped.width) // 2
        y = foot_y - cropped.height
        canvas.paste(cropped, (x, y), cropped)
        norm_frames.append(canvas)
    # Compose horizontal strip
    sheet = Image.new("RGBA", (cw * num_frames, ch), (0,0,0,0))
    for i, fr in enumerate(norm_frames):
        sheet.paste(fr, (cw * i, 0), fr)
    out = os.path.join(ANIM, f"{name_prefix}-sheet.png")
    sheet.save(out, "PNG", optimize=True)
    meta = os.path.join(ANIM, f"{name_prefix}-sheet.txt")
    with open(meta, "w") as f:
        f.write(f"frames={num_frames}\nframe_w={cw}\nframe_h={ch}\ntotal_w={cw*num_frames}\n")
    print(f"[ok] {out} ({cw}x{ch} per frame, {num_frames} frames)")
    return out

if __name__ == "__main__":
    prefix = sys.argv[1] if len(sys.argv) > 1 else "hero-lv3"
    build_sheet(prefix)

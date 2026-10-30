"""Prepare raster assets for build_psd.js.

- Line art: trim to the drawing, make the outside transparent and keep the
  inside white so the product covers the wave where it overlaps it.
- Logo: cut from the reference label with its off-white background removed.
- Wave: record the top edge of the wave per column so products sit above it.

Usage: python3 prep_assets.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
OUT = ROOT / "build"

INK_FULL = 70     # luminance at or below this is solid line
INK_NONE = 215    # luminance at or above this is paper


def prep_line_art(path: Path, dest: Path) -> None:
    lum = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    ink = np.clip((INK_NONE - lum) / (INK_NONE - INK_FULL), 0, 1)

    # Flood-fill the paper from a 1px frame to find everything outside the outline.
    walls = Image.fromarray(np.where(ink > 0.35, 0, 255).astype(np.uint8))
    framed = Image.new("L", (walls.width + 2, walls.height + 2), 255)
    framed.paste(walls, (1, 1))
    ImageDraw.floodfill(framed, (0, 0), 128)
    outside = np.asarray(framed)[1:-1, 1:-1] == 128
    # Soften the inside mask slightly so the white fill tucks under the line.
    inside = Image.fromarray(np.where(outside, 0, 255).astype(np.uint8))
    inside = np.asarray(inside.filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255

    alpha = np.maximum(ink, inside)
    grey = np.where(outside, 0, 255 * (1 - ink))
    rgba = np.dstack([grey, grey, grey, alpha * 255]).astype(np.uint8)

    img = Image.fromarray(rgba, "RGBA")
    bbox = Image.fromarray((alpha > 0.02).astype(np.uint8) * 255).getbbox()
    img.crop(bbox).save(dest)


def color_to_alpha(rgb: np.ndarray, white: float) -> np.ndarray:
    """Remove an off-white paper colour, keeping colours exact over white."""
    c = rgb.astype(np.float32)
    alpha = np.clip(((white - c) / white).max(axis=2), 0, 1)
    alpha = np.clip((alpha - 0.04) / 0.96, 0, 1)
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    col = np.clip((c - white * (1 - alpha[..., None])) / safe, 0, 255)
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def prep_logo() -> None:
    ref = np.asarray(Image.open(SRC / "template" / "label-reference.png").convert("RGB"))
    box = (78, 22, 694, 372)  # left, top, right, bottom on the 1700x1080 label
    crop = ref[box[1]:box[3], box[0]:box[2]]
    Image.fromarray(color_to_alpha(crop, 246), "RGBA").save(OUT / "logo.png")
    (OUT / "logo.json").write_text(json.dumps({"left": box[0], "top": box[1]}))


def prep_wave() -> None:
    bg = np.asarray(Image.open(SRC / "template" / "label-background.png").convert("RGB")).astype(int)
    non_white = bg.sum(axis=2) < 700
    tops = []
    for x in range(bg.shape[1]):
        ys = np.where(non_white[500:, x])[0]
        tops.append(int(ys[0]) + 500 if len(ys) else bg.shape[0])
    (OUT / "wave_top.json").write_text(json.dumps(tops))


def main() -> None:
    (OUT / "art").mkdir(parents=True, exist_ok=True)
    for path in sorted((SRC / "line-art").glob("*.png")):
        prep_line_art(path, OUT / "art" / path.name)
    prep_logo()
    prep_wave()


if __name__ == "__main__":
    main()

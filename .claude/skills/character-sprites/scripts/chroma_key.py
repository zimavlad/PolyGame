#!/usr/bin/env python3
"""Cut a character rendered on a flat chroma-green background into a trimmed transparent sprite.

usage: chroma_key.py in.png out.webp [--max 520] [--box x0,y0,x1,y1] [--nocrop]
Alpha comes from how green each pixel is compared with the background; semi-transparent edge pixels are
un-mixed from the background colour (so fur keeps no green halo) and any remaining green spill is clamped.
"""
import argparse
import numpy as np
from PIL import Image

def key(im):
    a_rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    border = np.concatenate([a_rgb[:6].reshape(-1, 3), a_rgb[-6:].reshape(-1, 3), a_rgb[:, :6].reshape(-1, 3), a_rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    R, G, B = a_rgb[..., 0], a_rgb[..., 1], a_rgb[..., 2]
    gx = G - np.maximum(R, B)
    bgx = max(1.0, bg[1] - max(bg[0], bg[2]))
    alpha = 1 - np.clip((gx - bgx * 0.12) / (bgx * 0.62), 0, 1)
    alpha[gx <= bgx * 0.12] = 1
    a = alpha[..., None]
    # un-mix: observed = a*fg + (1-a)*bg  ->  fg = (observed - (1-a)*bg) / a
    fg = np.where(a > 0.02, (a_rgb - (1 - a) * bg) / np.maximum(a, 0.02), a_rgb)
    fg = np.clip(fg, 0, 255)
    R2, G2, B2 = fg[..., 0], fg[..., 1], fg[..., 2]
    cap = np.maximum(R2, B2) * 1.04 + 4
    G2 = np.minimum(G2, cap)
    out = np.dstack([R2, G2, B2, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--max', type=int, default=520)
    ap.add_argument('--box', default=None, help='crop to this box instead of the trimmed bounds')
    ap.add_argument('--nocrop', action='store_true')
    a = ap.parse_args()
    img = key(Image.open(a.inp))
    if a.box: img = img.crop(tuple(int(v) for v in a.box.split(',')))
    elif not a.nocrop:
        bb = img.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        img = img.crop((max(0, bb[0] - 6), max(0, bb[1] - 6), min(img.width, bb[2] + 6), min(img.height, bb[3] + 6)))
    if max(img.size) > a.max:
        k = a.max / max(img.size); img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    if a.out.endswith('.webp'): img.save(a.out, 'WEBP', quality=84, method=6)
    else: img.save(a.out, optimize=True)
    print(a.out, img.size)

if __name__ == '__main__':
    main()

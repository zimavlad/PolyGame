#!/usr/bin/env python3
"""Lay images out in a grid on a flat background so they can be compared at a glance.

usage: contact_sheet.py out.jpg img1 img2 ... [--cols 3] [--cell 420] [--bg 236,240,246] [--labels]
"""
import argparse, os
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('imgs', nargs='+')
ap.add_argument('--cols', type=int, default=3); ap.add_argument('--cell', type=int, default=420)
ap.add_argument('--bg', default='236,240,246'); ap.add_argument('--labels', action='store_true')
a = ap.parse_args()
bg = tuple(int(v) for v in a.bg.split(',')) + (255,)
rows = (len(a.imgs) + a.cols - 1) // a.cols
lab = 28 if a.labels else 0
M = Image.new('RGBA', (a.cols * a.cell, rows * (a.cell + lab)), bg)
d = ImageDraw.Draw(M)
for i, p in enumerate(a.imgs):
    im = Image.open(p).convert('RGBA'); im.thumbnail((a.cell - 20, a.cell - 20))
    x = (i % a.cols) * a.cell + (a.cell - im.width) // 2; y = (i // a.cols) * (a.cell + lab) + (a.cell - im.height) // 2
    M.alpha_composite(im, (x, y))
    if a.labels: d.text(((i % a.cols) * a.cell + 10, (i // a.cols) * (a.cell + lab) + a.cell + 4), os.path.basename(p), fill=(39, 48, 63, 255))
M.convert('RGB').save(a.out, quality=88)
print(a.out, M.size)

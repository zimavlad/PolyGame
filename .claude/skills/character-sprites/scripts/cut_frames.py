#!/usr/bin/env python3
"""Cut an animation sheet (any grid the model chose) into aligned transparent frames.

usage: cut_frames.py sheet.png out_prefix [--max 520] [--rows N] [--anchor feet|row|centre] [--q 84]
Keys the green screen, removes thin dark grid lines, finds rows of frames and the frames in each row by empty gaps,
drops rows whose frames are clearly bigger or smaller than the first row (models sometimes add a large copy),
then crops every frame to one shared box around a stable anchor: 'feet' = the bottom edge and the centre of the
lowest 30% of the body (for in-place cycles), 'centre' = the centre of mass. Writes out_prefix0.webp, 1, 2...
"""
import argparse, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chroma_key import key


def segments(profile, min_len, min_gap=3):
    segs, inside, start, gap = [], False, 0, 0
    for i, v in enumerate(profile):
        if v and not inside: inside, start, gap = True, i, 0
        elif v and inside: gap = 0
        elif not v and inside:
            gap += 1
            if gap >= min_gap: segs.append((start, i - gap + 1)); inside = False
    if inside: segs.append((start, len(profile)))
    return [s for s in segs if s[1] - s[0] >= min_len]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('out')
    ap.add_argument('--max', type=int, default=520)
    ap.add_argument('--rows', type=int, default=0, help='keep only the first N rows of frames')
    ap.add_argument('--anchor', default='feet')
    ap.add_argument('--q', type=int, default=84)
    a = ap.parse_args()
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')).copy()
    H, W, _ = rgb.shape
    # grid lines: long thin dark runs across most of the sheet → paint them green before keying
    dark = rgb.max(axis=2) < 60
    for y in np.where(dark.mean(axis=1) > 0.6)[0]: rgb[max(0, y - 2):y + 3, :] = (0, 255, 0)
    for x in np.where(dark.mean(axis=0) > 0.6)[0]: rgb[:, max(0, x - 2):x + 3] = (0, 255, 0)
    img = key(Image.fromarray(rgb))
    A = np.asarray(img)[..., 3]
    solid = A > 60
    rows = segments(solid.any(axis=1), H // 20, min_gap=4)
    frames = []
    for (y0, y1) in rows:
        cols = segments(solid[y0:y1].any(axis=0), W // 40, min_gap=4)
        frames.append([(x0, y0, x1, y1) for (x0, x1) in cols])
    if not frames: sys.exit('no frames found')
    ref = np.median([b[3] - b[1] for b in frames[0]])
    frames = [r for r in frames if abs(np.median([b[3] - b[1] for b in r]) - ref) < ref * 0.25 and len(r) >= 2]
    if a.rows: frames = frames[:a.rows]
    boxes = [b for r in frames for b in r]
    anchors = []
    for (x0, y0, x1, y1) in boxes:
        m = solid[y0:y1, x0:x1]; ys, xs = np.nonzero(m)
        if a.anchor == 'feet':
            bottom = ys.max(); low = ys > ys.min() + (bottom - ys.min()) * 0.7
            anchors.append((x0 + xs[low].mean(), y0 + bottom))
        elif a.anchor == 'row':  # jumps: keep the vertical motion, the row's floor is the ground
            anchors.append((x0 + xs.mean(), y1))
        else:
            anchors.append((x0 + xs.mean(), y0 + ys.mean()))
    # shared box: the largest extents of any frame around its anchor
    left = max(ax - b[0] for b, (ax, ay) in zip(boxes, anchors)) + 8
    right = max(b[2] - ax for b, (ax, ay) in zip(boxes, anchors)) + 8
    up = max(ay - b[1] for b, (ax, ay) in zip(boxes, anchors)) + 8
    down = max(b[3] - ay for b, (ax, ay) in zip(boxes, anchors)) + 8
    arr = np.asarray(img)
    for k, (b, (ax, ay)) in enumerate(zip(boxes, anchors)):
        only = np.zeros_like(arr); only[b[1]:b[3], b[0]:b[2]] = arr[b[1]:b[3], b[0]:b[2]]
        fr = Image.fromarray(only, 'RGBA').crop((int(ax - left), int(ay - up), int(ax + right), int(ay + down)))
        s = a.max / max(fr.size); fr = fr.resize((round(fr.width * s), round(fr.height * s)), Image.LANCZOS)
        fr.save(f'{a.out}{k}.webp', 'WEBP', quality=a.q, method=6)
    print(a.out, 'frames:', len(boxes), 'size:', fr.size, 'feet at', round(up / (up + down), 3), 'of height')


if __name__ == '__main__':
    main()

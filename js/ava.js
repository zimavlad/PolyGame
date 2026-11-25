// Ava, the family dog: AI-rendered sprites (img/ava/*.webp, made from her photos with the character-sprites skill).
// PG.ava.draw(ctx, x, y, size, {pose, t, dir, alpha}) draws her standing on the point (x, y);
// `size` is her body length in CSS px, so every pose shows the same dog at the same scale.
// Poses: sit, happy (sitting, tongue out), stand, sniff, stalk, jump, scared, sleep, run / walk (8-frame gallop).
// The sprites are still images, so life comes from small procedural motion: breathing, bobbing, trembling.
(function () {
'use strict';
const PG = window.PG;
const V = typeof BUILD !== 'undefined' ? BUILD : '1';
// per sprite: body length in source px (chest to rump, without the tail) and where her feet are (fraction of height)
const R = { body: 182, foot: 0.93 };
const META = {
  sit: { body: 310, foot: 0.97 }, happy: { body: 300, foot: 0.98 }, stand: { body: 300, foot: 0.97 },
  sniff: { body: 290, foot: 0.95 }, stalk: { body: 300, foot: 0.96 }, jump: { body: 330, foot: 0.98 },
  scared: { body: 360, foot: 0.96 }, sleep: { body: 420, foot: 0.97 },
  run0: R, run1: R, run2: R, run3: R, run4: R, run5: R, run6: R, run7: R
};
const FILE = {};
const IMG = {};
function img(name) {
  let im = IMG[name];
  if (!im) { im = IMG[name] = new Image(); im.decoding = 'async'; im.src = `img/ava/${FILE[name] || name}.webp?v=${V}`; }
  return im.complete && im.naturalWidth ? im : null;
}
function preload() { Object.keys(META).forEach(img); }

function draw(ctx, x, y, size, o = {}) {
  const t = o.t || 0, pose = o.pose || 'stand', dir = o.dir || 1;
  let name = pose, dy = 0, dx = 0, sx = 1, sy = 1, rot = 0;
  switch (pose) {
    case 'run': { const f = Math.floor(t * 18) % 8; name = 'run' + f; break; }
    case 'walk': { const f = Math.floor(t * 10) % 8; name = 'run' + f; break; }
    case 'jump': dy = -Math.abs(Math.sin(t * 5)) * size * 0.28; rot = Math.sin(t * 10) * 0.04; break;
    case 'scared': dx = Math.sin(t * 55) * size * 0.006; sy = 0.98 + Math.sin(t * 3) * 0.01; break;
    case 'sniff': rot = Math.sin(t * 9) * 0.015; dx = Math.sin(t * 1.3) * size * 0.02; break;
    case 'stalk': dx = Math.sin(t * 1.6) * size * 0.03; dy = Math.abs(Math.sin(t * 3.2)) * size * -0.008; break;
    case 'sleep': sy = 1 + Math.sin(t * 2) * 0.025; sx = 1 - Math.sin(t * 2) * 0.008; break;
    default: sy = 1 + Math.sin(t * 2.2) * 0.012; // breathing
  }
  const im = img(name), m = META[name] || META.stand;
  if (!im) { preload(); return false; }
  const k = size / m.body, w = im.naturalWidth * k, h = im.naturalHeight * k;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.translate(x + dx, y + dy);
  if (o.shadow !== false && true) { // soft ground shadow that shrinks as she lifts off
    const lift = Math.min(1, -dy / (size * 0.3));
    ctx.fillStyle = `rgba(39,48,63,${0.16 * (1 - lift * 0.6)})`;
    ctx.beginPath(); ctx.ellipse(0, -dy + 1, w * 0.36 * (1 - lift * 0.3), size * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(rot); ctx.scale(dir * sx, sy);
  ctx.drawImage(im, -w / 2, -h * m.foot, w, h);
  ctx.restore();
  return true;
}
// a small bone, the universal Ava treat
function bone(ctx, x, y, s, ang = 0, col = '#F4EADB') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s / 20, s / 20);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.rect(-7, -2.6, 14, 5.2);
  for (const [bx, by] of [[-8, -3], [-8, 3], [8, -3], [8, 3]]) { ctx.moveTo(bx + 3.4, by); ctx.arc(bx, by, 3.4, 0, Math.PI * 2); }
  ctx.fill(); ctx.restore();
}
// generic lazy image cache for other generated art (img/walk, img/treats, ...)
const SPR = {};
function sprite(path) {
  let im = SPR[path];
  if (!im) { im = SPR[path] = new Image(); im.decoding = 'async'; im.src = `${path}?v=${V}`; }
  return im.complete && im.naturalWidth ? im : null;
}
// draw a sprite centred on (x, y) with the given height (width keeps the aspect); returns false while loading
function drawSprite(ctx, path, x, y, h, o = {}) {
  const im = sprite(path); if (!im) return false;
  const w = im.naturalWidth * h / im.naturalHeight;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(im, -w / 2, -h * (o.ay != null ? o.ay : 0.5), w, h); ctx.restore();
  return true;
}
preload();
PG.ava = { draw, bone, img, preload, poses: Object.keys(META) };
PG.sprite = sprite; PG.drawSprite = drawSprite;
})();

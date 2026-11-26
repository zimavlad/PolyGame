// Ava, the family dog: AI-rendered sprites made from her photos with the character-sprites skill.
// PG.ava.draw(ctx, x, y, size, {pose, t, dir, alpha, shadow}) draws her standing on the point (x, y);
// `size` is her body length in CSS px, so every pose shows the same dog at the same scale.
// Cycles (img/ava/anim/<name>.webp, one horizontal strip each): run, walk, sniff, dig, idle, stalk, scared, hop.
// Stills (img/ava/<name>.webp): sit, happy, stand, sniff, stalk, jump, scared, sleep — used while a strip is loading.
// Everything is loaded and decoded up front, in the background, so nothing pops in during play.
(function () {
'use strict';
const PG = window.PG;
const V = typeof BUILD !== 'undefined' ? BUILD : '1';
// stills: body length in source px (chest to rump, without the tail) and where her feet are (fraction of height)
const META = {
  sit: { body: 310, foot: 0.97 }, happy: { body: 300, foot: 0.98 }, stand: { body: 300, foot: 0.97 },
  sniff: { body: 290, foot: 0.95 }, stalk: { body: 300, foot: 0.96 }, jump: { body: 330, foot: 0.98 },
  scared: { body: 360, foot: 0.96 }, sleep: { body: 420, foot: 0.97 }
};
// cycles: frames in the strip, frames per second, body length in frame px, feet line, the still to show meanwhile
const ANIM = {
  run: { n: 8, fps: 18, body: 124, foot: 0.93, still: 'stand' },
  walk: { n: 8, fps: 11, body: 132, foot: 0.963, still: 'stand' },
  sniff: { n: 8, fps: 9, body: 125, foot: 0.972, still: 'sniff' },
  dig: { n: 8, fps: 15, body: 144, foot: 0.975, still: 'sniff' },
  idle: { n: 8, fps: 6, body: 147, foot: 0.987, still: 'happy' },
  stalk: { n: 16, fps: 12, body: 134, foot: 0.961, still: 'stalk' },
  scared: { n: 12, fps: 16, body: 162, foot: 0.979, still: 'scared' },
  hop: { n: 8, fps: 11, body: 144, foot: 0.989, still: 'jump' }
};
// single frames of the gallop, for a dog in the air
const FIXED = { leapUp: ['run', 0], leapDown: ['run', 5] };

const IMG = {};
function load(path) {
  let im = IMG[path];
  if (!im) {
    im = IMG[path] = new Image(); im.decoding = 'async'; im.src = `${path}?v=${V}`;
    // decode off the main thread now, so the first draw does not stall a frame
    if (im.decode) im.decode().then(() => { im.ready = true; }).catch(() => { im.ready = im.complete && im.naturalWidth > 0; });
  }
  return im.complete && im.naturalWidth && (im.ready !== false) ? im : null;
}
const still = name => load(`img/ava/${name}.webp`);
const strip = name => load(`img/ava/anim/${name}.webp`);
function preload() { Object.keys(META).forEach(still); Object.keys(ANIM).forEach(strip); }

function draw(ctx, x, y, size, o = {}) {
  const t = o.t || 0, dir = o.dir || 1;
  let pose = o.pose || 'stand', frame = -1, dy = 0, sy = 1;
  if (FIXED[pose]) { frame = FIXED[pose][1]; pose = FIXED[pose][0]; }
  const a = ANIM[pose];
  let im = null, m = null, sx0 = 0, fw = 0, fh = 0;
  if (a) {
    im = strip(pose);
    if (im) { m = a; fw = im.naturalWidth / a.n; fh = im.naturalHeight; sx0 = (frame >= 0 ? frame : Math.floor(t * a.fps) % a.n) * fw; }
  }
  if (!im) { // a still: the pose itself, or the stand-in while its cycle is loading
    const nm = a ? a.still : pose;
    im = still(nm); m = META[nm] || META.stand;
    if (!im) { preload(); return false; }
    fw = im.naturalWidth; fh = im.naturalHeight;
    if (pose === 'jump') dy = -Math.abs(Math.sin(t * 5)) * size * 0.28;
    else if (pose !== 'sleep') sy = 1 + Math.sin(t * 2.2) * 0.012; // breathing
    else sy = 1 + Math.sin(t * 2) * 0.025;
  }
  const k = size / m.body, w = fw * k, h = fh * k;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y + dy);
  if (o.shadow !== false) { // soft ground shadow that shrinks as she lifts off
    const lift = Math.min(1, -dy / (size * 0.3));
    ctx.fillStyle = `rgba(39,48,63,${0.16 * (1 - lift * 0.6)})`;
    ctx.beginPath(); ctx.ellipse(0, -dy + 1, w * 0.36 * (1 - lift * 0.3), size * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.scale(dir, sy);
  ctx.drawImage(im, sx0, 0, fw, fh, -w / 2, -h * m.foot, w, h);
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
// the shared image cache for other generated art (img/walk, img/treats, img/bolts...)
const sprite = path => load(path);
// draw a sprite centred on (x, y) with the given height (width keeps the aspect); returns false while loading
function drawSprite(ctx, path, x, y, h, o = {}) {
  const im = sprite(path); if (!im) return false;
  const w = im.naturalWidth * h / im.naturalHeight;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(im, -w / 2, -h * (o.ay != null ? o.ay : 0.5), w, h); ctx.restore();
  return true;
}
// all game art, fetched a little after start-up so the menu appears first
const ART = ['img/walk/bg_park.webp', 'img/walk/bg_beach.webp', 'img/walk/bg_yard.webp', 'img/walk/dog_big.webp', 'img/walk/dog_pug.webp',
  'img/walk/dog_dach.webp', 'img/walk/cat.webp', 'img/walk/bush.webp', 'img/walk/stone.webp', 'img/walk/puddle.webp',
  'img/bolts/nut.webp', 'img/bolts/bolt.webp', 'img/bolts/board.webp', 'img/bolts/bg.webp']
  .concat(['biscuit', 'cookie', 'sausage', 'ball', 'chicken', 'frisbee', 'bone', 'bear', 'bed'].map(n => `img/treats/${n}.webp`));
preload();
setTimeout(() => ART.forEach(sprite), 1200);
PG.ava = { draw, bone, preload, poses: Object.keys(META).concat(Object.keys(ANIM)) };
PG.sprite = sprite; PG.drawSprite = drawSprite;
})();

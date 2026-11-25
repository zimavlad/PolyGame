// Ava, the family dog, drawn with canvas paths from her photos: a slim black-and-tan mix with a grey-black head,
// tan "eyebrow" dots, tan cheeks, a narrow grey muzzle, big feathery ears (the left one flops, the right one stands),
// a cream bib, white stockings on the front legs, white toes behind, a plume tail curled over the back with a blond
// fringe, and a red collar with a round silver "AVA" tag. She is shy: ears go flat when she worries, she drops low and
// creeps when she sees another dog, jumps and wags when she meets Polina, and sleeps curled in a ball.
// PG.ava.draw(ctx, x, y, size, {pose, t, dir, ears, wag, blink, harness}) — side view, (x, y) = ground under her middle.
// PG.ava.face(ctx, x, y, r, {mood, t}) — front portrait for menus and pop-ups.
(function () {
'use strict';
const PG = window.PG;
const C = {
  black: '#25242B', black2: '#33333D', grey: '#4E5260', muzzle: '#5E616D', tan: '#C7864A', tan2: '#DDA468',
  blond: '#E8C890', cream: '#F4EADB', white: '#FBF8F2', nose: '#141318', eye: '#2A170E', pink: '#E9A7A3',
  tongue: '#EE7B8C', red: '#D8343C', red2: '#A82830', tag: '#CBD1DA', tagD: '#8D96A5', harness: '#E85FA8'
};
const TAU = Math.PI * 2;

function ell(ctx, x, y, rx, ry, rot, col) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
// a tapered limb segment from (x1,y1) width w1 to (x2,y2) width w2
function limb(ctx, x1, y1, x2, y2, w1, w2, col) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2); ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.arc(x2, y2, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.fillStyle = col; ctx.fill();
}
// joint chain: angles measured from straight down, positive = forward (towards the nose)
function chain(x, y, segs) { const pts = [[x, y]]; let cx = x, cy = y; for (const [len, ang] of segs) { cx += Math.sin(ang) * len; cy += Math.cos(ang) * len; pts.push([cx, cy]); } return pts; }
function fringe(ctx, pts, col, w) { // soft tapered hair strands: [x0,y0, cx,cy, x1,y1]
  ctx.fillStyle = col;
  for (const p of pts) {
    const a = Math.atan2(p[5] - p[1], p[4] - p[0]), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    ctx.beginPath(); ctx.moveTo(p[0] + nx, p[1] + ny);
    ctx.quadraticCurveTo(p[2] + nx * 0.6, p[3] + ny * 0.6, p[4], p[5]);
    ctx.quadraticCurveTo(p[2] - nx * 0.6, p[3] - ny * 0.6, p[0] - nx, p[1] - ny);
    ctx.closePath(); ctx.fill();
  }
}
// quadratic curve samples
function qpts(x0, y0, cx, cy, x1, y1, n) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); } return r; }
// soft feathered fur off an edge: a filled band with a scalloped, uneven outer edge, swept by "gravity"
function fluff(ctx, pts, side, len, col, sweep) {
  const sw = sweep || [0, 0], n = pts.length, tips = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1; nx = nx / d * side; ny = ny / d * side;
    const L = len * (i === 0 || i === n - 1 ? 0.25 : (i % 2 ? 1 : 0.62) * (0.85 + 0.15 * Math.sin(i * 2.3)));
    tips.push([pts[i][0] + (nx + sw[0]) * L, pts[i][1] + (ny + sw[1]) * L]);
  }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  for (let i = n - 1; i > 0; i--) { const m = [(tips[i][0] + tips[i - 1][0]) / 2, (tips[i][1] + tips[i - 1][1]) / 2]; ctx.quadraticCurveTo(tips[i][0], tips[i][1], m[0], m[1]); }
  ctx.lineTo(tips[0][0], tips[0][1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

/* ---------- pose tables: body centre height, tilt, legs, head, tail ---------- */
// legs: [front-near, front-far, hind-near, hind-far]; front = [upper, lower], hind = [thigh, shin, foot]
function poseOf(name, t) {
  const s = Math.sin, c = Math.cos;
  switch (name) {
    case 'run': {
      const p = t * 11, a = s(p), b = s(p + 0.9);
      return { by: -42 + Math.abs(c(p)) * -5, tilt: s(p) * 0.06, head: [4, -2 + s(p) * 2, 0.1], ears: 0.65, tail: -0.9 + s(p * 2) * 0.12, wagAmp: 0.05,
        legs: [[0.9 * a + 0.2, 0.9 * a - 0.5], [0.9 * b + 0.2, 0.9 * b - 0.5], [-0.9 * a + 0.2, -0.9 * a - 0.5, 0.2], [-0.9 * b + 0.2, -0.9 * b - 0.5, 0.2]] };
    }
    case 'walk': {
      const p = t * 6, a = s(p), b = s(p + Math.PI);
      return { by: -45 + Math.abs(s(p)) * -1.5, tilt: 0, head: [0, s(p * 2) * 0.8, 0], ears: 0.1, tail: 0, wagAmp: 0.18,
        legs: [[0.35 * a, 0.35 * a - Math.max(0, -a) * 0.6], [0.35 * b, 0.35 * b - Math.max(0, -b) * 0.6], [0.35 + 0.35 * b, -0.45 + 0.3 * b, 0.1], [0.35 + 0.35 * a, -0.45 + 0.3 * a, 0.1]] };
    }
    case 'bow': // play bow / hunting crouch: front legs stretched flat on the ground, bum up, tail high
      return { by: -22, tilt: 0.42, head: [-1, 6, -0.3], ears: 0.35, tail: 0.15, wagAmp: 0.22,
        legs: [[1.17, 0.82], [1.1, 0.86], [1.12, -1.45, 0.75], [1.05, -1.4, 0.75]] };
    case 'creep': { // low stalking crawl, slow steps
      const p = t * 3.2, a = s(p), b = s(p + Math.PI);
      return { by: -24, tilt: 0.04, head: [6, 6, -0.12], ears: 0.85, tail: -1.35, wagAmp: 0.02,
        legs: [[0.9 + 0.25 * a, -0.6 - 0.2 * a], [0.9 + 0.25 * b, -0.6 - 0.2 * b], [1.0 + 0.2 * b, -1.0, 0.15], [1.0 + 0.2 * a, -1.0, 0.15]] };
    }
    case 'jump': { // greeting hop on hind legs, front paws up, wild wag
      const h = Math.abs(s(t * 5.5));
      return { by: -50 - h * 14, tilt: -0.55, head: [2, -2, 0.35], ears: 0.25, tail: -0.2, wagAmp: 0.6, wagSpeed: 26,
        legs: [[1.4, 0.6], [1.5, 0.75], [-0.05, -0.45, 0.25], [0.05, -0.4, 0.25]] };
    }
    case 'scared': // ears flat, low, tail tucked, slight tremble
      return { by: -38 + s(t * 40) * 0.4, tilt: 0.06, head: [0, 4, -0.15], ears: 1, tail: -2.1, wagAmp: 0.02,
        legs: [[0.15, -0.35], [0.12, -0.32], [0.55, -0.85, 0.15], [0.55, -0.85, 0.15]] };
    case 'sniff': { // nose down to the ground, little steps
      const p = t * 3, a = s(p) * 0.12;
      return { by: -44, tilt: 0.12, head: [6, 22, -1.0 + s(t * 14) * 0.04], ears: 0.2, tail: 0.1, wagAmp: 0.25,
        legs: [[0.15 + a, -0.1 + a], [0.1 - a, -0.12 - a], [0.4, -0.5, 0.1], [0.38, -0.48, 0.1]] };
    }
    default: // stand
      return { by: -45, tilt: 0, head: [0, s(t * 1.7) * 0.6, 0.02], ears: 0.08, tail: 0, wagAmp: 0.15,
        legs: [[0.06, -0.02], [-0.04, -0.03], [0.38, -0.5, 0.12], [0.3, -0.45, 0.1]] };
  }
}

/* ---------- parts ---------- */
// a smooth tapered tube along sampled points (w0 at the start, w1 at the end)
function tube(ctx, pts, w0, w1, col) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  ctx.arc(pts[n - 1][0], pts[n - 1][1], w1 / 2, 0, TAU);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function cubic(p0, p1, p2, p3, n) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return r; }
function drawTail(ctx, x, y, ang) {
  // a plume that rises and curls forward over the back, black on top with a long blond fringe underneath
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const pts = cubic([0, 0], [-13, -9], [-16, -31], [-1, -34], 16);
  const under = pts.slice(3).map((p, i, arr) => { const q = arr[Math.min(arr.length - 1, i + 1)], a = Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.PI / 2; return [p[0] + Math.cos(a) * 3, p[1] + Math.sin(a) * 3]; });
  fluff(ctx, under, -1, 12, C.blond, [-0.2, 0.5]);
  tube(ctx, pts, 12, 6.5, C.black);
  ell(ctx, -1, -34, 3.2, 2.6, 0.3, C.blond);
  ctx.restore();
}
function drawEar(ctx, x, y, ang, far, flop) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(0.74, 0.74);
  const body = far ? C.black : C.black2, hair = far ? '#8E7450' : '#DDB97E';
  // long feathering off the back edge, the signature of her ears
  fluff(ctx, qpts(-6, 2, -10, -13, -1, -23, 8), -1, 5.5, hair, [-0.1, 0.7]);
  ctx.beginPath(); ctx.moveTo(-6, 2); ctx.quadraticCurveTo(-10, -13, -1, -23); ctx.quadraticCurveTo(8, -14 + flop * 4, 8, 2); ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  if (!far) { ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-5, -10, -1, -17); ctx.quadraticCurveTo(4, -10, 5, 0); ctx.closePath(); ctx.fillStyle = C.pink; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; }
  ell(ctx, 2 + flop * 2, -20 + flop * 2, 4.2, 3, 0.8, body);
  ctx.restore();
}
function drawHead(ctx, o, earAng, t) {
  // head frame: skull centre at 0,0, muzzle pointing +x; a round skull and a slim muzzle
  const blink = o.blink != null ? o.blink : (((t * 0.7) % 3.3) < 0.12 ? 1 : 0);
  drawEar(ctx, -6, -8, earAng - 0.15, true, 0.6);
  fluff(ctx, qpts(-10, -2, -10, 10, 2, 11, 6), -1, 5, C.tan, [-0.3, 0.4]); // scruffy cheek fur behind the jaw
  ell(ctx, 0, 0, 12.5, 11.5, 0, C.black);
  ell(ctx, 1, -5, 8, 5.5, -0.2, C.grey);
  ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(14, -5, 20, -1.5); ctx.quadraticCurveTo(22.5, 2, 19.5, 4.5); ctx.quadraticCurveTo(12, 9.5, 3, 9); ctx.closePath();
  ctx.fillStyle = C.tan; ctx.fill();
  ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(14, -5, 20, -1.5); ctx.quadraticCurveTo(13, -0.5, 6, 0.5); ctx.closePath();
  ctx.fillStyle = C.muzzle; ctx.fill();
  ell(ctx, 3.5, 4.5, 7.5, 5.5, 0.15, C.tan);
  ell(ctx, 3, -10, 2.6, 2, -0.2, C.tan2); // the tan "eyebrow" dot
  if (blink) { ctx.strokeStyle = C.nose; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2.5, -4.5); ctx.quadraticCurveTo(5.5, -3, 8.5, -4.5); ctx.stroke(); }
  else { ell(ctx, 5.6, -4.4, 3.6, 3.4, 0, C.nose); ell(ctx, 5.8, -4.3, 3, 2.9, 0, C.eye); ell(ctx, 6.9, -5.6, 1.2, 1.2, 0, '#FFFFFF'); }
  ell(ctx, 20.4, -0.4, 2.7, 2.3, 0.2, C.nose);
  if (o.pant) {
    ctx.beginPath(); ctx.moveTo(9, 5.5); ctx.quadraticCurveTo(14, 6.5, 18, 3.8); ctx.quadraticCurveTo(14, 10, 9, 8.5); ctx.closePath(); ctx.fillStyle = '#5A2A2E'; ctx.fill();
    const tl = 4 + Math.sin(t * 9);
    ctx.beginPath(); ctx.moveTo(10, 7); ctx.quadraticCurveTo(11.5, 8 + tl * 1.6, 14, 8 + tl); ctx.quadraticCurveTo(15.5, 7 + tl * 0.5, 15.5, 6); ctx.closePath(); ctx.fillStyle = C.tongue; ctx.fill();
  } else { ctx.strokeStyle = 'rgba(20,19,24,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 5.5); ctx.quadraticCurveTo(14, 6, 18, 3.4); ctx.stroke(); }
  drawEar(ctx, -2, -9, earAng, false, 0.3);
}

function drawSide(ctx, x, y, size, o) {
  const t = o.t || 0, name = o.pose || 'stand', pose = poseOf(name, t), k = size / 100;
  const earsBack = o.ears != null ? o.ears : pose.ears;
  ctx.save(); ctx.translate(x, y); ctx.scale((o.dir || 1) * k, k); ctx.lineJoin = 'round';
  ell(ctx, 0, 1, 34, 4, 0, 'rgba(39,48,63,0.14)'); // soft ground shadow
  ctx.translate(0, pose.by); ctx.rotate(pose.tilt);
  const L = pose.legs;
  const FS = [18, 2], HS = [-22, 0]; // shoulder and hip in body frame (hidden under the torso)
  const front = (sh, lg, near) => {
    const p = chain(sh[0], sh[1], [[19, lg[0]], [19, lg[0] + lg[1]]]);
    const tan = near ? C.tan : '#9A693B', white = near ? C.white : '#D8D2C6';
    limb(ctx, p[0][0], p[0][1], p[1][0], p[1][1], 9, 6.5, tan);
    // white stocking from mid-forearm down, a fluffy paw
    const m = [(p[1][0] * 0.65 + p[2][0] * 0.35), (p[1][1] * 0.65 + p[2][1] * 0.35)];
    limb(ctx, p[1][0], p[1][1], m[0], m[1], 6.5, 6, tan);
    limb(ctx, m[0], m[1], p[2][0], p[2][1], 6.2, 6, white);
    const fa = lg[0] + lg[1];
    ell(ctx, p[2][0] + Math.cos(fa) * 1.8, p[2][1] - Math.sin(fa) * 0.5, 4.8, 3, Math.abs(fa) > 1.2 ? 0 : 0, white);
  };
  const hind = (hp, lg, near) => {
    const p = chain(hp[0], hp[1], [[15, lg[0]], [15, lg[0] + lg[1]], [10, lg[0] + lg[1] + lg[2]]]);
    const tan = near ? C.tan : '#9A693B';
    limb(ctx, p[0][0], p[0][1], p[1][0], p[1][1], 15, 9, near ? C.black2 : C.black);
    limb(ctx, p[1][0], p[1][1], p[2][0], p[2][1], 8, 5.5, tan);
    limb(ctx, p[2][0], p[2][1], p[3][0], p[3][1], 5.5, 5, tan);
    ell(ctx, p[3][0] + 1.6, p[3][1] - 0.4, 4.3, 2.7, 0, near ? C.white : '#D8D2C6');
  };
  // far legs and the tail behind everything
  front([FS[0] - 4, FS[1]], L[1], false); hind([HS[0] - 4, HS[1]], L[3], false);
  const wag = (o.wag != null ? o.wag : pose.wagAmp) * Math.sin(t * (pose.wagSpeed || 14));
  drawTail(ctx, -30, -9, pose.tail + wag);
  front(FS, L[0], true);
  // torso: deep chest, slim waist, round rump (covers the tops of the legs)
  ctx.beginPath();
  ctx.moveTo(20, -15); ctx.quadraticCurveTo(-4, -18, -26, -13); ctx.quadraticCurveTo(-36, -9, -34, 2);
  ctx.quadraticCurveTo(-31, 11, -20, 9); ctx.quadraticCurveTo(-6, 6, 8, 11); ctx.quadraticCurveTo(22, 16, 29, 4);
  ctx.quadraticCurveTo(31, -6, 20, -15); ctx.closePath();
  ctx.fillStyle = C.black; ctx.fill();
  ell(ctx, -8, -12.5, 18, 3.5, -0.03, C.black2); // soft sheen along the back
  if (o.harness) { ctx.save(); ctx.beginPath(); ctx.rect(5, -20, 8, 36); ctx.clip(); ell(ctx, 9, -1, 16, 16, 0, C.harness); ctx.restore(); }
  ell(ctx, -6, 8, 10, 2.6, 0.12, C.tan); // tan underline of the belly
  // cream bib with fluffy edge at the chest
  ctx.beginPath(); ctx.moveTo(22, -4); ctx.quadraticCurveTo(31, 0, 28, 8); ctx.quadraticCurveTo(24, 14, 17, 12); ctx.quadraticCurveTo(19, 4, 22, -4); ctx.closePath();
  ctx.fillStyle = C.tan2; ctx.fill();
  fluff(ctx, qpts(28, 4, 25, 13, 15, 12, 6), 1, 4.5, C.cream, [0, 0.6]);
  ell(ctx, 25, 4, 3.6, 5, -0.3, C.cream);
  hind(HS, L[2], true);
  ell(ctx, -27, 2, 5.5, 6, 0.3, C.tan); // tan patch behind the thigh
  // thick neck with a ruff, then the head
  const [hdx, hdy, hang] = pose.head;
  const hx = 34 + hdx, hy = -30 + hdy;
  ctx.beginPath(); ctx.moveTo(14, -16); ctx.quadraticCurveTo(hx - 14, hy - 10, hx - 6, hy - 9); ctx.lineTo(hx + 6, hy + 6); ctx.quadraticCurveTo(hx + 2, hy + 16, 29, 2); ctx.closePath();
  ctx.fillStyle = C.black; ctx.fill();
  fluff(ctx, qpts(hx + 4, hy + 8, hx - 1, hy + 16, 28, 0, 5), -1, 4, C.black, [0, 0.4]);
  // red collar and the silver tag hanging under the chin
  ctx.save(); ctx.translate(hx - 4, hy + 5); ctx.rotate(0.6 + hang * 0.5);
  ctx.fillStyle = C.red; PG.rrect(-3, -11, 5.5, 22, 2.5); ctx.fill();
  ctx.fillStyle = C.red2; ctx.fillRect(-0.5, -11, 1, 22);
  ctx.restore();
  const tx = hx + 1 + Math.sin(t * 3) * 0.6, ty = hy + 14;
  ell(ctx, tx, ty, 3.4, 3.4, 0, C.tagD); ell(ctx, tx, ty, 2.7, 2.7, 0, C.tag);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(hang); ctx.scale(1.25, 1.25);
  drawHead(ctx, Object.assign({ pant: name === 'run' || name === 'jump' }, o), -0.75 - earsBack * 0.9, t);
  ctx.restore();
  ctx.restore();
}

function drawSleep(ctx, x, y, size, o) {
  const t = o.t || 0, k = size / 100, br = 1 + Math.sin(t * 2.2) * 0.025;
  ctx.save(); ctx.translate(x, y); ctx.scale((o.dir || 1) * k, k);
  ell(ctx, 0, 1, 36, 5, 0, 'rgba(39,48,63,0.14)');
  ctx.translate(0, -20); ctx.scale(1, br);
  // curled body: a round black loaf, the tail wrapping round the front with its blond fringe
  ell(ctx, -2, 0, 32, 20, 0, C.black);
  ell(ctx, -8, -10, 20, 6, -0.1, C.black2);
  ell(ctx, -24, 8, 9, 7, 0.2, C.tan); // tan hip
  // front paws tucked under the chin, white stockings
  limb(ctx, 4, 14, 26, 15, 6, 5, C.white); limb(ctx, 0, 17, 22, 18, 6, 5, C.white);
  // head resting on the paws, eyes shut, ear lying back
  ctx.save(); ctx.translate(22, 2); ctx.rotate(0.35);
  ell(ctx, 0, 0, 11, 10, 0, C.black); ell(ctx, 2, -4, 7, 5, -0.2, C.grey);
  ctx.beginPath(); ctx.moveTo(4, -5); ctx.quadraticCurveTo(14, -4, 20, -1); ctx.quadraticCurveTo(21, 3, 18, 4); ctx.quadraticCurveTo(12, 8, 3, 8); ctx.closePath(); ctx.fillStyle = C.tan; ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, -5); ctx.quadraticCurveTo(14, -4, 20, -1); ctx.quadraticCurveTo(12, 0, 5, 1); ctx.closePath(); ctx.fillStyle = C.muzzle; ctx.fill();
  ell(ctx, 3, 3, 6, 5, 0.1, C.tan); ell(ctx, 3, -8.5, 2.3, 1.8, -0.2, C.tan2);
  ell(ctx, 20, -0.4, 2.4, 2, 0.2, C.nose);
  ctx.strokeStyle = C.nose; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(2.5, -4); ctx.quadraticCurveTo(5, -2.6, 7.5, -4); ctx.stroke();
  drawEar(ctx, -3, -7, -1.75, false, 0.4);
  ctx.restore();
  // the tail wraps round the front
  ctx.beginPath(); ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-24, 26, 6, 22); ctx.strokeStyle = C.black2; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  fringe(ctx, [[-22, 18, -20, 26, -14, 28], [-12, 21, -9, 28, -3, 29], [-2, 22, 2, 28, 8, 28], [6, 22, 10, 26, 14, 25]], C.blond, 5);
  ctx.restore();
  // Zzz
  if (o.zzz !== false) {
    const z = (t * 0.6) % 1;
    for (let i = 0; i < 3; i++) {
      const p = (z + i / 3) % 1;
      PG.txt('z', x + (o.dir || 1) * (size * 0.3 + p * size * 0.18), y - size * 0.45 - p * size * 0.3, size * (0.1 + p * 0.06), PG.rgba('#7765EE', 1 - p), { font: PG.FD });
    }
  }
}

/* ---------- front portrait ---------- */
function face(ctx, x, y, r, o = {}) {
  const t = o.t || 0, mood = o.mood || 'happy', k = r / 50;
  const worried = mood === 'worried', sleepy = mood === 'sleepy';
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineJoin = 'round';
  ctx.rotate(o.tilt != null ? o.tilt : Math.sin(t * 1.3) * 0.05);
  // shoulders, cream bib
  ctx.beginPath(); ctx.moveTo(-34, 70); ctx.quadraticCurveTo(-36, 34, -14, 28); ctx.lineTo(14, 28); ctx.quadraticCurveTo(36, 34, 34, 70); ctx.quadraticCurveTo(0, 80, -34, 70); ctx.closePath(); ctx.fillStyle = C.black; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, 74); ctx.quadraticCurveTo(-20, 44, 0, 36); ctx.quadraticCurveTo(20, 44, 18, 74); ctx.quadraticCurveTo(0, 77, -18, 74); ctx.closePath(); ctx.fillStyle = C.cream; ctx.fill();
  ell(ctx, -22, 62, 7, 10, 0.3, C.tan); ell(ctx, 22, 62, 7, 10, -0.3, C.tan);
  // ears: her right ear (viewer's left) flops out sideways, her left one stands tall with a folded tip
  const eb = worried ? 1 : 0, ew = Math.sin(t * 2.1) * 0.04;
  const ear = (side) => {
    const L = side < 0;
    ctx.save(); ctx.translate(side * 21, -27);
    ctx.rotate(L ? -1.05 - eb * 0.55 + ew : 0.28 + eb * 1.25 - ew);
    if (!L) ctx.scale(-1, 1);
    // feathering off the outer edge
    fluff(ctx, qpts(-11, 6, -16, -20, -1, -36, 9), -1, 11, C.blond, [0, 0.5]);
    ctx.beginPath(); ctx.moveTo(-11, 6); ctx.quadraticCurveTo(-16, -20, -1, -36); ctx.quadraticCurveTo(14, -20, 13, 6); ctx.closePath(); ctx.fillStyle = C.black2; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(-8, -15, -1, -26); ctx.quadraticCurveTo(8, -14, 8, 4); ctx.closePath(); ctx.fillStyle = C.pink; ctx.globalAlpha = 0.65; ctx.fill(); ctx.globalAlpha = 1;
    fringe(ctx, [[-2, 2, -5, -8, -3, -16], [3, 2, 2, -8, 3, -14]], 'rgba(232,200,144,.7)', 3);
    if (!L) ell(ctx, 5, -33, 7, 4.5, 0.9, C.black2);
    ctx.restore();
  };
  ear(-1); ear(1);
  // head: rounded skull, cheeks a touch wider, grey-black
  ctx.beginPath(); ctx.moveTo(-27, -14); ctx.quadraticCurveTo(-29, -44, 0, -44); ctx.quadraticCurveTo(29, -44, 27, -14);
  ctx.quadraticCurveTo(28, 10, 15, 24); ctx.quadraticCurveTo(0, 33, -15, 24); ctx.quadraticCurveTo(-28, 10, -27, -14); ctx.closePath();
  ctx.fillStyle = C.black; ctx.fill();
  ell(ctx, 0, -30, 15, 10, 0, C.grey);
  // scruffy cheek tufts
  fluff(ctx, qpts(-27, -6, -29, 10, -15, 24, 7), -1, 8, C.tan, [0, 0.4]); fluff(ctx, qpts(27, -6, 29, 10, 15, 24, 7), 1, 8, C.tan, [0, 0.4]);
  ell(ctx, -14, 9, 12, 11, 0.3, C.tan); ell(ctx, 14, 9, 12, 11, -0.3, C.tan);
  const bw = worried ? -3 : 0;
  ell(ctx, -13, -17 + bw, 5, 3.6, worried ? 0.55 : -0.2, C.tan2); ell(ctx, 13, -17 + bw, 5, 3.6, worried ? -0.55 : 0.2, C.tan2);
  // long narrow muzzle: grey bridge to the nose, tan chin
  ctx.beginPath(); ctx.moveTo(-7, -14); ctx.quadraticCurveTo(-12, 10, -9, 19); ctx.quadraticCurveTo(0, 25, 9, 19); ctx.quadraticCurveTo(12, 10, 7, -14); ctx.closePath();
  ctx.fillStyle = C.muzzle; ctx.fill();
  ell(ctx, 0, 23, 9, 5, 0, C.tan2);
  // eyes: big, dark brown, glossy
  for (const sx of [-1, 1]) {
    const ex = sx * 13, ey = -5;
    if (sleepy) { ctx.strokeStyle = C.nose; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 5.5, ey); ctx.quadraticCurveTo(ex, ey + 4, ex + 5.5, ey); ctx.stroke(); continue; }
    if (((t * 0.6) % 3.6) < 0.12) { ctx.strokeStyle = C.nose; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 5.5, ey); ctx.lineTo(ex + 5.5, ey); ctx.stroke(); continue; }
    ell(ctx, ex, ey, 7.4, 7.2, 0, C.nose); ell(ctx, ex, ey + 0.4, 6.2, 6.1, 0, '#3A2214'); ell(ctx, ex, ey + 0.6, 4, 4, 0, '#160C07');
    ell(ctx, ex + 2.2, ey - 2.6, 2.3, 2.3, 0, '#FFFFFF'); ell(ctx, ex - 2.4, ey + 2.6, 1.1, 1.1, 0, 'rgba(255,255,255,.6)');
    if (worried) ell(ctx, ex, ey - 6.6, 7.6, 2.2, 0, C.black);
  }
  ctx.beginPath(); ctx.moveTo(-8, 15); ctx.quadraticCurveTo(0, 10, 8, 15); ctx.quadraticCurveTo(8, 21, 0, 22.5); ctx.quadraticCurveTo(-8, 21, -8, 15); ctx.closePath(); ctx.fillStyle = C.nose; ctx.fill();
  ell(ctx, -2.8, 14.5, 2.2, 1.2, 0, 'rgba(255,255,255,.35)');
  if (mood === 'happy') {
    ctx.beginPath(); ctx.moveTo(-10, 25); ctx.quadraticCurveTo(0, 36, 10, 25); ctx.quadraticCurveTo(0, 29, -10, 25); ctx.closePath(); ctx.fillStyle = '#5A2A2E'; ctx.fill();
    const tl = 10 + Math.sin(t * 8) * 1.5;
    ctx.beginPath(); ctx.moveTo(-5.5, 27); ctx.quadraticCurveTo(-7, 27 + tl, 0, 28 + tl); ctx.quadraticCurveTo(7, 27 + tl, 5.5, 27); ctx.closePath(); ctx.fillStyle = C.tongue; ctx.fill();
    ctx.strokeStyle = 'rgba(160,60,75,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 29); ctx.lineTo(0, 25 + tl); ctx.stroke();
  } else { ctx.strokeStyle = C.nose; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, 26.5); ctx.quadraticCurveTo(0, 28.5, 6, 26.5); ctx.stroke(); }
  // red collar and the swinging AVA tag
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(-23, 28); ctx.quadraticCurveTo(0, 42, 23, 28); ctx.lineTo(23, 34); ctx.quadraticCurveTo(0, 48, -23, 34); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.tagD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 43, 2.8, 0, TAU); ctx.stroke();
  ctx.save(); ctx.translate(0, 45); ctx.rotate(Math.sin(t * 2.5) * 0.12);
  ell(ctx, 0, 9, 9, 9, 0, C.tagD); ell(ctx, 0, 9, 8, 8, 0, C.tag);
  PG.txt('AVA', 0, 9.5, 6, '#5C6577', { font: PG.FD });
  ctx.restore();
  ctx.restore();
}

function draw(ctx, x, y, size, o = {}) {
  if ((o.pose || 'stand') === 'sleep') drawSleep(ctx, x, y, size, o);
  else drawSide(ctx, x, y, size, o);
}
// a small bone, the universal Ava treat
function bone(ctx, x, y, s, ang = 0, col = '#F4EADB') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s / 20, s / 20);
  ctx.fillStyle = col;
  ctx.fillRect(-7, -2.6, 14, 5.2);
  for (const [bx, by] of [[-8, -3], [-8, 3], [8, -3], [8, 3]]) { ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
PG.ava = { draw, face, bone, C };
})();

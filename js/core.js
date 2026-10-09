// PolyGame core: engine, the puzzle (Block Blast × Sudoku × Two Dots), the arcade host and the "ad" host.
// Arcade games (js/games/*.js) and ad mini-games (js/minis/*.js) register through window.PG — see docs/MODULES.md.
// Level path, map and library live in js/levels.js. BUILD comes from the inline script in index.html.
(function () {
'use strict';

/* ================= setup ================= */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);

// Palette mirrors the CSS tokens.
const PAL = ['#F2615E', '#F5B12E', '#22B59B', '#7765EE']; // coral, amber, teal, violet
const FIELD = '#E7ECF3', INK = '#27303F', SOFT = '#7A8599', DIM = '#D3DAE4', BOXA = '#F0F3F8', CARD = '#FFFFFF', SPIKE = '#68708A';
const GOOD = '#22B59B', BAD = '#E5484D';
const FD = '"Unbounded","Arial Rounded MT Bold","Trebuchet MS",sans-serif';
const FB = '"Nunito","Arial Rounded MT Bold","Segoe UI",sans-serif';
const MAX_E = 9;
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

let now = performance.now() / 1000;

/* ================= utils ================= */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = n => Math.floor(Math.random() * n);
const pick = a => a[randi(a.length)];
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randi(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let best = Number(store.get('polygame.best', 0)) || 0;
let muted = !!store.get('polygame.muted', false);
let haptics = store.get('polygame.haptics', true) !== false;

/* ================= audio ================= */
let AC = null, MASTER = null;
function audioInit() {
  try {
    if (!AC) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) {
        AC = new A();
        // everything goes through a gentle low-pass so nothing sounds harsh on phone speakers
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.3;
        MASTER = AC.createGain(); MASTER.gain.value = 0.85;
        MASTER.connect(lp); lp.connect(AC.destination);
      }
    }
    if (AC && AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
function tone(f, d = 0.12, type = 'sine', v = 0.12, delay = 0, slide = 0) {
  if (!AC || muted) return;
  try {
    const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(MASTER || AC.destination); o.start(t); o.stop(t + d + 0.03);
  } catch (e) {}
}
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
const semi = (base, s) => base * Math.pow(2, s / 12);
const sfx = {
  pick() { tone(420, .06, 'triangle', .08); },
  place() { tone(260, .08, 'triangle', .14); tone(390, .07, 'sine', .06, .02); },
  bad() { tone(196, .14, 'triangle', .06, 0, .8); },
  back() { tone(330, .09, 'sine', .05, 0, .7); },
  clear(k) { [0, 4, 7, 12].forEach((s, i) => tone(semi(523.25, s + (k - 1) * 2), .22, 'triangle', .1, i * .05)); },
  chain(i) { tone(NOTES[clamp(i, 0, NOTES.length - 1)], .14, 'sine', .12); },
  note(i) { tone(NOTES[clamp(i, 0, NOTES.length - 1)], .14, 'sine', .11); },
  pop() { tone(700, .12, 'triangle', .1, 0, .5); },
  loop() { [0, 4, 7, 11, 14].forEach((s, i) => tone(semi(392, s), .3, 'sine', .1, i * .06)); },
  flap() { tone(520, .07, 'sine', .07, 0, 1.6); },
  wall() { tone(660, .07, 'sine', .07); },
  candy() { tone(1046.5, .1, 'sine', .1); tone(1567.98, .12, 'sine', .08, .06); },
  coin() { tone(987.77, .08, 'square', .04); tone(1318.51, .14, 'square', .04, .06); },
  hit() { tone(180, .1, 'triangle', .12, 0, .6); },
  whoosh() { tone(300, .12, 'sine', .05, 0, 2.2); },
  tick() { tone(1200, .03, 'sine', .05); },
  die() { tone(330, .45, 'triangle', .1, 0, .35); },
  stack(i) { tone(NOTES[clamp(i, 0, NOTES.length - 1)] / 2, .16, 'triangle', .12); },
  cut() { tone(300, .1, 'triangle', .1, 0, .7); },
  rush() { [0, 3, 7, 10, 12].forEach((s, i) => tone(semi(330, s), .2, 'triangle', .08, i * .07)); },
  win() { [0, 4, 7, 12, 16].forEach((s, i) => tone(semi(523.25, s), .26, 'triangle', .1, i * .08)); },
  over() { [7, 4, 0, -5].forEach((s, i) => tone(semi(392, s), .3, 'triangle', .1, i * .14)); }
};
// Soft haptics: short pulses on Android (navigator.vibrate); on iOS 18+ Safari the native
// switch control gives a light system tap, which is the only haptic the web can reach there.
const HAS_VIBRATE = typeof navigator.vibrate === 'function';
const HAP = { tick: 5, light: 9, soft: 13, double: [8, 45, 10], success: [9, 40, 9, 40, 14], thud: [16, 60, 10] };
let lastHap = 0;
function iosTap() {
  try {
    const l = document.createElement('label'), i = document.createElement('input');
    l.setAttribute('aria-hidden', 'true'); l.style.display = 'none';
    i.type = 'checkbox'; i.setAttribute('switch', '');
    l.appendChild(i); document.head.appendChild(l); l.click(); l.remove();
  } catch (e) {}
}
function buzz(pattern) {
  if (!haptics) return;
  const t = performance.now();
  if (typeof pattern === 'number' && t - lastHap < 40) return; // keep fast chains from turning into a drone
  lastHap = t;
  if (HAS_VIBRATE) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(pattern); } catch (e) {}
    return;
  }
  iosTap();
  if (Array.isArray(pattern)) {
    let at = 0;
    for (let i = 1; i + 1 < pattern.length; i += 2) { at += pattern[i - 1] + pattern[i]; setTimeout(iosTap, at); }
  }
}

/* ================= telemetry ================= */
// Detailed play log for tuning the game, sent to our collector. Events queue in localStorage
// while offline, go out in batches, and the rest is handed to sendBeacon when the app hides.
const LOG_URL = 'https://polygame-logs.91.99.8.73.sslip.io/e';
const LOG_ON = (() => { try { return window.top === window.self && !/[?&]nolog\b/.test(location.search); } catch (e) { return false; } })();
const LOG = (() => {
  const rid = () => {
    try { return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join(''); }
    catch (e) { return Math.random().toString(16).slice(2, 18); }
  };
  let did = store.get('polygame.did', null);
  if (!did) { did = rid(); store.set('polygame.did', did); }
  const sid = rid(), t0 = Date.now();
  let seq = 0, sending = false, backoff = 0, nextTry = 0;
  let q = store.get('polygame.logq', []);
  if (!Array.isArray(q)) q = [];
  const save = () => store.set('polygame.logq', q);
  const body = batch => JSON.stringify({ v: 1, build: BUILD, did, events: batch });
  // remove exactly what was sent: a fetch and a beacon can overlap, so never splice by count
  const drop = batch => { const sent = new Set(batch); q = q.filter(e => !sent.has(e)); save(); };
  function ev(type, data) {
    if (!LOG_ON) return;
    q.push(Object.assign({}, data, { e: type, t: Date.now(), s: sid, i: ++seq })); // envelope keys always win
    if (q.length > 2000) q.splice(0, q.length - 2000);
    save();
    if (q.length >= 30) flush();
  }
  async function flush() {
    if (!LOG_ON || !LOG_URL || sending || !q.length || Date.now() < nextTry || navigator.onLine === false) return;
    sending = true;
    const batch = q.slice(0, 150);
    try {
      const res = await fetch(LOG_URL, { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: body(batch) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      drop(batch); backoff = 0; nextTry = 0;
    } catch (e) {
      backoff = Math.min(300000, (backoff || 4000) * 2); nextTry = Date.now() + backoff;
    }
    sending = false;
  }
  function beacon() {
    if (!LOG_ON || !LOG_URL || !q.length || !navigator.sendBeacon) return;
    const batch = q.slice(0, 150);
    try { if (navigator.sendBeacon(LOG_URL, new Blob([body(batch)], { type: 'text/plain' }))) drop(batch); } catch (e) {}
  }
  setInterval(flush, 15000);
  return { ev, flush, beacon, t0 };
})();
const perf = { frames: 0, time: 0, long: 0 };
let errCount = 0, lastDragMs = 0;
function logErr(m, src, l, c, st) {
  if (++errCount > 20) return; // a broken frame loop must not flood the log
  LOG.ev('err', { m: String(m).slice(0, 300), src: String(src || '').slice(-60), l, c, st: String(st || '').slice(0, 900), state: G.state, mod: AR.def ? AR.def.id : AD.def ? AD.def.id : '' });
}
window.addEventListener('error', e => logErr(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack));
window.addEventListener('unhandledrejection', e => logErr('unhandled: ' + (e.reason && e.reason.message || e.reason), '', 0, 0, e.reason && e.reason.stack));

/* ================= pieces (Block Blast) ================= */
function parseRows(rows) {
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') cells.push([r, c]); }));
  return { cells, h: rows.length, w: rows[0].length, key: rows.join('/') };
}
const SHAPES = [
  [['X'], .7],
  [['XX'], .7], [['X', 'X'], .7],
  [['XXX'], .7], [['X', 'X', 'X'], .7],
  [['XXXX'], .5], [['X', 'X', 'X', 'X'], .5],
  [['XXXXX'], .35], [['X', 'X', 'X', 'X', 'X'], .35],
  [['XX', 'XX'], 1.1],
  [['XXX', 'XXX', 'XXX'], .25],
  [['XXX', 'XXX'], .3], [['XX', 'XX', 'XX'], .3],
  [['XX', 'X.'], .35], [['XX', '.X'], .35], [['X.', 'XX'], .35], [['.X', 'XX'], .35],
  [['X..', 'XXX'], .18], [['..X', 'XXX'], .18], [['XXX', 'X..'], .18], [['XXX', '..X'], .18],
  [['XX', 'X.', 'X.'], .18], [['XX', '.X', '.X'], .18], [['X.', 'X.', 'XX'], .18], [['.X', '.X', 'XX'], .18],
  [['XXX', 'X..', 'X..'], .18], [['XXX', '..X', '..X'], .18], [['X..', 'X..', 'XXX'], .18], [['..X', '..X', 'XXX'], .18],
  [['XXX', '.X.'], .2], [['.X.', 'XXX'], .2], [['X.', 'XX', 'X.'], .2], [['.X', 'XX', '.X'], .2],
  [['XX.', '.XX'], .17], [['.XX', 'XX.'], .17], [['X.', 'XX', '.X'], .17], [['.X', 'XX', 'X.'], .17]
].map(([rows, w]) => Object.assign(parseRows(rows), { wt: w }));
// Sudoku pieces carry distinct digits, so big shapes rarely fit: keep them to four cells.
const SUDOKU_SHAPES = SHAPES.filter(s => s.cells.length <= 4).map(s => Object.assign({}, s, { wt: s.cells.length === 1 ? 1.4 : s.cells.length === 2 ? 1.3 : s.wt }));
let pid = 0;
function pieceFrom(shape, color) { return { id: ++pid, cells: shape.cells, h: shape.h, w: shape.w, key: shape.key, color, born: now, dig: null }; }
function weighted(list) {
  let t = Math.random() * list.reduce((s, x) => s + x.wt, 0);
  for (const s of list) { t -= s.wt; if (t <= 0) return s; }
  return list[0];
}
function makePiece() {
  const p = pieceFrom(weighted(G.sudoku ? SUDOKU_SHAPES : SHAPES), randi(PAL.length));
  if (G.sudoku) assignDigits(p);
  return p;
}

/* ================= state ================= */
const G = {
  state: 'menu',      // menu | puzzle | arcade | ad | over | map | library | lvlend | paused
  mode: 'endless',    // endless | level | solo (an arcade or mini-game on its own)
  grid: [], born: [], dig: [], tray: [null, null, null],
  score: 0, shown: 0, energy: 3,
  rush: { meter: 0, need: 3, count: 0, next: null, order: [] },
  streak: 0, stats: { lines: 0, boxes: 0, loops: 0, rushes: 0, chains: 0, sudoku: 0 },
  placements: 0, chainsUsed: 0, busyUntil: 0, pendingRush: false, toast: null,
  arenaVis: 0, shake: 0, ePulse: -9, newBest: false, sudoku: false, lvl: null,
  boardVisible: true, lastAdAt: 0, adsShown: 0, gameNo: 0, gameT0: 0
};
const parts = [], pops = [], texts = [], timers = [];
let drag = null, chain = null, activeId = null;
function after(d, fn) { timers.push({ at: now + d, fn }); }
function toast(t, d = 2.5, kind) { G.toast = { text: t, until: now + d, t0: now, kind: kind || '' }; }
function gainEnergy(n) { const b = G.energy; G.energy = Math.min(MAX_E, G.energy + n); if (G.energy > b) G.ePulse = now; return G.energy - b; }

/* ================= layout ================= */
const L = { board: {}, tray: {}, arena: {}, hud: {}, home: {}, sound: {}, vibe: {}, hudY: 0, hudH: 100, trayCell: 20 };
let W = 1, H = 1, DPR = 1;
function resize() {
  const r = cv.getBoundingClientRect();
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  layout();
}
function layout() {
  const pad = 16;
  const gw = Math.min(W - pad * 2, 480);
  const hudH = clamp(H * 0.15, 92, 124);
  const avail = H - hudH - pad;
  let B = Math.min(gw, avail / 1.40);
  const cell = Math.max(8, Math.floor(B / 9)); B = cell * 9;
  const extra = Math.max(0, avail - B * 1.40);
  const off = Math.round(extra * 0.34);
  const bx = Math.round((W - B) / 2), by = Math.round(off + hudH);
  L.hudY = off; L.hudH = hudH;
  L.board = { x: bx, y: by, s: B, cell };
  // on tall phones the spare height goes to the tray, so pieces sit nearer the thumb
  const ty = by + B + Math.round(cell * 0.5), th = Math.round(B * 0.40 - cell * 0.5 + extra * 0.4);
  L.tray = { x: bx, y: ty, w: B, h: th };
  L.trayCell = Math.min(cell * 0.6, (B / 3) * 0.84 / 5, (B * 0.40 - cell * 0.5) * 0.88 / 5);
  L.arena = { x: bx - 8, y: by - 8, w: B + 16, h: ty + th - by + 16 };
  // the HUD gets at least 320px even when a short landscape screen shrinks the board
  const hw = Math.min(W - 32, Math.max(B, 320)), hx = Math.round((W - hw) / 2);
  L.hud = { x: hx, w: hw };
  const iy = off + Math.min(6, hudH / 2 - 46); // keep the icons clear of the energy pill on short HUDs
  L.home = { x: hx - 2, y: iy, w: 30, h: 30 };
  L.sound = { x: hx + 34, y: iy, w: 30, h: 30 };
  L.vibe = { x: hx + 70, y: iy, w: 30, h: 30 };
}

/* ================= board logic (Block Blast + Sudoku) ================= */
function emptyGrid(v) { return Array.from({ length: 9 }, () => Array(9).fill(v)); }
function fitsGeom(p, r0, c0) {
  if (r0 < 0 || c0 < 0 || r0 + p.h > 9 || c0 + p.w > 9) return false;
  for (const [dr, dc] of p.cells) if (G.grid[r0 + dr][c0 + dc] >= 0) return false;
  return true;
}
// Sudoku rule: a digit may appear once per row, column and 3×3 box. Returns the clashing board cells.
function digitClash(r, c, d) {
  const out = [];
  for (let k = 0; k < 9; k++) {
    if (k !== c && G.dig[r][k] === d) out.push([r, k]);
    if (k !== r && G.dig[k][c] === d) out.push([k, c]);
  }
  const br = r - r % 3, bc = c - c % 3;
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) {
    if ((rr !== r || cc !== c) && rr !== r && cc !== c && G.dig[rr][cc] === d) out.push([rr, cc]);
  }
  return out;
}
function clashesFor(p, r0, c0) {
  if (!G.sudoku || !p.dig) return [];
  const out = [];
  p.cells.forEach(([dr, dc], i) => { for (const q of digitClash(r0 + dr, c0 + dc, p.dig[i])) out.push(q); });
  return out;
}
function canPlace(p, r0, c0) { return fitsGeom(p, r0, c0) && (!G.sudoku || !clashesFor(p, r0, c0).length); }
function countFits(p, cap) {
  let n = 0;
  for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.w; c++) if (canPlace(p, r, c) && ++n >= cap) return n;
  return n;
}
const anyFit = p => countFits(p, 1) > 0;
// Digits that nearly-full rows, columns and boxes still need, weighted by how full the group is,
// counted only where the digit could legally go. Pieces lean toward these so sudoku goals stay reachable.
function neededDigits() {
  const w = Array(10).fill(0);
  const groups = [];
  for (let i = 0; i < 9; i++) {
    groups.push(Array.from({ length: 9 }, (_, k) => [i, k]), Array.from({ length: 9 }, (_, k) => [k, i]));
    const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3, box = [];
    for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) box.push([r, c]);
    groups.push(box);
  }
  for (const g of groups) {
    const filled = g.filter(([r, c]) => G.grid[r][c] >= 0).length;
    if (filled < 5 || filled === 9) continue;
    const empty = g.filter(([r, c]) => G.grid[r][c] < 0);
    for (let d = 1; d <= 9; d++) if (empty.some(([r, c]) => !digitClash(r, c, d).length)) w[d] += filled * filled;
  }
  return w;
}
// Pick distinct digits for a sudoku piece so it has somewhere legal to go, leaning toward needed digits.
function assignDigits(p) {
  const need = neededDigits();
  const draw = () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9], out = [];
    while (out.length < p.cells.length) {
      const ws = pool.map(d => 1 + need[d]), sum = ws.reduce((a, b) => a + b, 0);
      let t = Math.random() * sum, k = 0;
      while (t > ws[k] && k < pool.length - 1) { t -= ws[k]; k++; }
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  };
  let bestD = null, bestN = -1;
  for (let t = 0; t < 40; t++) {
    p.dig = t < 30 ? draw() : shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, p.cells.length);
    const n = countFits(p, 4);
    if (n > bestN) { bestN = n; bestD = p.dig; if (n >= 2) break; }
  }
  p.dig = bestD;
}
// Full rows, columns and 3×3 boxes.
function findClears(g) {
  const groups = [];
  const tag = (cells, t) => { cells.t = t; return cells; };
  for (let r = 0; r < 9; r++) if (g[r].every(v => v >= 0)) groups.push(tag(g[r].map((_, c) => [r, c]), 'r'));
  for (let c = 0; c < 9; c++) {
    let full = true; for (let r = 0; r < 9; r++) if (g[r][c] < 0) { full = false; break; }
    if (full) groups.push(tag(Array.from({ length: 9 }, (_, r) => [r, c]), 'c'));
  }
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3, cells = [];
    let full = true;
    for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) { if (g[r][c] < 0) full = false; cells.push([r, c]); }
    if (full) groups.push(tag(cells, 'b'));
  }
  return groups;
}
function previewClears(p, r0, c0) {
  const g = G.grid.map(row => row.slice());
  for (const [dr, dc] of p.cells) g[r0 + dr][c0 + dc] = p.color;
  const groups = findClears(g);
  if (!groups.length) return null;
  const s = new Set();
  for (const gr of groups) for (const [r, c] of gr) s.add(r * 9 + c);
  return s;
}
function boardFill() { let n = 0; for (const row of G.grid) for (const v of row) if (v >= 0) n++; return n / 81; }
function hasPair() {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const v = G.grid[r][c]; if (v < 0) continue;
    if (c < 8 && G.grid[r][c + 1] === v) return true;
    if (r < 8 && G.grid[r + 1][c] === v) return true;
  }
  return false;
}
function cellCenter(r, c) { const b = L.board; return [b.x + (c + 0.5) * b.cell, b.y + (r + 0.5) * b.cell]; }
function boardCellAt(x, y) {
  const b = L.board, c = Math.floor((x - b.x) / b.cell), r = Math.floor((y - b.y) / b.cell);
  return (r < 0 || r > 8 || c < 0 || c > 8) ? null : [r, c];
}
function traySlotAt(x, y) {
  const t = L.tray;
  if (y < t.y - 8 || y > t.y + t.h + 40 || x < t.x - 16 || x > t.x + t.w + 16) return -1;
  return clamp(Math.floor((x - t.x) / (t.w / 3)), 0, 2);
}
// A full valid sudoku grid: the classic shifted pattern with digits, rows, columns, bands and stacks shuffled.
function sudokuSolution() {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = [], cols = [];
  for (const b of shuffle([0, 1, 2])) for (const r of shuffle([0, 1, 2])) rows.push(b * 3 + r);
  for (const s of shuffle([0, 1, 2])) for (const c of shuffle([0, 1, 2])) cols.push(s * 3 + c);
  return rows.map(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
}

/* ================= boards ================= */
function resetBoard() {
  G.grid = emptyGrid(-1); G.born = emptyGrid(-9); G.dig = emptyGrid(0);
  timers.length = 0; parts.length = 0; pops.length = 0; texts.length = 0;
  drag = null; chain = null; activeId = null;
}
function put(r, c, color, d) { G.grid[r][c] = color; G.dig[r][c] = d || 0; }
// Seeds give each level a readable starting position. Returns nothing; writes G.grid / G.dig.
const SEEDS = {
  endless() {
    for (let c = 0; c < 6; c++) put(8, c, randi(4));   // bottom row 6/9: first piece can clear it
    put(7, 0, randi(4)); put(7, 1, randi(4));
    const lc = randi(4);                                // a ready-made 2×2 loop
    put(1, 6, lc); put(1, 7, lc); put(2, 6, lc); put(2, 7, lc);
    const pc = (lc + 1) % 4; put(4, 2, pc); put(4, 3, pc); // a pair to chain
    put(5, 7, randi(4));
  },
  rows() { for (let c = 0; c < 6; c++) put(8, c, randi(4)); for (let c = 3; c < 9; c++) put(7, c, randi(4)); put(4, 4, randi(4)); },
  boxes() {
    for (const [r, c] of [[6, 0], [6, 1], [7, 0], [7, 1], [8, 0], [8, 1]]) put(r, c, randi(4));
    for (const [r, c] of [[6, 7], [6, 8], [7, 7], [7, 8], [8, 7], [8, 8]]) put(r, c, randi(4));
    put(2, 4, randi(4));
  },
  pairs() {
    const spots = [[1, 1], [1, 2], [3, 6], [4, 6], [6, 2], [6, 3], [7, 3], [2, 7], [5, 0], [8, 5], [8, 6]];
    spots.forEach(([r, c], i) => put(r, c, i < 7 ? 0 : 1 + randi(3)));
  },
  square() {
    const c = randi(4); put(3, 3, c); put(3, 4, c); put(4, 3, c); put(4, 4, c);
    put(4, 5, c); put(0, 0, c); put(8, 8, c);
    for (let i = 0; i < 6; i++) { const r = randi(9), k = randi(9); if (G.grid[r][k] < 0) put(r, k, (c + 1 + randi(3)) % 4); }
  },
  random(n = 14) { for (let i = 0; i < n; i++) { const r = randi(9), c = randi(9); if (G.grid[r][c] < 0) put(r, c, randi(4)); } },
  dense() { SEEDS.random(26); },
  sudokuEasy() { sudokuGivens(18, 4); },
  sudoku() { sudokuGivens(20, -1); },
  sudokuHard() { sudokuGivens(28, -1); }
};
// Givens come from one solved grid, so the starting position never breaks the rule.
// focusBox: a box that starts six-ninths full, so the first sudoku box is within reach.
function sudokuGivens(n, focusBox) {
  const S = sudokuSolution();
  if (focusBox >= 0) {
    const br = Math.floor(focusBox / 3) * 3, bc = (focusBox % 3) * 3;
    const cells = []; for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) cells.push([r, c]);
    shuffle(cells).slice(0, 6).forEach(([r, c]) => put(r, c, randi(4), S[r][c]));
  }
  let guard = 0;
  while (guard++ < 400 && n > 0) {
    const r = randi(9), c = randi(9);
    if (G.grid[r][c] >= 0) continue;
    put(r, c, randi(4), S[r][c]);
    if (findClears(G.grid).length) { G.grid[r][c] = -1; G.dig[r][c] = 0; continue; }
    n--;
  }
}
function refillTray() {
  let set = null;
  for (let i = 0; i < 30; i++) { set = [makePiece(), makePiece(), makePiece()]; if (set.some(anyFit)) break; }
  set.forEach((p, i) => { p.born = now + i * 0.07; });
  G.tray = set;
}
function newPuzzle(opts) {
  resetBoard();
  Object.assign(G, {
    score: 0, shown: 0, energy: opts.energy == null ? 3 : opts.energy, rush: { meter: 0, need: 3, count: 0, next: null, order: [] }, streak: 0,
    stats: { lines: 0, boxes: 0, loops: 0, rushes: 0, chains: 0, sudoku: 0 }, placements: 0, chainsUsed: 0,
    busyUntil: 0, pendingRush: false, toast: null, arenaVis: 0, newBest: false,
    mode: opts.mode, sudoku: !!opts.sudoku, lvl: opts.lvl || null, boardVisible: true, state: 'puzzle'
  });
  (SEEDS[opts.seed] || SEEDS.random)();
  if (opts.mode === 'endless') {
    G.tray = [pieceFrom(parseRows(['XXX']), randi(4)), pieceFrom(parseRows(['XX', 'XX']), randi(4)), makePiece()];
    pickNextRush();
  } else if (opts.tray) {
    // tutorial levels hand out pieces that fit the seeded board, so the goal reads from the first move
    G.tray = opts.tray.map(rows => { const p = pieceFrom(parseRows(rows), randi(4)); if (G.sudoku) assignDigits(p); return p; });
  } else refillTray();
  G.gameNo = (Number(store.get('polygame.games', 0)) || 0) + 1; G.gameT0 = Date.now();
  store.set('polygame.games', G.gameNo);
  G.tray.forEach((p, i) => { p.born = now + 0.1 + i * 0.07; });
}

/* ================= effects ================= */
// Pop-up text over the board (clamped to it) or anywhere (floatText).
function addText(x, y, text, color, size = 26, dur = 1.1, delay = 0) {
  const b = L.board;
  texts.push({ x: clamp(x, b.x + b.s * 0.22, b.x + b.s * 0.78), y, text, color, size, t0: now + delay, dur });
}
function floatText(x, y, text, color = INK, size = 22, dur = 0.9, delay = 0) { texts.push({ x, y, text, color, size, t0: now + delay, dur }); }
function burst(x, y, color, n = 8, spd = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3, t: 0, max: 0.45 + Math.random() * 0.35, color, size: 2 + Math.random() * 3.5 });
  }
  if (parts.length > 700) parts.splice(0, parts.length - 700);
}
function confetti(n = 60) {
  for (let i = 0; i < n; i++) parts.push({ x: rand(0, W), y: rand(-40, H * 0.3), vx: rand(-60, 60), vy: rand(-80, 120), t: 0, max: rand(1.2, 2.2), color: pick(PAL), size: rand(2.5, 5) });
}
function shake(a) { if (!REDUCED) G.shake = Math.max(G.shake, a); }

/* ================= puzzle actions ================= */
function placePiece(slot, r0, c0) {
  const p = G.tray[slot];
  if (!p || !canPlace(p, r0, c0)) return;
  G.tray[slot] = null;
  const fillBefore = boardFill();
  p.cells.forEach(([dr, dc], i) => { G.grid[r0 + dr][c0 + dc] = p.color; G.dig[r0 + dr][c0 + dc] = p.dig ? p.dig[i] : 0; G.born[r0 + dr][c0 + dc] = now; });
  G.score += p.cells.length; G.placements++;
  sfx.place(); buzz(HAP.light);
  const groups = findClears(G.grid);
  LOG.ev('place', { g: G.gameNo, p: p.key, c: p.color, r: r0, col: c0, slot, ms: lastDragMs, fill: Math.round(fillBefore * 100) / 100, k: groups.length, sud: G.sudoku ? 1 : 0, lv: G.lvl ? G.lvl.n : 0 });
  if (groups.length) resolveClears(groups); else G.streak = 0;
  if (G.lvl) G.lvl.movesLeft--;
  if (G.tray.every(t => !t)) refillTray();
  if (G.mode === 'level') { if (levelCheck(true)) return; }
  if (G.mode === 'endless' && G.rush.meter >= G.rush.need && !G.pendingRush && ARC.size()) {
    G.pendingRush = true; G.busyUntil = now + 1.0;
    const b = L.board;
    addText(b.x + b.s / 2, b.y + b.s / 2, 'АРКАДА!', PAL[3], 34, 1.0, 0.25);
    sfx.rush();
    after(0.95, startRush);
    return;
  }
  checkStuck();
}

function resolveClears(groups) {
  const cells = new Map();
  let mono = 0, monoColor = 0;
  for (const g of groups) {
    const c0 = G.grid[g[0][0]][g[0][1]]; let same = true;
    for (const [r, c] of g) { cells.set(r * 9 + c, G.grid[r][c]); if (G.grid[r][c] !== c0) same = false; }
    if (same) { mono++; monoColor = c0; }
  }
  const k = groups.length, n = cells.size, streak = G.streak + 1;
  const sudokuBonus = G.sudoku ? 2 : 1; // every sudoku clear is a solved row, column or box
  const pts = ((n * 2 + 18 * k * k) * Math.min(streak, 6) + mono * 90) * sudokuBonus;
  G.score += pts; G.streak = streak;
  gainEnergy(1 + mono);
  const nl = groups.filter(g => g.t !== 'b').length, nb = groups.filter(g => g.t === 'b').length;
  G.rush.meter += k; G.stats.lines += nl; G.stats.boxes += nb;
  if (G.sudoku) G.stats.sudoku += k;
  const byColor = [0, 0, 0, 0];
  let i = 0, sx = 0, sy = 0;
  for (const [key, color] of cells) {
    const r = (key / 9) | 0, c = key % 9;
    pops.push({ r, c, color, d: G.dig[r][c], t0: now + Math.min(i, 40) * 0.012 });
    G.grid[r][c] = -1; G.dig[r][c] = 0;
    byColor[color]++;
    const [x, y] = cellCenter(r, c); sx += x; sy += y; i++;
  }
  sx /= n; sy /= n;
  addText(sx, sy, '+' + pts, INK, 28);
  let line = 1;
  if (G.sudoku) addText(sx, sy - 38 * line++, k > 1 ? `СУДОКУ ×${k}!` : 'СУДОКУ!', PAL[2], 26, 1.2, 0.05);
  else if (k > 1) addText(sx, sy - 38 * line++, k === 2 ? 'ДУБЛЬ!' : k === 3 ? 'ТРИПЛ!' : 'МЕГА!', PAL[3], 26, 1.2, 0.05);
  if (streak > 1) addText(sx, sy - 38 * line++, 'КОМБО ×' + Math.min(streak, 6), PAL[1], 24, 1.2, 0.1);
  if (mono) addText(sx, sy - 38 * line++, 'МОНО! +⚡', PAL[monoColor], 24, 1.3, 0.15);
  sfx.clear(k); buzz(k > 1 || mono || streak > 1 ? HAP.success : HAP.double);
  if (G.lvl) { goalAdd('lines', nl); goalAdd('boxes', nb); byColor.forEach((v, c) => v && goalAdd('color', v, c)); goalAdd('sudoku', G.sudoku ? k : 0); }
  LOG.ev('clear', {
    g: G.gameNo, k, n, mono, streak, pts, en: G.energy, m: G.rush.meter, sud: G.sudoku ? 1 : 0,
    rows: groups.filter(g => g.t === 'r').length, cols: groups.filter(g => g.t === 'c').length, boxes: nb
  });
  shake(Math.min(12, 3 + k * 3));
}

function checkStuck() {
  if (G.state !== 'puzzle' || G.pendingRush || (G.lvl && G.lvl.done)) return;
  const ps = G.tray.filter(Boolean);
  if (!ps.length) return;
  if (ps.some(anyFit)) { if (G.toast && G.toast.stuck) G.toast = null; return; }
  if (G.energy > 0 && hasPair()) {
    if (!(G.toast && G.toast.stuck && now < G.toast.until)) LOG.ev('stuck', { g: G.gameNo, en: G.energy, fill: Math.round(boardFill() * 100) / 100 });
    toast(G.sudoku ? 'Фігури не влазять за правилом судоку — лопни точки за ⚡' : 'Фігури не влазять — лопни точки за ⚡', 5); G.toast.stuck = true; return;
  }
  G.busyUntil = now + 99;
  toast('Ходів більше немає', 3);
  sfx.over(); buzz(HAP.thud);
  if (G.mode === 'level') after(1.0, () => levelFail('stuck'));
  else after(1.1, gameOver);
}
function gameOver() {
  G.state = 'over';
  G.newBest = G.score > best;
  if (G.newBest) { best = G.score; store.set('polygame.best', best); }
  $('ovScore').textContent = G.score;
  $('ovBest').textContent = best;
  $('ovNew').hidden = !G.newBest;
  $('ovStats').textContent = `Ліній: ${G.stats.lines} · Квадратів: ${G.stats.boxes} · Петель: ${G.stats.loops} · Аркад: ${G.stats.rushes}`;
  showOverlay('over');
  LOG.ev('game_over', {
    g: G.gameNo, score: G.score, sec: Math.round((Date.now() - G.gameT0) / 1000), places: G.placements,
    lines: G.stats.lines, boxes: G.stats.boxes, loops: G.stats.loops, chains: G.stats.chains, rushes: G.stats.rushes,
    energy: G.energy, fill: Math.round(boardFill() * 100) / 100, best, newBest: G.newBest
  });
  LOG.flush();
}

/* ================= level goals ================= */
// The level definition and flow live in js/levels.js; the puzzle reports progress here.
function goalAdd(type, n, color) {
  if (!G.lvl || !n) return;
  for (const g of G.lvl.goals) {
    if (g.t !== type || (type === 'color' && g.c !== color)) continue;
    const before = g.have;
    g.have = Math.min(g.n, g.have + n);
    if (g.have >= g.n && before < g.n) { g.doneAt = now; sfx.coin(); }
    else if (g.have > before) g.pulse = now;
  }
}
function goalsMet() {
  if (!G.lvl) return false;
  return G.lvl.goals.every(g => (g.t === 'score' ? G.score >= g.n : g.have >= g.n));
}
// Returns true when the level ended (won or out of moves).
function levelCheck(afterMove) {
  const lv = G.lvl;
  if (!lv || lv.done) return true;
  for (const g of lv.goals) if (g.t === 'score') { const was = g.have; g.have = Math.min(g.n, G.score); if (g.have >= g.n && was < g.n) sfx.coin(); }
  if (goalsMet()) { lv.done = true; G.busyUntil = now + 99; after(0.5, () => PG.hooks.levelWon && PG.hooks.levelWon()); return true; }
  if (afterMove && lv.movesLeft <= 0) {
    lv.done = true; G.busyUntil = now + 99;
    toast('Ходи скінчились', 2.5);
    after(0.9, () => levelFail('moves'));
    return true;
  }
  return false;
}
function levelFail(reason) { if (PG.hooks.levelFailed) PG.hooks.levelFailed(reason); }

/* ================= drag (Block Blast) ================= */
function updateDrag(x, y) {
  drag.x = x; drag.y = y;
  const c = L.board.cell, p = drag.piece;
  drag.lift = drag.touch ? p.h * c / 2 + c * 1.1 : 0; // keep the whole piece clear of the thumb
  if (!drag.moved) { drag.snap = null; drag.clears = null; drag.bad = null; return; } // no ghost until the finger actually drags
  const px = x - p.w * c / 2, py = y - drag.lift - p.h * c / 2;
  const col = Math.round((px - L.board.x) / c), row = Math.round((py - L.board.y) / c);
  if (fitsGeom(p, row, col)) {
    const clash = clashesFor(p, row, col);
    if (clash.length) {
      if (!drag.bad || drag.bad.r !== row || drag.bad.c !== col) { drag.bad = { r: row, c: col, clash }; buzz(HAP.tick); }
      drag.snap = null; drag.clears = null;
      return;
    }
    drag.bad = null;
    if (!drag.snap || drag.snap.r !== row || drag.snap.c !== col) {
      const had = !!drag.clears;
      drag.snap = { r: row, c: col }; drag.clears = previewClears(p, row, col);
      if (drag.clears && !had) buzz(HAP.tick);
    }
  } else { drag.snap = null; drag.clears = null; drag.bad = null; }
}

/* ================= chain (Two Dots) ================= */
function moveChain(x, y) {
  const step = L.board.cell * 0.25;
  const n = Math.max(1, Math.ceil(Math.hypot(x - chain.lx, y - chain.ly) / step));
  for (let i = 1; i <= n && chain; i++) chainVisit(lerp(chain.lx, x, i / n), lerp(chain.ly, y, i / n));
  chain.lx = x; chain.ly = y; chain.x = x; chain.y = y;
}
function chainVisit(x, y) {
  const cell = boardCellAt(x, y); if (!cell) return;
  const [r, c] = cell, [cx, cy] = cellCenter(r, c);
  if (Math.hypot(x - cx, y - cy) > L.board.cell * 0.42) return;
  const cells = chain.cells, last = cells[cells.length - 1];
  if (last[0] === r && last[1] === c) return;
  if (Math.abs(last[0] - r) + Math.abs(last[1] - c) !== 1) return;
  const prev = cells[cells.length - 2];
  if (prev && prev[0] === r && prev[1] === c) { cells.pop(); chain.loop = false; sfx.chain(cells.length - 1); return; }
  if (chain.loop) return;
  if (G.grid[r][c] !== chain.color) return;
  if (cells.some(q => q[0] === r && q[1] === c)) { cells.push([r, c]); chain.loop = true; sfx.chain(cells.length + 2); buzz(HAP.double); return; }
  cells.push([r, c]); sfx.chain(cells.length - 1); buzz(HAP.tick);
}
function endChain() {
  const ch = chain; chain = null;
  const seen = new Set(), uniq = [];
  for (const [r, c] of ch.cells) { const k = r * 9 + c; if (!seen.has(k)) { seen.add(k); uniq.push([r, c]); } }
  if (uniq.length < 2) return;
  if (G.energy < 1) { toast('Потрібна ⚡ — очищай лінії або грай в аркаду', 3); sfx.bad(); LOG.ev('chain_fail', { g: G.gameNo, n: uniq.length, why: 'energy' }); return; }
  G.energy--; G.chainsUsed++; G.stats.chains++;
  let targets = uniq;
  if (ch.loop) {
    targets = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (G.grid[r][c] === ch.color) targets.push([r, c]);
    G.stats.loops++; sfx.loop(); buzz(HAP.success);
    shake(7);
  } else { sfx.pop(); buzz(HAP.soft); }
  const pts = targets.length * (ch.loop ? 15 : 10);
  G.score += pts;
  let sx = 0, sy = 0;
  targets.forEach(([r, c], i) => {
    pops.push({ r, c, color: ch.color, d: G.dig[r][c], t0: now + i * 0.02 });
    G.grid[r][c] = -1; G.dig[r][c] = 0;
    const [x, y] = cellCenter(r, c); sx += x; sy += y;
  });
  sx /= targets.length; sy /= targets.length;
  addText(sx, sy, '+' + pts, INK, 26);
  if (ch.loop) addText(sx, sy - 38, 'ПЕТЛЯ!', PAL[ch.color], 30, 1.3, 0.08);
  if (G.lvl) { goalAdd('color', targets.length, ch.color); if (ch.loop) goalAdd('loops', 1); }
  LOG.ev('chain', { g: G.gameNo, n: uniq.length, loop: ch.loop, c: ch.color, popped: targets.length, pts, en: G.energy });
  if (G.mode === 'level' && levelCheck(false)) return;
  checkStuck();
}

/* ================= arcade host ================= */
// One arcade round at a time. The host owns intro, pause, progress, the result panel and per-game levels.
const ARC_DEFS = new Map();
const ARC = {
  size: () => ARC_DEFS.size,
  register(def) {
    if (!def || !def.id || typeof def.create !== 'function') { console.warn('arcade module rejected', def && def.id); return; }
    ARC_DEFS.set(def.id, def);
  },
  get: id => ARC_DEFS.get(id),
  list: () => [...ARC_DEFS.values()],
  level: id => Math.max(1, Number(store.get('polygame.arc.' + id, 1)) || 1),
  setLevel: (id, n) => store.set('polygame.arc.' + id, Math.max(1, n))
};
const AR = { def: null, inst: null };
function arcadeApi(def) {
  return { level: AR.level, fill: G.mode === 'endless' ? boardFill() : 0, accent: def.accent };
}
function startArcade(id, opts = {}) {
  const def = ARC_DEFS.get(id);
  if (!def) { console.warn('no arcade game', id); if (opts.onDone) opts.onDone({ won: false, missing: true }); return; }
  const level = opts.level || ARC.level(id);
  let goal = { count: 10, unit: 'очок' };
  try { goal = def.goal(level) || goal; } catch (e) { logErr(e.message, 'goal:' + id, 0, 0, e.stack); }
  Object.assign(AR, { def, level, goal, sub: 'intro', t0: now, endAt: 0, resultAt: 0, from: opts.from || 'rush', onDone: opts.onDone || null, won: false, eGain: 0, sGain: 0, inst: null, startAt: 0 });
  try { AR.inst = def.create(level, arcadeApi(def)); }
  catch (e) { logErr(e.message, 'create:' + id, 0, 0, e.stack); AR.inst = null; }
  if (!AR.inst) { AR.def = null; if (opts.onDone) opts.onDone({ won: false, broken: true }); return; }
  AR.inst.progress = AR.inst.progress || 0;
  G.state = 'arcade'; G.stats.rushes++;
  G.busyUntil = now + 0.45; // a tap aimed at the puzzle must not skip the intro
  drag = null; chain = null;
  buzz(HAP.double); sfx.rush();
  LOG.ev('arcade_start', { id, level, from: AR.from, goal: goal.count, fill: Math.round(boardFill() * 100) / 100 });
}
function arcCall(name, ...args) {
  const f = AR.inst && AR.inst[name];
  if (typeof f !== 'function') return;
  try { return f.apply(AR.inst, args); }
  catch (e) { logErr(e.message, AR.def.id + '.' + name, 0, 0, e.stack); AR.inst.over = AR.inst.over || { won: false, cause: 'error' }; }
}
function arcadeUpdate(dt) {
  const A = L.arena, inst = AR.inst;
  if (!inst) return;
  if (AR.sub === 'intro' || AR.sub === 'paused') { arcCall('idle', dt, A); return; }
  if (AR.sub === 'play' || AR.sub === 'ending') arcCall('update', dt, A);
  if (AR.sub === 'play') {
    if (inst.progress >= AR.goal.count && !inst.over) { inst.over = { won: true }; arcCall('win'); }
    if (inst.over) {
      AR.won = !!inst.over.won; AR.sub = 'ending'; AR.endAt = now + (AR.won ? 0.9 : 0.8);
      if (AR.won) { sfx.win(); buzz(HAP.success); confettiIn(A); PG.reward({ score: 100, energy: 1 }); }
      else { buzz(HAP.thud); }
    }
  } else if (AR.sub === 'ending' && now >= AR.endAt) {
    AR.sub = 'result'; AR.resultAt = now;
    if (AR.won) ARC.setLevel(AR.def.id, AR.level + 1);
    LOG.ev('arcade_end', {
      id: AR.def.id, level: AR.level, won: AR.won, from: AR.from, progress: inst.progress, goal: AR.goal.count,
      sec: Math.round((now - AR.startAt) * 10) / 10, en: AR.eGain, pts: AR.sGain, cause: inst.over && inst.over.cause || '', stats: inst.stats || null
    });
    LOG.flush();
  }
}
function confettiIn(A) {
  for (let i = 0; i < 50; i++) parts.push({ x: rand(A.x, A.x + A.w), y: rand(A.y, A.y + A.h * 0.3), vx: rand(-50, 50), vy: rand(-60, 100), t: 0, max: rand(1, 1.8), color: pick(PAL), size: rand(2.5, 5) });
}
function arcadeTap(x, y) {
  if (now < G.busyUntil || !AR.inst) return;
  if (AR.sub === 'intro') { AR.sub = 'play'; AR.startAt = now; arcCall('start'); arcCall('tap', x, y); return; }
  if (AR.sub === 'paused') { AR.sub = 'play'; sfx.pick(); return; }
  if (AR.sub === 'play') { arcCall('tap', x, y); return; }
  if (AR.sub === 'result' && now - AR.resultAt > 0.6) endArcade();
}
function endArcade() {
  const res = { won: AR.won, id: AR.def.id, level: AR.level };
  const done = AR.onDone, from = AR.from;
  AR.def = null; AR.inst = null;
  if (from === 'rush') {
    G.state = 'puzzle'; G.busyUntil = now + 0.35;
    pickNextRush();
    // the arcade round is a natural break: sometimes an "ad" mini-game follows
    if (!maybeAd('break', { energy: 2 }, () => after(0.3, checkStuck))) after(0.4, checkStuck);
  }
  if (done) done(res);
}
function pickNextRush() {
  const ids = ARC.list().map(d => d.id);
  if (!ids.length) { G.rush.next = null; return; }
  if (!G.rush.order || !G.rush.order.length) G.rush.order = shuffle(ids.slice());
  G.rush.next = G.rush.order.shift();
}
function startRush() {
  G.pendingRush = false;
  G.rush.meter = 0; G.rush.count++;
  G.rush.need = Math.min(3 + G.rush.count, 7);
  if (!G.rush.next) pickNextRush();
  startArcade(G.rush.next, { from: 'rush' });
}
function drawArcade() {
  const A = L.arena, d = AR.def;
  if (!d || !AR.inst) return;
  ctx.save();
  try { AR.inst.draw(ctx, A); } catch (e) { logErr(e.message, d.id + '.draw', 0, 0, e.stack); AR.inst.over = AR.inst.over || { won: false, cause: 'error' }; }
  ctx.restore();
  const cx = A.x + A.w / 2;
  if (AR.sub === 'play' || AR.sub === 'ending') {
    const p = clamp(AR.inst.progress / AR.goal.count, 0, 1), bw = A.w - 48, bx = A.x + 24, by = A.y + A.h - 14;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; rrect(bx, by, bw, 6, 3); ctx.fill();
    ctx.fillStyle = d.accent || PAL[3]; rrect(bx, by, Math.max(6, bw * p), 6, 3); ctx.fill();
  }
  if (AR.sub === 'intro' || AR.sub === 'paused') {
    const cw = Math.min(A.w - 28, 330), howto = AR.sub === 'paused' ? [] : (d.howto || []);
    const ch = AR.sub === 'paused' ? 120 : 150 + howto.length * 22;
    const cy0 = A.y + Math.max(14, A.h * 0.06);
    ctx.save();
    ctx.shadowColor = 'rgba(39,48,63,0.16)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.94)'; rrect(cx - cw / 2, cy0, cw, ch, 22); ctx.fill();
    ctx.restore();
    let y = cy0 + 26;
    if (AR.sub === 'paused') {
      txt('Пауза', cx, y + 12, 24, INK, { font: FD });
      txt('Тапни, щоб продовжити', cx, y + 52, 15, d.accent || PAL[3], { font: FB, weight: 900 });
      return;
    }
    const fam = (d.family || 'Аркада').toUpperCase();
    ctx.font = `900 11px ${FB}`; const fw = ctx.measureText(fam).width + 18;
    ctx.fillStyle = rgba(d.accent || PAL[3], 0.14); rrect(cx - fw / 2, y - 9, fw, 18, 9); ctx.fill();
    txt(fam, cx, y, 11, d.accent || PAL[3], { font: FB, weight: 900 });
    txt(d.title, cx, y + 32, Math.min(26, cw * 0.09), INK, { font: FD, max: cw - 24 });
    txt(`Рівень ${AR.level} · Ціль: ${AR.goal.count} ${AR.goal.unit}`, cx, y + 62, 14, SOFT, { font: FB, weight: 900, max: cw - 24 });
    howto.forEach((h, i) => txt(h, cx, y + 90 + i * 22, 14.5, INK, { font: FB, weight: 800, max: cw - 24 }));
    txt('ТАПНИ, ЩОБ ПОЧАТИ', cx, cy0 + ch - 20, 13, rgba(d.accent || PAL[3], 0.6 + 0.4 * Math.sin(now * 6)), { font: FD, max: cw - 24 });
  }
  if (AR.sub === 'result') {
    const g = AR.goal, prog = Math.min(AR.inst.progress, g.count);
    drawPanel(AR.won ? `Рівень ${AR.level} пройдено!` : 'Майже вийшло', d.accent || PAL[3], [
      [cap(g.unit), `${prog}/${g.count}`], ['Енергія', `+${AR.eGain} ⚡`], ['Очки', `+${AR.sGain}`],
      [AR.won ? 'Далі' : 'Спроба', AR.won ? `рівень ${AR.level + 1}` : `рівень ${AR.level}`]
    ], AR.resultAt, AR.from === 'rush' ? 'Тапни, щоб повернутись' : 'Тапни, щоб продовжити');
  }
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ================= "ad" host ================= */
// A parody of playable ads: a mini-game in an ad frame that can be closed after 15 s.
// Finishing it pays a reward; closing early pays nothing.
const AD_DEFS = new Map();
const ADS = {
  size: () => AD_DEFS.size,
  register(def) {
    if (!def || !def.id || typeof def.create !== 'function') { console.warn('mini-game rejected', def && def.id); return; }
    AD_DEFS.set(def.id, def);
  },
  get: id => AD_DEFS.get(id),
  list: () => [...AD_DEFS.values()]
};
const AD = { def: null, inst: null, order: [] };
const AD_CLOSE_AFTER = 15;
function adRects() {
  const fw = Math.min(W - 20, 460), fh = Math.min(H - 20, 820);
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  const head = 58, hook = 58, foot = 86;
  return {
    frame: { x: fx, y: fy, w: fw, h: fh },
    close: { x: fx + fw - 52, y: fy + 9, w: 42, h: 42 },
    area: { x: fx + 14, y: fy + head + hook, w: fw - 28, h: fh - head - hook - foot - 6 },
    btn: { x: fx + 22, y: fy + fh - foot + 16, w: fw - 44, h: 54 }
  };
}
function rewardLabel(rw) {
  if (rw && rw.label) return rw.label;
  const p = [];
  if (rw && rw.moves) p.push(`+${rw.moves} ходів`);
  if (rw && rw.energy) p.push(`+${rw.energy} ⚡`);
  return p.join(' і ') || 'бонус';
}
// Shows an ad mini-game. Returns false when none can be shown.
function showAd(id, opts = {}) {
  const list = ADS.list();
  if (!list.length) return false;
  let def = id ? AD_DEFS.get(id) : null;
  if (!def) {
    if (!AD.order.length) AD.order = shuffle(list.map(d => d.id));
    def = AD_DEFS.get(AD.order.shift());
  }
  if (!def) return false;
  Object.assign(AD, { def, reason: opts.reason || 'break', reward: opts.reward || null, onDone: opts.onDone || null, prev: G.state, t0: now, closeAt: now + (opts.closeAfter == null ? AD_CLOSE_AFTER : opts.closeAfter), done: null, tries: 1, inst: null, paid: false });
  if (!adCreate()) return false;
  G.state = 'ad'; drag = null; chain = null; activeId = null;
  G.lastAdAt = Date.now(); G.adsShown++;
  sfx.whoosh();
  LOG.ev('ad_show', { id: def.id, reason: AD.reason });
  return true;
}
function adCreate() {
  try { AD.inst = AD.def.create({ area: adRects().area }); }
  catch (e) { logErr(e.message, 'adcreate:' + AD.def.id, 0, 0, e.stack); AD.inst = null; }
  if (AD.inst) AD.inst.over = null;
  return !!AD.inst;
}
// Interstitial pacing: at most one every 2.5 minutes, only at calm moments.
function maybeAd(reason, reward, then) {
  if (!ADS.size() || Date.now() - G.lastAdAt < 150000) return false;
  if (G.mode === 'endless' && G.rush.count % 2 === 1) return false; // every second arcade round
  return showAd(null, { reason, reward, onDone: () => { if (then) then(); } });
}
function adCall(name, ...args) {
  const f = AD.inst && AD.inst[name];
  if (typeof f !== 'function') return;
  try { return f.apply(AD.inst, args); }
  catch (e) { logErr(e.message, AD.def.id + '.' + name, 0, 0, e.stack); AD.inst.over = AD.inst.over || { won: false }; }
}
function adUpdate(dt) {
  if (!AD.inst) return;
  if (!AD.done) {
    adCall('update', dt, adRects().area);
    if (AD.inst.over) {
      AD.done = { won: !!AD.inst.over.won, at: now };
      if (AD.done.won && !AD.paid) {
        AD.paid = true;
        if (AD.reward) applyReward(AD.reward);
        sfx.win(); buzz(HAP.success); confetti(40);
      } else if (!AD.done.won) { sfx.over(); buzz(HAP.thud); }
      LOG.ev('ad_done', { id: AD.def.id, won: AD.done.won, sec: Math.round((now - AD.t0) * 10) / 10, tries: AD.tries });
    }
  } else adCall('update', dt, adRects().area);
}
function applyReward(rw) {
  if (rw.energy) { gainEnergy(rw.energy); }
  if (rw.moves && G.lvl) { G.lvl.movesLeft += rw.moves; G.lvl.done = false; }
  if (rw.fn) rw.fn();
}
function closeAd() {
  const done = AD.onDone, won = !!(AD.done && AD.done.won);
  LOG.ev('ad_close', { id: AD.def.id, won, sec: Math.round((now - AD.t0) * 10) / 10, early: now < AD.closeAt });
  G.state = AD.prev === 'ad' ? 'puzzle' : AD.prev;
  AD.def = null; AD.inst = null;
  G.busyUntil = now + 0.3;
  if (done) done({ won });
}
function adPointer(type, x, y) {
  const R = adRects(), inR = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (type === 'down') {
    const canClose = now >= AD.closeAt || (AD.done && AD.done.won);
    if (canClose && inR({ x: R.close.x - 8, y: R.close.y - 8, w: R.close.w + 16, h: R.close.h + 16 })) { sfx.pick(); closeAd(); return; }
    if (AD.done && inR(R.btn)) {
      if (AD.done.won) { sfx.pick(); closeAd(); }
      else { AD.tries++; AD.done = null; adCreate(); sfx.pick(); }
      return;
    }
  }
  if (AD.done) return;
  const A = R.area;
  if (type === 'down' && !inR(A)) return;
  adCall(type, x, y, A);
}
function wrapText(s, maxW, font) {
  ctx.font = font;
  const words = String(s).split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function drawAd() {
  if (!AD.def) return;
  const R = adRects(), F = R.frame, A = R.area;
  ctx.fillStyle = 'rgba(25,30,40,0.55)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  ctx.fillStyle = CARD; rrect(F.x, F.y, F.w, F.h, 26); ctx.fill(); ctx.restore();
  // header: label and close
  ctx.fillStyle = PAL[1]; rrect(F.x + 16, F.y + 18, 86, 24, 12); ctx.fill();
  txt('РЕКЛАМА', F.x + 59, F.y + 30, 11, INK, { font: FB, weight: 900 });
  txt('міні-гра', F.x + 112, F.y + 30, 12, SOFT, { font: FB, weight: 800, align: 'left' });
  const cx = R.close.x + R.close.w / 2, cy = R.close.y + R.close.h / 2, left = AD.closeAt - now;
  if (left > 0 && !(AD.done && AD.done.won)) {
    ctx.strokeStyle = DIM; ctx.lineWidth = 3; circle(cx, cy, 15); ctx.stroke();
    ctx.strokeStyle = SOFT; ctx.beginPath(); ctx.arc(cx, cy, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / AD_CLOSE_AFTER)); ctx.stroke();
    txt(String(Math.ceil(left)), cx, cy + 1, 13, SOFT, { font: FD });
  } else {
    ctx.fillStyle = '#EEF1F6'; circle(cx, cy, 17); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6); ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6); ctx.stroke();
  }
  // headline
  const hookFont = `800 ${F.w < 360 ? 15 : 17}px ${FD}`;
  const lines = wrapText(AD.def.hook || AD.def.title, F.w - 40, hookFont).slice(0, 2);
  lines.forEach((l, i) => { ctx.font = hookFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(l, F.x + F.w / 2, F.y + 76 + i * 22 - (lines.length - 1) * 11); });
  // game
  ctx.save(); rrect(A.x, A.y, A.w, A.h, 18); ctx.clip();
  ctx.fillStyle = '#F4F6FA'; ctx.fillRect(A.x, A.y, A.w, A.h);
  try { AD.inst.draw(ctx, A); } catch (e) { logErr(e.message, AD.def.id + '.draw', 0, 0, e.stack); AD.inst.over = AD.inst.over || { won: false }; }
  ctx.restore();
  // footer
  const B = R.btn, bx = B.x + B.w / 2, by = B.y + B.h / 2;
  if (AD.done && AD.done.won) {
    ctx.fillStyle = GOOD; rrect(B.x, B.y, B.w, B.h, 27); ctx.fill();
    txt(`Ти в 1%! Забрати ${rewardLabel(AD.reward)}`, bx, by, 16, '#FFFFFF', { font: FD, max: B.w - 24 });
  } else if (AD.done) {
    ctx.fillStyle = PAL[0]; rrect(B.x, B.y, B.w, B.h, 27); ctx.fill();
    txt('Майже! Ще раз', bx, by, 16, '#FFFFFF', { font: FD, max: B.w - 24 });
  } else {
    ctx.strokeStyle = DIM; ctx.lineWidth = 2; rrect(B.x, B.y, B.w, B.h, 27); ctx.stroke();
    txt(AD.inst && AD.inst.hint ? AD.inst.hint : `Пройди гру й отримай ${rewardLabel(AD.reward)}`, bx, by, 14, SOFT, { font: FB, weight: 900, max: B.w - 24 });
  }
}

/* ================= rewards (used by arcade games and mini-games) ================= */
function reward(o = {}) {
  let got = 0;
  if (o.energy) got = gainEnergy(o.energy);
  if (o.score) G.score += o.score;
  if (G.state === 'arcade' && AR.def) { AR.eGain += got; AR.sGain += o.score || 0; }
  if (o.x != null && o.y != null) {
    if (got) floatText(o.x, o.y, `+${got} ⚡`, PAL[1], 20);
    else if (o.score && o.label !== false) floatText(o.x, o.y, `+${o.score}`, INK, 18);
  }
  return got;
}

/* ================= drawing helpers ================= */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
function rrect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(s, x, y, size, color, o = {}) {
  ctx.font = `${o.weight || 800} ${size}px ${o.font || FD}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  if (o.max) ctx.fillText(s, x, y, o.max); else ctx.fillText(s, x, y);
}
function dot(x, y, r, col) {
  ctx.fillStyle = col; circle(x, y, r); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; circle(x - r * 0.32, y - r * 0.34, r * 0.3); ctx.fill();
}
function digit(x, y, r, d) {
  if (!d) return;
  ctx.font = `800 ${Math.max(8, r * 1.15)}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(d), x, y + r * 0.06);
}
function bolt(x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x + 0.12 * s, y - 0.5 * s); ctx.lineTo(x - 0.28 * s, y + 0.06 * s); ctx.lineTo(x - 0.02 * s, y + 0.06 * s);
  ctx.lineTo(x - 0.12 * s, y + 0.5 * s); ctx.lineTo(x + 0.28 * s, y - 0.08 * s); ctx.lineTo(x + 0.02 * s, y - 0.08 * s);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function drawPiece(p, ox, oy, cs, alpha, tint) {
  ctx.globalAlpha = alpha;
  const col = tint || PAL[p.color], set = new Set(p.cells.map(([r, c]) => r * 10 + c));
  ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = cs * 0.34; ctx.lineCap = 'round';
  for (const [r, c] of p.cells) {
    const x = ox + (c + 0.5) * cs, y = oy + (r + 0.5) * cs;
    if (set.has(r * 10 + c + 1)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke(); }
    if (set.has((r + 1) * 10 + c)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cs); ctx.stroke(); }
  }
  p.cells.forEach(([r, c], i) => {
    const x = ox + (c + 0.5) * cs, y = oy + (r + 0.5) * cs;
    dot(x, y, cs * 0.36, col);
    if (p.dig) digit(x, y, cs * 0.36, p.dig[i]);
  });
  ctx.globalAlpha = 1;
}
function drawPanel(title, color, rows, at, footer) {
  const A = L.arena, k = easeOutBack(clamp((now - at) / 0.35, 0, 1));
  const w = Math.min(Math.max(A.w * 0.84, 220), A.w - 8, 300), h = 76 + rows.length * 34 + 52;
  ctx.save(); ctx.translate(A.x + A.w / 2, A.y + A.h / 2); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(39,48,63,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = CARD; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill();
  ctx.shadowColor = 'transparent';
  const sc = clamp(w / 260, 0.68, 1), pad = 22 * sc; // narrow arenas (short landscape) get smaller type
  txt(title, 0, -h / 2 + 36, 19 * sc, color, { font: FD, max: w - 32 });
  rows.forEach(([l, v], i) => {
    const y = -h / 2 + 80 + i * 34;
    txt(l, -w / 2 + pad, y, 15 * sc, SOFT, { font: FB, weight: 800, align: 'left' });
    txt(v, w / 2 - pad, y, 17 * sc, INK, { font: FD, align: 'right' });
  });
  if (now - at > 0.6) txt(footer || 'Тапни, щоб повернутись', 0, h / 2 - 26, 13 * sc, rgba(color, 0.65 + 0.35 * Math.sin(now * 6)), { font: FB, weight: 900, max: w - 24 });
  ctx.restore();
}
function drawVibe(x, y, on) {
  ctx.strokeStyle = SOFT; ctx.lineWidth = 2; ctx.lineCap = 'round';
  rrect(x - 4.5, y - 8, 9, 16, 2.5); ctx.stroke();
  if (on) {
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + sd * 8, y - 4); ctx.lineTo(x + sd * 10, y - 1.5); ctx.lineTo(x + sd * 8, y + 1); ctx.lineTo(x + sd * 10, y + 3.5); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(x - 9, y - 9); ctx.lineTo(x + 9, y + 9); ctx.stroke();
  }
}
function drawSpeaker(x, y, on) {
  ctx.fillStyle = SOFT; ctx.strokeStyle = SOFT; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 4); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 2, y - 9); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x - 9, y + 4);
  ctx.closePath(); ctx.fill();
  if (on) {
    ctx.beginPath(); ctx.arc(x + 3, y, 5, -0.8, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 3, y, 9, -0.8, 0.8); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x + 6, y - 4); ctx.lineTo(x + 12, y + 4); ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 6, y + 4); ctx.stroke();
  }
}
function drawHome(x, y) {
  ctx.strokeStyle = SOFT; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (const dy of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(x - 8, y + dy); ctx.lineTo(x + 8, y + dy); ctx.stroke(); }
}
// Small badge for an arcade game: its own icon if it draws one, otherwise its initial on its colour.
function drawGameIcon(def, x, y, r) {
  if (def && typeof def.icon === 'function') { try { ctx.save(); def.icon(ctx, x, y, r); ctx.restore(); return; } catch (e) { ctx.restore(); } }
  ctx.fillStyle = def ? def.accent || PAL[3] : DIM; circle(x, y, r * 0.8); ctx.fill();
  txt(def ? def.title[0] : '?', x, y + 1, r * 0.9, '#FFFFFF', { font: FD });
}

/* ================= scene drawing ================= */
function drawBoard() {
  const b = L.board, cs = b.cell;
  ctx.save();
  ctx.shadowColor = 'rgba(39,48,63,0.10)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  ctx.fillStyle = CARD; rrect(b.x - 8, b.y - 8, b.s + 16, b.s + 16, 20); ctx.fill();
  ctx.restore();
  if (chain && chain.loop) { ctx.strokeStyle = rgba(PAL[chain.color], 0.9); ctx.lineWidth = 4; rrect(b.x - 8, b.y - 8, b.s + 16, b.s + 16, 20); ctx.stroke(); }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    if ((br + bc) % 2 === 0) { ctx.fillStyle = G.sudoku ? '#EAF0F7' : BOXA; rrect(b.x + bc * 3 * cs + 1.5, b.y + br * 3 * cs + 1.5, 3 * cs - 3, 3 * cs - 3, 12); ctx.fill(); }
  }
  if (G.sudoku) { // sudoku boxes get a visible frame: they are a rule here, not decoration
    ctx.strokeStyle = 'rgba(122,133,153,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(b.x + i * 3 * cs, b.y + 4); ctx.lineTo(b.x + i * 3 * cs, b.y + b.s - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + i * 3 * cs); ctx.lineTo(b.x + b.s - 4, b.y + i * 3 * cs); ctx.stroke();
    }
  }
  const prev = drag && drag.snap ? drag.clears : null;
  const pcol = drag ? PAL[drag.piece.color] : null;
  const pulse = 0.5 + 0.5 * Math.sin(now * 10);
  const loopColor = chain && chain.loop ? chain.color : -1;
  const clashSet = drag && drag.bad ? new Set(drag.bad.clash.map(([r, c]) => r * 9 + c)) : null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const [x, y] = cellCenter(r, c), v = G.grid[r][c];
    if (v < 0) { ctx.fillStyle = DIM; circle(x, y, cs * 0.07); ctx.fill(); continue; }
    const age = now - G.born[r][c], k = age < 0.3 ? easeOutBack(clamp(age / 0.3, 0, 1)) : 1;
    const col = prev && prev.has(r * 9 + c) ? pcol : PAL[v];
    ctx.fillStyle = rgba(col, 0.14); rrect(x - cs * 0.44, y - cs * 0.44, cs * 0.88, cs * 0.88, cs * 0.24); ctx.fill();
    let rad = cs * 0.33 * k;
    if (v === loopColor) rad *= 1 + 0.1 * pulse;
    dot(x, y, rad, col);
    digit(x, y, rad, G.dig[r][c]);
    if (clashSet && clashSet.has(r * 9 + c)) { ctx.strokeStyle = rgba(BAD, 0.6 + 0.4 * pulse); ctx.lineWidth = 3; circle(x, y, cs * 0.44); ctx.stroke(); }
  }
  if (drag && (drag.snap || drag.bad)) {
    const p = drag.piece, at = drag.snap || drag.bad, bad = !drag.snap;
    ctx.globalAlpha = bad ? 0.55 : prev ? 0.8 : 0.38;
    p.cells.forEach(([dr, dc], i) => {
      const [x, y] = cellCenter(at.r + dr, at.c + dc);
      dot(x, y, cs * 0.33, bad ? BAD : PAL[p.color]);
      if (p.dig) digit(x, y, cs * 0.33, p.dig[i]);
    });
    ctx.globalAlpha = 1;
  }
  if (chain) drawChain();
}
function drawChain() {
  const cs = L.board.cell, col = PAL[chain.color];
  const pts = chain.cells.map(([r, c]) => cellCenter(r, c));
  ctx.strokeStyle = col; ctx.lineWidth = cs * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (!chain.loop) ctx.lineTo(chain.x, chain.y);
  ctx.stroke();
  ctx.strokeStyle = rgba(col, 0.4); ctx.lineWidth = 3;
  for (const [x, y] of pts) { circle(x, y, cs * 0.44); ctx.stroke(); }
}
function drawTray() {
  const t = L.tray, sw = t.w / 3, cs = L.trayCell;
  for (let i = 0; i < 3; i++) {
    const p = G.tray[i];
    if (!p || (drag && drag.slot === i)) continue;
    const k = clamp((now - p.born) / 0.35, 0, 1);
    if (k <= 0) continue;
    const s = easeOutBack(k), fits = anyFit(p);
    let cx = t.x + sw * (i + 0.5), cy = t.y + t.h / 2, pcs = cs;
    if (p.ret && now - p.ret.t0 < 0.22) { // fly back after a drop that did not fit
      const q = easeOutCubic((now - p.ret.t0) / 0.22);
      cx = lerp(p.ret.x, cx, q); cy = lerp(p.ret.y, cy, q); pcs = lerp(p.ret.cs, cs, q);
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    drawPiece(p, -p.w * pcs / 2, -p.h * pcs / 2, pcs, fits ? 1 : 0.28);
    ctx.restore();
  }
}
function drawDrag() {
  const p = drag.piece, k = easeOutCubic(clamp((now - drag.t0) / 0.14, 0, 1));
  const cs = lerp(L.trayCell, L.board.cell, k), lift = drag.lift * k; // grow out of the tray and rise
  const ox = drag.x - p.w * cs / 2, oy = drag.y - lift - p.h * cs / 2;
  ctx.save(); ctx.shadowColor = 'rgba(39,48,63,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  drawPiece(p, ox, oy, cs, 1);
  ctx.restore();
}
function drawPops() {
  const cs = L.board.cell;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i], [x, y] = cellCenter(p.r, p.c);
    if (now < p.t0) { dot(x, y, cs * 0.33, PAL[p.color]); digit(x, y, cs * 0.33, p.d); continue; }
    if (!p.done) { p.done = true; burst(x, y, PAL[p.color], 6, 170); }
    const k = (now - p.t0) / 0.3;
    if (k >= 1) { pops.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - k;
    dot(x, y, cs * 0.33 * (1 - k * 0.6), PAL[p.color]);
    ctx.strokeStyle = PAL[p.color]; ctx.lineWidth = 3 * (1 - k); circle(x, y, cs * (0.33 + k * 0.4)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawParticles() {
  for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.max); ctx.fillStyle = p.color; circle(p.x, p.y, p.size); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i], k = (now - t.t0) / t.dur;
    if (k >= 1) { texts.splice(i, 1); continue; }
    if (k < 0) continue;
    const s = easeOutBack(clamp(k * 4, 0, 1)), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(t.x, t.y - k * 36); ctx.scale(s, s);
    ctx.font = `800 ${t.size}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = t.size * 0.22; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}
function drawArena() {
  const v = G.arenaVis; if (v <= 0.001 || !AR.def) return;
  const A = L.arena;
  ctx.save();
  ctx.beginPath(); ctx.arc(A.x + A.w / 2, A.y + A.h / 2, easeOutCubic(v) * Math.hypot(A.w, A.h) / 2 + 1, 0, Math.PI * 2); ctx.clip();
  rrect(A.x, A.y, A.w, A.h, 22); ctx.clip();
  drawArcade();
  ctx.restore();
}
// Goal chips for a level: an icon and have/need for each goal.
function goalIcon(g, x, y, s) {
  if (g.t === 'color') { dot(x, y, s * 0.42, PAL[g.c]); return; }
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  if (g.t === 'lines') { rrect(x - s * 0.45, y - s * 0.28, s * 0.9, s * 0.18, 2); ctx.fill(); rrect(x - s * 0.45, y + s * 0.1, s * 0.9, s * 0.18, 2); ctx.fill(); }
  else if (g.t === 'boxes') { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? PAL[2] : INK; ctx.fillRect(x - s * 0.42 + i * s * 0.29, y - s * 0.42 + j * s * 0.29, s * 0.24, s * 0.24); } }
  else if (g.t === 'loops') { ctx.strokeStyle = PAL[3]; ctx.lineWidth = 3; rrect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72, 4); ctx.stroke(); }
  else if (g.t === 'sudoku') { ctx.fillStyle = PAL[2]; rrect(x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.9, 5); ctx.fill(); txt('9', x, y + 1, s * 0.6, '#FFFFFF', { font: FD }); }
  else if (g.t === 'score') { txt('★', x, y + 1, s * 0.9, PAL[1], { font: FB, weight: 900 }); }
}
function goalLabel(g) {
  return { color: 'точок', lines: 'ліній', boxes: 'квадратів', loops: 'петель', sudoku: 'судоку', score: 'очок' }[g.t] || '';
}
function drawGoals(cx, y, maxW) {
  const gs = G.lvl.goals, s = 18;
  const items = gs.map(g => ({ g, text: g.t === 'score' ? `${Math.min(G.score, g.n)}/${g.n}` : `${g.have}/${g.n}`, done: (g.t === 'score' ? G.score : g.have) >= g.n }));
  ctx.font = `900 14px ${FB}`;
  const widths = items.map(it => s + 6 + ctx.measureText(it.text).width + 16);
  const total = widths.reduce((a, b) => a + b, 0) - 16;
  let x = cx - Math.min(total, maxW) / 2;
  items.forEach((it, i) => {
    const pk = it.g.pulse ? clamp(1 - (now - it.g.pulse) / 0.4, 0, 1) : 0;
    ctx.save(); ctx.translate(x + s / 2, y); ctx.scale(1 + pk * 0.25, 1 + pk * 0.25); goalIcon(it.g, 0, 0, s); ctx.restore();
    if (it.done) {
      ctx.fillStyle = GOOD; circle(x + s + 6 + 8, y, 8); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s + 10, y); ctx.lineTo(x + s + 13, y + 3); ctx.lineTo(x + s + 18, y - 3); ctx.stroke();
    } else txt(it.text, x + s + 6, y + 1, 14, INK, { font: FB, weight: 900, align: 'left' });
    x += widths[i];
  });
}
function statusText() {
  if (G.state === 'arcade' && AR.def) return [`${G.mode === 'endless' ? 'Аркадний раунд' : 'Аркада'} · ${AR.def.title}`, SOFT];
  if (G.placements === 0 && G.mode === 'endless') return ['Перетягни фігуру на поле', SOFT];
  if (G.chainsUsed === 0 && G.energy > 0 && G.placements >= 2) return ['Веди пальцем по точках одного кольору', SOFT];
  if (!ARC.size()) return ['', SOFT];
  const left = Math.max(0, G.rush.need - G.rush.meter);
  const next = G.rush.next && ARC.get(G.rush.next) ? ARC.get(G.rush.next).title : 'аркади';
  if (left === 0) return ['Аркада!', INK];
  return [`Ще ${left} ${left === 1 ? 'очищення' : left < 5 ? 'очищення' : 'очищень'} до ${next}`, SOFT];
}
function drawHUD() {
  const hx = L.hud.x, hw = L.hud.w, y0 = L.hudY, hh = L.hudH, rowY = y0 + hh * 0.5;
  const hb = L.home, sb = L.sound, vb = L.vibe;
  drawHome(hb.x + hb.w / 2, hb.y + hb.h / 2);
  drawSpeaker(sb.x + sb.w / 2, sb.y + sb.h / 2, !muted);
  drawVibe(vb.x + vb.w / 2, vb.y + vb.h / 2, haptics);
  try { ctx.letterSpacing = '1px'; } catch (e) {}
  const right = G.lvl ? `РІВЕНЬ ${G.lvl.n}` : G.mode === 'solo' ? 'ІГРОТЕКА' : 'РЕКОРД ' + Math.max(best, G.score);
  txt(right, hx + hw, sb.y + sb.h / 2, 12, SOFT, { font: FB, weight: 900, align: 'right' });
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  if (G.mode === 'solo') {
    if (AR.def) {
      txt(AR.def.title, W / 2, rowY, clamp(hh * 0.24, 20, 30), INK, { font: FD, max: hw - 40 });
      txt(`${AR.def.family || 'Аркада'} · ${Math.min(AR.inst ? AR.inst.progress : 0, AR.goal.count)}/${AR.goal.count} ${AR.goal.unit}`, W / 2, y0 + hh - 14, 13.5, SOFT, { font: FB, weight: 800, max: hw });
    }
    return;
  }
  // centre: score in endless, moves left in a level
  const sl = hx + 84, sr = hx + hw - 48;
  if (G.mode === 'level' && G.lvl && G.state !== 'arcade') {
    const mv = Math.max(0, G.lvl.movesLeft), low = mv <= 3;
    const ssz = clamp(hh * 0.32, 28, 42);
    txt(String(mv), W / 2, rowY - 4, ssz, low ? BAD : INK, { font: FD });
    txt(mv === 1 ? 'хід' : mv >= 2 && mv <= 4 ? 'ходи' : 'ходів', W / 2, rowY + ssz * 0.62, 11, SOFT, { font: FB, weight: 900 });
  } else {
    const scoreStr = String(Math.round(G.shown)), ssz = clamp(hh * 0.32, 28, 42);
    ctx.font = `800 ${ssz}px ${FD}`;
    const tw = Math.min(ctx.measureText(scoreStr).width, sr - sl);
    const sx = clamp(W / 2, sl + tw / 2, sr - tw / 2);
    txt(scoreStr, sx, rowY, ssz, INK, { font: FD, max: sr - sl });
  }
  // energy pill
  const pk = clamp(1 - (now - G.ePulse) / 0.45, 0, 1);
  ctx.save(); ctx.translate(hx + 38, rowY); ctx.scale(1 + 0.15 * pk, 1 + 0.15 * pk);
  ctx.fillStyle = CARD; rrect(-38, -17, 76, 34, 17); ctx.fill();
  bolt(-16, 0, 20, PAL[1]);
  txt(String(G.energy), 12, 1, 18, INK, { font: FD });
  ctx.restore();
  // right badge: next arcade (endless) or the level score
  const rx = hx + hw - 21, R = 17;
  ctx.fillStyle = CARD; circle(rx, rowY, R + 5); ctx.fill();
  if (G.mode === 'endless') {
    const def = G.state === 'arcade' && AR.def ? AR.def : ARC.get(G.rush.next);
    const prog = G.state === 'arcade' ? 1 : clamp(G.rush.meter / G.rush.need, 0, 1);
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = DIM; circle(rx, rowY, R); ctx.stroke();
    if (prog > 0) { ctx.strokeStyle = def ? def.accent || PAL[3] : PAL[3]; ctx.beginPath(); ctx.arc(rx, rowY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke(); }
    if (def) drawGameIcon(def, rx, rowY, 11);
  } else {
    txt('★', rx, rowY - 5, 14, PAL[1], { font: FB, weight: 900 });
    txt(String(Math.round(G.shown)), rx, rowY + 8, 10, INK, { font: FD, max: 38 });
  }
  if (G.mode === 'level' && G.lvl && G.state !== 'arcade') drawGoals(W / 2, y0 + hh - 14, hw);
  else { const [st, sc] = statusText(); txt(st, W / 2, y0 + hh - 14, 13.5, sc, { font: FB, weight: 800, max: hw }); }
}
function drawToast() {
  const t = G.toast;
  if (!t || now > t.until || G.state === 'ad') return;
  const k = clamp((now - t.t0) / 0.2, 0, 1) * clamp((t.until - now) / 0.3, 0, 1);
  const b = L.board, y = b.y - 2;
  ctx.font = `900 14px ${FB}`;
  const w = Math.min(ctx.measureText(t.text).width + 32, Math.max(b.s, 300));
  ctx.save(); ctx.globalAlpha = k;
  ctx.shadowColor = 'rgba(39,48,63,0.2)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = INK; rrect(W / 2 - w / 2, y - 16, w, 32, 16); ctx.fill();
  ctx.shadowColor = 'transparent';
  txt(t.text, W / 2, y + 1, 14, '#FFFFFF', { font: FB, weight: 900, max: w - 20 });
  ctx.restore();
}
// Level intro card over the board: what to do in this level, dismissed by a tap.
function drawLevelIntro() {
  const lv = G.lvl; if (!lv || !lv.intro) return;
  const b = L.board, cw = Math.min(b.s - 12, 330);
  const tipLines = lv.def.tip ? wrapText(lv.def.tip, cw - 40, `800 14px ${FB}`) : [];
  const ch = 150 + tipLines.length * 20;
  const x = W / 2 - cw / 2, y = b.y + b.s / 2 - ch / 2;
  const k = easeOutBack(clamp((now - lv.introAt) / 0.35, 0, 1));
  ctx.save(); ctx.translate(W / 2, y + ch / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(y + ch / 2));
  ctx.fillStyle = 'rgba(231,236,243,0.6)'; rrect(b.x - 8, b.y - 8, b.s + 16, b.s + 16, 20); ctx.fill();
  ctx.shadowColor = 'rgba(39,48,63,0.2)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = CARD; rrect(x, y, cw, ch, 24); ctx.fill(); ctx.shadowColor = 'transparent';
  txt(lv.def.sudoku ? `РІВЕНЬ ${lv.n} · СУДОКУ` : `РІВЕНЬ ${lv.n}`, W / 2, y + 28, 12, lv.def.sudoku ? PAL[2] : SOFT, { font: FB, weight: 900 });
  txt(lv.def.title || 'Завдання', W / 2, y + 56, 20, INK, { font: FD, max: cw - 32 });
  drawGoals(W / 2, y + 90, cw - 20);
  tipLines.forEach((l, i) => txt(l, W / 2, y + 120 + i * 20, 14, INK, { font: FB, weight: 800 }));
  txt(`${lv.movesLeft} ходів · тапни, щоб почати`, W / 2, y + ch - 20, 12.5, rgba(PAL[3], 0.65 + 0.35 * Math.sin(now * 6)), { font: FB, weight: 900, max: cw - 24 });
  ctx.restore();
}

/* ================= loop ================= */
function update(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    if (timers[i] && now >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  }
  G.shown += (G.score - G.shown) * Math.min(1, dt * 8);
  if (Math.abs(G.score - G.shown) < 0.5) G.shown = G.score;
  G.shake *= Math.pow(0.001, dt);
  const target = G.state === 'arcade' ? 1 : 0;
  G.arenaVis += (target - G.arenaVis) * Math.min(1, dt * 6);
  if (Math.abs(target - G.arenaVis) < 0.002) G.arenaVis = target;
  if (G.state === 'arcade') arcadeUpdate(dt);
  if (G.state === 'ad') adUpdate(dt);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.t >= p.max) { parts.splice(i, 1); continue; }
    p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (G.shake > 0.3) ctx.translate((Math.random() * 2 - 1) * G.shake, (Math.random() * 2 - 1) * G.shake);
  if (G.boardVisible) { drawBoard(); drawTray(); drawPops(); }
  drawArena();
  drawParticles(); drawTexts();
  ctx.restore();
  if (G.state !== 'menu') drawHUD();
  if (G.boardVisible && G.state === 'puzzle') drawLevelIntro();
  drawToast();
  if (drag) drawDrag();
  if (G.state === 'ad') { drawAd(); drawParticles(); }
}
let lastT = null;
function frame(ms) {
  const t = ms / 1000;
  const raw = lastT == null ? 0 : t - lastT;
  const dt = Math.min(Math.max(0, raw), 1 / 30);
  if (raw > 0 && raw < 1 && !document.hidden) { // frame pacing, reported every 30 s
    perf.frames++; perf.time += raw; if (raw > 0.05) perf.long++;
    if (perf.time >= 30) {
      LOG.ev('perf', { fps: Math.round(perf.frames / perf.time), long: perf.long, state: G.state, mod: AR.def ? AR.def.id : AD.def ? AD.def.id : '' });
      perf.frames = 0; perf.time = 0; perf.long = 0;
    }
  }
  lastT = t; now = t;
  try { update(dt); render(); } catch (e) { console.error(e); logErr(e.message, 'frame', 0, 0, e.stack); }
  requestAnimationFrame(frame);
}

/* ================= input ================= */
function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  audioInit();
  const { x, y } = pt(e);
  if (G.state === 'ad') { adPointer('down', x, y); activeId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {} return; }
  const hb = L.home, sb = L.sound, vb = L.vibe;
  const dist = r => Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2));
  const nearest = [hb, sb, vb].reduce((a, r) => dist(r) < dist(a) ? r : a);
  if (dist(nearest) < 22 && G.state !== 'menu') {
    if (nearest === hb) { openPause(); return; }
    if (nearest === sb) { muted = !muted; store.set('polygame.muted', muted); if (!muted) sfx.pick(); LOG.ev('toggle', { what: 'sound', on: !muted }); return; }
    haptics = !haptics; store.set('polygame.haptics', haptics); if (haptics) buzz(HAP.double); LOG.ev('toggle', { what: 'haptics', on: haptics }); return;
  }
  if (G.state === 'arcade') { activeId = e.pointerId; arcadeTap(x, y); return; }
  if (G.state !== 'puzzle' || now < G.busyUntil || activeId !== null) return;
  if (G.lvl && G.lvl.intro) { if (now - G.lvl.introAt > 0.35) { G.lvl.intro = false; sfx.pick(); LOG.ev('level_go', { n: G.lvl.n }); } return; }
  const slot = traySlotAt(x, y);
  if (slot >= 0 && G.tray[slot]) {
    activeId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { slot, piece: G.tray[slot], x, y, sx: x, sy: y, moved: false, touch: e.pointerType !== 'mouse', lift: 0, t0: now, snap: null, clears: null, bad: null };
    updateDrag(x, y); sfx.pick(); buzz(HAP.tick);
    return;
  }
  const cell = boardCellAt(x, y);
  if (cell && G.grid[cell[0]][cell[1]] >= 0) {
    activeId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    chain = { cells: [cell], color: G.grid[cell[0]][cell[1]], loop: false, x, y, lx: x, ly: y };
    sfx.chain(0);
  }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== activeId) return;
  const { x, y } = pt(e);
  if (G.state === 'ad') { adPointer('move', x, y); return; }
  if (G.state === 'arcade') { if (AR.sub === 'play') arcCall('move', x, y); return; }
  if (drag) {
    if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > L.board.cell * 0.3) drag.moved = true;
    updateDrag(x, y);
  } else if (chain) moveChain(x, y);
});
function release(e, cancel) {
  if (e.pointerId !== activeId) return;
  activeId = null;
  const { x, y } = pt(e);
  if (G.state === 'ad') { adPointer('up', x, y); return; }
  if (G.state === 'arcade') { if (AR.sub === 'play') arcCall('up', x, y); return; }
  if (drag) {
    const d = drag; drag = null;
    lastDragMs = Math.round((now - d.t0) * 1000);
    if (!cancel && d.moved && d.snap && G.state === 'puzzle') placePiece(d.slot, d.snap.r, d.snap.c);
    else {
      d.piece.ret = { x: d.x, y: d.y - d.lift, cs: L.board.cell, t0: now };
      if (!cancel) sfx.back();
      if (d.bad && !cancel) {
        const [qr, qc] = d.bad.clash[0], dd = G.dig[qr][qc];
        const i = d.piece.dig.indexOf(dd), pr = d.bad.r + d.piece.cells[i][0], pc = d.bad.c + d.piece.cells[i][1];
        const where = qr === pr ? 'цьому рядку' : qc === pc ? 'цьому стовпці' : 'цьому квадраті 3×3';
        toast(`Цифра ${dd} вже є в ${where}`, 2.2); sfx.bad(); buzz(HAP.double);
      }
      if (d.moved) LOG.ev('drop_back', { g: G.gameNo, p: d.piece.key, ms: lastDragMs, cancel: !!cancel, fits: anyFit(d.piece), sud: d.bad ? 1 : 0 });
    }
  }
  else if (chain) { if (cancel) chain = null; else endChain(); }
}
cv.addEventListener('pointerup', e => release(e, false));
cv.addEventListener('pointercancel', e => release(e, true));
window.addEventListener('keydown', e => {
  if (G.state === 'arcade' && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter')) {
    e.preventDefault(); audioInit(); if (!e.repeat) arcadeTap(L.arena.x + L.arena.w / 2, L.arena.y + L.arena.h / 2); return;
  }
  if (e.key === 'Escape' && (G.state === 'puzzle' || G.state === 'arcade')) { openPause(); return; }
  // demo shortcuts in endless: 1..9 start that arcade game, 0 shows an "ad"
  if (G.state === 'puzzle' && G.mode === 'endless' && !drag && !chain && now >= G.busyUntil) {
    const list = ARC.list();
    if (/^[1-9]$/.test(e.key) && list[+e.key - 1]) startArcade(list[+e.key - 1].id, { from: 'rush' });
    if (e.key === '0') showAd(null, { reason: 'debug', reward: { energy: 2 } });
  }
});

/* ================= overlays ================= */
const OVERLAYS = ['menu', 'over', 'map', 'library', 'lvlend', 'pause'];
function showOverlay(id) { for (const o of OVERLAYS) { const el = $(o); if (el) el.hidden = o !== id; } }
let pausedFrom = null;
function openPause() {
  if (G.state !== 'puzzle' && G.state !== 'arcade') return;
  pausedFrom = G.state;
  if (G.state === 'arcade' && AR.sub === 'play') AR.sub = 'paused';
  G.state = 'paused'; drag = null; chain = null; activeId = null;
  $('pauseInfo').textContent = G.mode === 'level' && G.lvl ? `Рівень ${G.lvl.n}` : G.mode === 'solo' ? 'Ігротека' : 'Нескінченна гра';
  showOverlay('pause');
}
function closePause() { showOverlay(null); G.state = pausedFrom || 'puzzle'; G.busyUntil = now + 0.25; }

/* ================= lifecycle ================= */
// iOS only unlocks Web Audio inside touchend/click, so listen for those too.
['touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, audioInit, { passive: true }));
document.addEventListener('visibilitychange', () => {
  LOG.ev('vis', { h: document.hidden ? 1 : 0, state: G.state });
  if (!document.hidden) { LOG.flush(); checkUpdate(); return; }
  LOG.beacon();
  try { if (AC) AC.suspend(); } catch (e) {}
  if (G.state === 'arcade' && AR.sub === 'play') AR.sub = 'paused'; // freeze in place, resume on tap
  if (activeId !== null) { activeId = null; drag = null; chain = null; }
});
window.addEventListener('pagehide', () => { LOG.ev('end', { sec: Math.round((Date.now() - LOG.t0) / 1000), state: G.state }); LOG.beacon(); });

/* ================= self-update for the home-screen app ================= */
// iOS keeps a home-screen web app alive in memory and GitHub Pages caches for ~10 min,
// so the page asks the server for its own latest copy and compares build stamps.
let updateReady = false, latestBuild = BUILD;
function applyUpdate() {
  let tried = null;
  try { tried = sessionStorage.getItem('polygame.tried'); } catch (e) {}
  if (tried === latestBuild) return false; // one attempt per build, so a stale cache can never loop
  try { sessionStorage.setItem('polygame.tried', latestBuild); } catch (e) {}
  LOG.ev('update', { from: BUILD, to: latestBuild, state: G.state }); LOG.beacon();
  location.replace(location.pathname + '?v=' + latestBuild); // a fresh URL skips the cached copy
  return true;
}
async function checkUpdate() {
  if (!/^https?:$/.test(location.protocol) || window.top !== window.self) return;
  try {
    const res = await fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const m = (await res.text()).match(/const BUILD = '(\d+)'/);
    if (!m || m[1] <= BUILD) return;
    updateReady = true; latestBuild = m[1];
    if (['menu', 'over', 'map', 'library', 'lvlend'].includes(G.state)) applyUpdate();
    else toast('Є нова версія — оновиться в меню', 4);
  } catch (e) {}
}
setTimeout(checkUpdate, 1500);
setInterval(checkUpdate, 3 * 60 * 1000);

/* ================= public API ================= */
window.PG = {
  get now() { return now; }, get W() { return W; }, get H() { return H; }, get ctx() { return ctx; },
  get arena() { return L.arena; }, get layout() { return L; },
  PAL, INK, SOFT, DIM, CARD, FIELD, SPIKE, GOOD, BAD, FD, FB, REDUCED, MAX_E, BUILD,
  clamp, lerp, rand, randi, pick, shuffle, easeOutBack, easeOutCubic, easeInOut, rgba,
  circle, rrect, txt, dot, digit, bolt, wrapText, drawGameIcon,
  sfx, tone, buzz, HAP, burst, floatText, shake, confetti, reward,
  log: (type, data) => LOG.ev(type, data),
  arcade: ARC, ads: ADS,
  // used by js/levels.js
  G, store, LOG, $, showOverlay, closePause, newPuzzle, startArcade, showAd, sudokuSolution, after, toast, refillTray,
  get updateReady() { return updateReady; }, applyUpdate, gameOver, levelCheck,
  hooks: {},
  get best() { return best; }
};

/* ================= boot ================= */
// Runs after every module script has registered (scripts sit at the end of <body>).
function boot() {
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);
  resize();
  newPuzzle({ mode: 'endless', seed: 'endless' }); G.state = 'menu';
  G.lastAdAt = Date.now() - 60000; // the first "ad" can come after about 90 s of play
  LOG.ev('start', {
    build: BUILD, ua: navigator.userAgent, lang: navigator.language,
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })(),
    vw: Math.round(W), vh: Math.round(H), sw: screen.width, sh: screen.height, dpr: window.devicePixelRatio || 1,
    standalone: !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)),
    vibrate: HAS_VIBRATE, touch: navigator.maxTouchPoints || 0, reduced: REDUCED, haptics, muted, best,
    games: Number(store.get('polygame.games', 0)) || 0, mem: navigator.deviceMemory || 0, cores: navigator.hardwareConcurrency || 0,
    arcade: ARC.list().map(d => d.id), minis: ADS.list().map(d => d.id)
  });
  if (PG.hooks.boot) PG.hooks.boot();
  requestAnimationFrame(frame);
}
document.addEventListener('DOMContentLoaded', boot);

// handle for automated checks
window.__poly = { G, L, AR, AD, startArcade, showAd, placePiece, checkStuck, canPlace, findClears, cellCenter, get drag() { return drag; }, get chain() { return chain; } };
})();

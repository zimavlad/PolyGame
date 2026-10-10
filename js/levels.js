// PolyGame levels: the level path (goals + moves), the map, the library, menus and dev URL shortcuts.
// ?arcade=<id>[&level=N]  ?ad=<id>  ?lvl=N  ?endless  open a game directly (used for testing modules).
(function () {
'use strict';
const PG = window.PG;
const { G, store, $, showOverlay } = PG;

/* ================= level definitions ================= */
// Arcade nodes rotate through the games in this order (missing modules are skipped).
const ARC_ORDER = ['spike', 'stack', 'knife', 'zigzag', 'colorswitch', 'flappy', 'timber'];
const HAND = [
  { title: 'Перші лінії', moves: 10, goals: [{ t: 'lines', n: 2 }], seed: 'rows', tray: [['XXX'], ['XXX'], ['XX', 'XX']], tip: 'Перетягуй фігури на поле. Заповни 2 рядки або стовпці — вони зникнуть.' },
  { title: 'Квадрати 3×3', moves: 12, goals: [{ t: 'boxes', n: 2 }], seed: 'boxes', tray: [['X', 'X', 'X'], ['X', 'X', 'X'], ['X']], tip: 'Заповнений квадрат 3×3 теж зникає.' },
  { title: 'Червоні точки', moves: 12, energy: 4, goals: [{ t: 'color', c: 0, n: 10 }], seed: 'pairs', tip: 'Веди пальцем по сусідніх точках одного кольору: вони лопаються за 1 ⚡.' },
  { kind: 'arcade', game: 'spike' },
  { title: 'Петля', moves: 14, energy: 3, goals: [{ t: 'loops', n: 1 }, { t: 'lines', n: 2 }], seed: 'square', tip: 'Замкни петлю з чотирьох точок одного кольору — зникне весь цей колір. Потім заповни 2 рядки або стовпці.' },
  { title: 'Перше судоку', sudoku: true, moves: 14, goals: [{ t: 'boxes', n: 1 }], seed: 'sudoku:b1', tip: 'На кожній кульці є цифра. Став фігури так, щоб цифри не повторювались у рядку, стовпці й квадраті 3×3. Заповни один квадрат 3×3 до кінця.' },
  { title: 'Два кольори', moves: 18, energy: 4, goals: [{ t: 'color', c: 1, n: 10 }, { t: 'color', c: 2, n: 10 }], seed: 'random' },
  { kind: 'arcade', game: 'stack' },
  { title: 'Судоку-лінії', sudoku: true, moves: 18, goals: [{ t: 'lines', n: 2 }], seed: 'sudoku:r2', tip: 'Добудуй рядки: у повному рядку судоку є всі цифри 1–9.' },
  { title: 'Рахунок', moves: 16, goals: [{ t: 'score', n: 300 }], seed: 'random', tip: 'Очищення кілька ходів підряд множать очки.' },
  { kind: 'arcade', game: 'knife' },
  { title: 'Судоку-квадрати', sudoku: true, moves: 24, goals: [{ t: 'boxes', n: 2 }], seed: 'sudoku:b2' },
  { title: 'Петлі', moves: 20, energy: 4, goals: [{ t: 'loops', n: 2 }, { t: 'color', c: 3, n: 12 }], seed: 'random' },
  { kind: 'arcade', game: 'zigzag' },
  { title: 'Велике судоку', sudoku: true, moves: 24, goals: [{ t: 'boxes', n: 1 }, { t: 'lines', n: 2 }], seed: 'sudoku:m3' }
];
function availableArcade() {
  const all = PG.arcade.list().map(d => d.id);
  return ARC_ORDER.filter(id => all.includes(id)).concat(all.filter(id => !ARC_ORDER.includes(id)));
}
function seeded(n) { let s = (n * 7919) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
// After the hand-made start, levels cycle: colour puzzle, sudoku puzzle, arcade — a little harder every lap.
function generated(n, noArcade) {
  const k = n - HAND.length, step = Math.floor((k - 1) / 3), cyc = (k - 1) % 3, rng = seeded(n);
  if (cyc === 2 && !noArcade) { const ids = availableArcade(); if (ids.length) return { kind: 'arcade', game: ids[(step + 4) % ids.length] }; }
  if (cyc === 1) {
    const n = Math.min(2 + Math.floor(step / 2), 4), v = step % 3;
    const goals = v === 0 ? [{ t: 'boxes', n }] : v === 1 ? [{ t: 'lines', n }] : [{ t: 'boxes', n: 1 }, { t: 'lines', n: n - 1 }];
    return { title: 'Судоку', sudoku: true, moves: 12 + n * 4, goals, seed: `sudoku:${v === 0 ? 'b' : v === 1 ? 'l' : 'm'}${n}` };
  }
  const c1 = Math.floor(rng() * 4), c2 = (c1 + 1 + Math.floor(rng() * 3)) % 4;
  const kinds = [
    [{ t: 'color', c: c1, n: 12 + step * 2 }, { t: 'lines', n: 2 + step }],
    [{ t: 'loops', n: 1 + Math.floor(step / 2) }, { t: 'color', c: c2, n: 10 + step * 2 }],
    [{ t: 'boxes', n: 2 + step }, { t: 'color', c: c1, n: 10 + step * 2 }],
    [{ t: 'score', n: Math.round((18 + step * 2) * 1.7) * 10 }]
  ];
  return { title: 'Завдання', moves: 18 + step * 2, energy: 4, goals: kinds[step % kinds.length], seed: step > 2 ? 'dense' : 'random' };
}
function levelDef(n) {
  let d = n <= HAND.length ? HAND[n - 1] : generated(n);
  if (d.kind === 'arcade' && !PG.arcade.get(d.game)) {
    const ids = availableArcade();
    d = ids.length ? Object.assign({}, d, { game: ids[n % ids.length] }) : generated(n, true);
  }
  return Object.assign({ kind: 'puzzle', energy: 3 }, d);
}
const COLOR_NAMES = ['червоних', 'жовтих', 'зелених', 'фіолетових'];
function goalText(g, have) {
  const h = have == null ? '' : `${Math.min(have, g.n)}/`;
  switch (g.t) {
    case 'color': return `${COLOR_NAMES[g.c]} точок ${h}${g.n}`;
    case 'lines': return `ліній ${h}${g.n}`;
    case 'boxes': return `квадратів ${h}${g.n}`;
    case 'loops': return `петель ${h}${g.n}`;
    case 'sudoku': return `судоку ${h}${g.n}`;
    case 'score': return `очок ${h}${g.n}`;
  }
  return '';
}

/* ================= progress ================= */
function prog() {
  const p = store.get('polygame.path', null);
  return p && typeof p === 'object' && p.stars ? p : { unlocked: 1, stars: {} };
}
const saveProg = p => store.set('polygame.path', p);
const totalStars = p => Object.values(p.stars).reduce((s, v) => s + (Number(v) || 0), 0);
function takeBonusEnergy() { const b = Number(store.get('polygame.bonusE', 0)) || 0; store.set('polygame.bonusE', 0); return b; }

/* ================= level flow ================= */
function startLevel(n) {
  const def = levelDef(n);
  showOverlay(null);
  if (def.kind === 'arcade') {
    G.mode = 'solo'; G.boardVisible = false; G.toast = null;
    G.lvl = { n, def, arcade: true, goals: [], movesLeft: 0, done: false, t0: Date.now() };
    PG.log('level_start', { n, kind: 'arcade', game: def.game });
    PG.startArcade(def.game, { from: 'level', onDone: res => {
      if (res.missing || res.broken) { finishLevel(n, true, 1, { arcade: true, skipped: true }); return; }
      if (res.eGain) store.set('polygame.bonusE', (Number(store.get('polygame.bonusE', 0)) || 0) + res.eGain);
      finishLevel(n, res.won, res.won ? 3 : 0, { arcade: true, reason: 'arcade', goal: res.goal });
    } });
    return;
  }
  const lvl = { n, def, movesLeft: def.moves, goals: def.goals.map(g => Object.assign({}, g, { have: 0 })), intro: true, introAt: PG.now, done: false, revived: false, t0: Date.now() };
  PG.newPuzzle({ mode: 'level', sudoku: def.sudoku, seed: def.seed, tray: def.tray, energy: def.energy + takeBonusEnergy(), lvl });
  PG.log('level_start', { n, kind: 'puzzle', sudoku: !!def.sudoku, moves: def.moves, goals: def.goals });
}
PG.hooks.levelWon = () => {
  const lv = G.lvl; if (!lv) return;
  const bonus = Math.max(0, lv.movesLeft) * 40;
  G.score += bonus;
  const frac = lv.movesLeft / lv.def.moves;
  finishLevel(lv.n, true, frac >= 0.35 ? 3 : frac >= 0.15 ? 2 : 1, { bonus });
};
PG.hooks.levelFailed = reason => { const lv = G.lvl; if (lv) finishLevel(lv.n, false, 0, { reason }); };
function finishLevel(n, won, stars, info) {
  const p = prog(), lv = G.lvl;
  if (won) {
    p.unlocked = Math.max(p.unlocked, n + 1);
    p.stars[n] = Math.max(Number(p.stars[n]) || 0, stars);
    saveProg(p);
    PG.sfx.win(); PG.confetti(70); PG.buzz(PG.HAP.success);
  }
  PG.log('level_end', {
    n, won, stars, reason: info.reason || '', arcade: !!info.arcade, score: G.score,
    movesLeft: lv ? lv.movesLeft : 0, revived: lv ? !!lv.revived : false,
    goals: lv && lv.goals ? lv.goals.map(g => ({ t: g.t, c: g.c, n: g.n, have: g.t === 'score' ? G.score : g.have })) : [],
    sec: lv ? Math.round((Date.now() - lv.t0) / 1000) : 0
  });
  PG.LOG.flush();
  G.state = 'lvlend';
  setTimeout(() => showLevelEnd(n, won, stars, info), won ? 700 : 250);
}
function showLevelEnd(n, won, stars, info) {
  const lv = G.lvl;
  $('leEyebrow').textContent = `Рівень ${n}`;
  $('leStars').innerHTML = won ? [1, 2, 3].map(i => i <= stars ? '★' : '<span class="off">★</span>').join('') : '';
  $('leStars').hidden = !won;
  $('leTitle').textContent = won ? (stars === 3 ? 'Ідеально!' : 'Пройдено!') : info.reason === 'moves' ? 'Ходи скінчились' : info.reason === 'stuck' ? 'Фігури не влазять' : 'Майже вийшло';
  if (won) $('leInfo').textContent = info.arcade ? 'Аркадний рівень пройдено' : `Очки: ${G.score}${info.bonus ? ` · за ходи, що лишились: +${info.bonus}` : ''}`;
  else if (info.arcade) $('leInfo').textContent = info.goal ? `Ціль: ${info.goal.count} ${info.goal.unit}. Спробуй ще раз!` : 'Спробуй ще раз!';
  else $('leInfo').textContent = 'Зроблено: ' + lv.goals.map(g => goalText(g, g.t === 'score' ? G.score : g.have)).join(' · ');
  $('leNext').hidden = !won;
  $('leRevive').hidden = won || info.arcade || !lv || lv.revived || !PG.ads.size();
  $('leRetry').textContent = won ? 'Зіграти ще раз' : 'Спробувати знову';
  $('leRetry').className = won ? 'btn ghost' : 'btn';
  $('lvlend').dataset.n = n;
  showOverlay('lvlend');
  G.state = 'lvlend';
}
$('leNext').addEventListener('click', () => {
  const n = Number($('lvlend').dataset.n) || 1;
  // every second level ends with an "ad": finishing it gives energy for the next level
  if (n % 2 === 0 && PG.ads.size()) {
    showOverlay(null); G.state = 'map';
    G.boardVisible = false;
    const shown = PG.showAd(null, { reason: 'break', reward: { label: '+2 ⚡ на наступний рівень', fn: () => store.set('polygame.bonusE', (Number(store.get('polygame.bonusE', 0)) || 0) + 2) }, onDone: () => openMap() });
    if (shown) return;
  }
  openMap();
});
$('leRetry').addEventListener('click', () => startLevel(Number($('lvlend').dataset.n) || 1));
$('leMap').addEventListener('click', () => openMap());
$('leRevive').addEventListener('click', () => {
  const lv = G.lvl; if (!lv) return;
  showOverlay(null); G.state = 'puzzle';
  const shown = PG.showAd(null, {
    reason: 'revive', reward: { moves: 5, energy: 2 },
    onDone: ({ won }) => {
      if (won) {
        // +5 moves and +2 energy are already paid by the ad host; a fresh tray gives a stuck board new options
        lv.revived = true; lv.done = false; G.state = 'puzzle'; G.busyUntil = PG.now + 0.3; G.toast = null;
        PG.refillTray();
        PG.log('level_revive', { n: lv.n });
      } else { lv.revived = true; showLevelEnd(lv.n, false, 0, { reason: 'moves' }); }
    }
  });
  if (!shown) showLevelEnd(lv.n, false, 0, { reason: 'moves' });
});

/* ================= endless ================= */
function startEndless() {
  showOverlay(null);
  PG.newPuzzle({ mode: 'endless', seed: 'endless' });
  PG.log('game_start', { g: G.gameNo, from: 'menu' });
}
$('again').addEventListener('click', () => { if (PG.updateReady && PG.applyUpdate()) return; startEndless(); });
$('overMenu').addEventListener('click', () => goMenu());

/* ================= map ================= */
const KIND_COLORS = { puzzle: 'var(--coral)', sudoku: 'var(--teal)', arcade: 'var(--violet)' };
function openMap() {
  if (PG.updateReady && PG.applyUpdate()) return;
  const p = prog(), list = $('mapList');
  const total = Math.max(p.unlocked + 9, 24);
  list.innerHTML = '';
  let current = null;
  for (let n = 1; n <= total; n++) {
    const d = levelDef(n), kind = d.kind === 'arcade' ? 'arcade' : d.sudoku ? 'sudoku' : 'puzzle';
    const li = document.createElement('li');
    li.style.setProperty('--off', ['0px', '-64px', '0px', '64px'][n % 4]);
    const b = document.createElement('button');
    b.type = 'button';
    const locked = n > p.unlocked, st = Number(p.stars[n]) || 0;
    b.className = 'node' + (locked ? ' locked' : '') + (n === p.unlocked ? ' current' : '');
    const game = d.kind === 'arcade' ? PG.arcade.get(d.game) : null;
    const label = game ? game.title : kind === 'sudoku' ? 'Судоку' : 'Пазл';
    b.innerHTML = `<span class="disc" style="--c:${game && game.accent ? game.accent : KIND_COLORS[kind]}">${n}</span><span class="kind">${label}</span><span class="st">${[1, 2, 3].map(i => i <= st ? '★' : '<span class="off">★</span>').join('')}</span>`;
    b.setAttribute('aria-label', `Рівень ${n}, ${label}${locked ? ', закрито' : `, зірок: ${st}`}`);
    if (!locked) b.addEventListener('click', () => { PG.sfx.pick(); startLevel(n); });
    else b.disabled = true;
    li.appendChild(b); list.appendChild(li);
    if (n === p.unlocked) current = li;
  }
  $('mapStars').textContent = `★ ${totalStars(p)}`;
  showOverlay('map'); G.state = 'map'; G.boardVisible = false;
  if (current) requestAnimationFrame(() => current.scrollIntoView({ block: 'center' }));
  PG.log('map_open', { unlocked: p.unlocked, stars: totalStars(p) });
}
$('mapBack').addEventListener('click', () => goMenu());

/* ================= library ================= */
function tile(icoColor, icoText, title, sub, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tile';
  b.innerHTML = `<span class="ico" style="--c:${icoColor}">${icoText}</span><b></b><span></span>`;
  b.querySelector('b').textContent = title; b.querySelector('span:last-child').textContent = sub;
  b.addEventListener('click', onClick);
  return b;
}
function openLibrary() {
  if (PG.updateReady && PG.applyUpdate()) return;
  const A = $('libArcade'), M = $('libMinis');
  A.innerHTML = ''; M.innerHTML = '';
  for (const d of PG.arcade.list()) {
    A.appendChild(tile(d.accent || '#7765EE', d.title[0], d.title, `${d.family || 'Аркада'} · рівень ${PG.arcade.level(d.id)}`, () => playSolo(d.id)));
  }
  for (const d of PG.ads.list()) {
    M.appendChild(tile('#F5B12E', d.title[0], d.title, d.hook || '', () => playMini(d.id)));
  }
  showOverlay('library'); G.state = 'library'; G.boardVisible = false; G.mode = 'solo'; G.lvl = null;
  PG.log('library_open', {});
}
function playSolo(id) {
  PG.__lastSolo = id;
  showOverlay(null);
  G.mode = 'solo'; G.boardVisible = false; G.lvl = null; G.toast = null;
  PG.startArcade(id, { from: 'library', onDone: () => openLibrary() });
}
function playMini(id) {
  showOverlay(null);
  G.mode = 'solo'; G.boardVisible = false; G.lvl = null; G.state = 'library';
  PG.showAd(id, { reason: 'library', reward: null, closeAfter: 0, onDone: () => openLibrary() });
}
$('libBack').addEventListener('click', () => goMenu());

/* ================= menu and pause ================= */
function refreshMenu() {
  const p = prog();
  $('pathInfo').textContent = `Рівень ${p.unlocked} · ★ ${totalStars(p)}`;
  $('endlessInfo').textContent = PG.best ? `Рекорд ${PG.best}` : 'Аркада після кожних кількох ліній';
  $('libInfo').textContent = `${PG.arcade.size()} аркад і ${PG.ads.size()} міні-ігор`;
  const m = String(PG.BUILD).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])), two = n => String(n).padStart(2, '0');
    $('ver').textContent = `Збірка ${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
  }
}
function goMenu() {
  PG.quitGame();
  if (PG.updateReady && PG.applyUpdate()) return;
  PG.newPuzzle({ mode: 'endless', seed: 'endless' });
  G.state = 'menu';
  refreshMenu();
  showOverlay('menu');
}
$('btnPath').addEventListener('click', () => { PG.sfx.pick(); openMap(); });
$('btnEndless').addEventListener('click', () => { PG.sfx.pick(); startEndless(); });
$('btnLibrary').addEventListener('click', () => { PG.sfx.pick(); openLibrary(); });
$('resume').addEventListener('click', () => PG.closePause());
$('pauseMenu').addEventListener('click', () => goMenu());
$('restart').addEventListener('click', () => {
  if (G.lvl) { startLevel(G.lvl.n); return; }
  if (G.mode === 'solo' && PG.__lastSolo) { playSolo(PG.__lastSolo); return; }
  startEndless();
});

/* ================= boot ================= */
PG.hooks.boot = () => {
  refreshMenu();
  const q = new URLSearchParams(location.search);
  if (q.get('arcade')) {
    const id = q.get('arcade'), lvl = Number(q.get('level')) || 0;
    if (lvl) PG.arcade.setLevel(id, lvl);
    const loop = () => { showOverlay(null); G.mode = 'solo'; G.boardVisible = false; G.lvl = null; PG.startArcade(id, { from: 'library', onDone: () => setTimeout(loop, 50) }); };
    loop(); return;
  }
  if (q.get('ad')) {
    const id = q.get('ad');
    const loop = () => { showOverlay(null); G.mode = 'solo'; G.boardVisible = false; G.state = 'library'; PG.showAd(id, { reason: 'dev', reward: { energy: 2 }, closeAfter: 0, onDone: () => setTimeout(loop, 50) }); };
    loop(); return;
  }
  if (q.get('lvl')) { startLevel(Math.max(1, Number(q.get('lvl')) || 1)); return; }
  if (q.has('endless')) { startEndless(); return; }
  showOverlay('menu');
};
PG.hooks.goalText = g => goalText(g);
PG.levels = { levelDef, startLevel, openMap, openLibrary, goMenu };
})();

// Гайки — a nuts-and-bolts sort. Tap a bolt: its top nuts of one colour spin up the thread. Tap another bolt: they
// fly over and screw down, if it is empty or its top nut has the same colour and there is room. Fill every bolt with
// one colour. Every level is checked by a solver before it is dealt, so it can always be solved.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, randi, shuffle, txt, rgba, easeInOut } = PG;
  const ACCENT = '#5C7CFA';
  const CAP = 4;
  const COLS = ['#F2615E', '#F5B12E', '#22B59B', '#7765EE', '#3E9BF0', '#F47FB0', '#8BC34A', '#FF8A3D', '#9AA3B5']; // the last one is a hidden nut
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  // level 1 already has four colours; every third level from 4 leaves only one empty bolt
// a single empty bolt only with up to five colours: with eight it turned into dead ends after a few natural moves
const spec = lv => (lv >= 4 && lv % 3 === 1 ? { colors: 5, empty: 1 } : { colors: Math.min(3 + lv, 8), empty: 2 });

  // ---- puzzle logic ----
  const topRun = b => { if (!b.length) return 0; const c = b[b.length - 1]; let n = 0; for (let i = b.length - 1; i >= 0 && b[i] === c; i--) n++; return n; };
  const canMove = (a, b) => a.length && a !== b && b.length < CAP && (!b.length || b[b.length - 1] === a[a.length - 1]);
  const solved = st => st.every(b => !b.length || (b.length === CAP && b.every(c => c === b[0])));
  function solvable(start, cap = 40000) {
    const seen = new Set(); let nodes = 0;
    const key = st => st.map(b => b.join(',')).sort().join('|');
    const go = st => {
      if (solved(st)) return true;
      if (++nodes > cap) return false;
      const k = key(st); if (seen.has(k)) return false; seen.add(k);
      for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) {
        if (i === j || !canMove(st[i], st[j])) continue;
        if (!st[j].length && topRun(st[i]) === st[i].length) continue; // moving a whole pure bolt to an empty one is pointless
        const n = Math.min(topRun(st[i]), CAP - st[j].length), nx = st.map(b => b.slice());
        for (let m = 0; m < n; m++) nx[j].push(nx[i].pop());
        if (go(nx)) return true;
      }
      return false;
    };
    return go(start.map(b => b.slice()));
  }
  function deal(lv) {
    const { colors, empty } = spec(lv);
    for (let tries = 0; tries < 60; tries++) {
      const pool = shuffle([].concat(...Array.from({ length: colors }, (_, c) => Array(CAP).fill(c))));
      const st = Array.from({ length: colors }, (_, i) => pool.slice(i * CAP, i * CAP + CAP)).concat(Array.from({ length: empty }, () => []));
      if (st.some(b => b.length && b.every(c => c === b[0]))) continue; // nothing solved at the start
      if (solvable(st)) return st;
    }
    // fallback: a guaranteed-solvable gentle shuffle
    return Array.from({ length: colors }, (_, c) => [c, c, (c + 1) % colors, (c + 1) % colors]).concat(Array.from({ length: empty }, () => []));
  }

  // Art: one white glossy nut tinted per colour (shading kept), a chrome bolt, a wooden shelf, a soft workshop wall.
  const NUT_AR = 213 / 256, SQUASH = 0.86, HOLE_Y = 0.27; // nut picture height/width, flattening, hole centre (fraction of height)
  const STEP = 0.5;                                        // a stacked nut shows this share of its picture height
  const tinted = {};
  function nutImg(ci) {
    if (tinted[ci]) return tinted[ci];
    const im = PG.sprite('img/bolts/nut.webp'); if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = COLS[ci]; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'color'; x.globalAlpha = 0.35; x.fillRect(0, 0, c.width, c.height); // richer colour
    x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.18; x.drawImage(im, 0, 0); // bring the gloss back
    x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(im, 0, 0);
    return (tinted[ci] = c);
  }
  // draws a nut whose bottom edge sits at y; wob squeezes it a little while it spins on the thread
  function nut(ctx, x, y, w, ci, wob) {
    const im = nutImg(ci), h = w * NUT_AR * SQUASH, k = 1 - Math.abs(Math.sin(wob || 0)) * 0.05;
    if (!im) { ctx.fillStyle = COLS[ci]; PG.rrect(x - w / 2, y - h, w, h, 6); ctx.fill(); return; }
    ctx.drawImage(im, x - w * k / 2, y - h, w * k, h);
  }
  const nutStep = w => w * NUT_AR * SQUASH * STEP;
  function icon(ctx, x, y, r) { nut(ctx, x, y + r * 0.85, r * 1.5, 0); nut(ctx, x, y + r * 0.85 - nutStep(r * 1.5), r * 1.5, 2); nut(ctx, x, y + r * 0.85 - nutStep(r * 1.5) * 2, r * 1.5, 3); }

  PG.arcade.register({
    id: 'bolts',
    title: 'Гайки',
    family: 'Головоломка',
    accent: ACCENT,
    rush: false,
    howto: ['Тапни болт — гайки підкрутяться вгору', 'Потім тапни інший: гайки перейдуть, якщо зверху той самий колір'],
    boosts: [{ id: 'bolt', icon: '🔩', name: '+1 порожній болт', price: 4 }, { id: 'hint', icon: '💡', name: 'Підказки', price: 2 }],
    goal: lv => ({ count: spec(lv).colors, unit: 'болтів' }),
    twist: lv => (lv === 1 ? 'Розминка: 4 кольори' : spec(lv).empty === 1 ? `Лише один порожній болт · ${spec(lv).colors} кольори` : `${spec(lv).colors} кольорів`) + (lv === 5 ? ' · нове: сховані гайки' : ''),
    icon,
    create(level) {
      const st = deal(level); let n = st.length;
      const s = { t: 0, st, sel: -1, selAt: 0, flights: [], land: [], done: new Set(), doneAt: {}, moves: 0, shakeB: -1, shakeT: -9 };
      // from level 5 the nuts under the top run are hidden ('?') until they come to the top: you plan with half the picture
      const hidden = level >= 8; // the top two nuts of every bolt are always visible
      s.seen = st.map(b => b.map((c, m) => !hidden || m >= b.length - Math.max(2, topRun(b))));
      const par = Math.round(spec(level).colors * 3.2 + 2); // moves for three stars
      const inst = { progress: 0, over: null, stats: { level, moves: 0 } };
      inst._s = s;
      const lay = A => {
        const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows), slot = A.w / (perRow + 0.2);
        const rowH = (A.h - 70) / rows;
        const nw = Math.min(slot * 0.88, 96, rowH / (rows === 1 ? 3.6 : 2.9)), st = nutStep(nw), rodH = nw * 2.55;
        const pos = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / perRow), c = i % perRow, cnt = r === rows - 1 ? n - perRow * (rows - 1) : perRow;
          pos.push({ x: A.x + A.w / 2 + (c - (cnt - 1) / 2) * slot, base: rows === 1 ? A.y + 60 + rowH * 0.74 : A.y + 60 + rowH * (r + 1) - rowH * 0.14, row: r, cnt }); }
        return { pos, nw, st, rodH, slot, rows, perRow };
      };
      inst._lay = lay; // for automated checks
      const busy = () => s.flights.length > 0;
      function complete(i) { const b = s.st[i]; return b.length === CAP && b.every(c => c === b[0]); }
      // after every move: can this still be won? if not, say so at once and point at «назад»; with hints, find the next move
      function firstMove(st0, cap) {
        const seen = new Set(); let nodes = 0, first = null;
        const key = st => st.map(b => b.join(',')).sort().join('|');
        const go = (st, path) => {
          if (solved(st)) { first = path[0] || null; return true; }
          if (++nodes > cap) return false;
          const k = key(st); if (seen.has(k)) return false; seen.add(k);
          for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) {
            if (i === j || !canMove(st[i], st[j])) continue;
            if (!st[j].length && topRun(st[i]) === st[i].length) continue;
            const m = Math.min(topRun(st[i]), CAP - st[j].length), nx = st.map(b => b.slice());
            for (let q = 0; q < m; q++) nx[j].push(nx[i].pop());
            if (go(nx, path.length ? path : [[i, j]])) return true;
          }
          return false;
        };
        const ok = go(st0.map(b => b.slice()), []);
        return { ok, first, sure: nodes <= cap };
      }
      function checkState() {
        if (inst.progress >= spec(level).colors) return;
        const r = firstMove(s.st, 30000);
        s.dead = !r.ok && r.sure; if (s.dead) { s.deadAt = s.t; PG.sfx.bad(); }
        s.hintMove = s.hints && r.ok ? r.first : null;
      }
      function stuck() {
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (canMove(s.st[i], s.st[j]) && !(s.st[j].length === 0 && topRun(s.st[i]) === s.st[i].length)) return false;
        return !solved(s.st);
      }
      // a ratchet of quick clicks, played as sound right away (sound is fine outside a touch, haptics on iOS are not)
      const ratchet = (n0, gap, f) => { for (let i = 0; i < n0; i++) PG.tone && PG.tone(f + (i % 2) * 140, 0.025, 'square', 0.03, i * gap); };
      s.undos = Infinity; s.hist = []; s.dead = false; s.hintMove = null;
      const undoRect = A => ({ x: A.x + A.w - 112, y: A.y + 10, w: 100, h: 34 });
      function undo() {
        const h = s.hist.pop(); if (!h) return;
        s.st = h.st; s.seen = h.seen; s.done = new Set(h.done); inst.progress = h.progress; s.sel = -1; s.moves++; s.dead = false; s.hintMove = null; checkState();
        PG.sfx.back(); PG.buzz(PG.HAP.light);
      }
      Object.assign(inst, {
        boost(id) {
          if (id === 'bolt') { s.st.push([]); s.seen.push([]); n = s.st.length; s.cache = null; }
          if (id === 'hint') { s.hints = true; checkState(); }
        },
        tap(x, y) {
          if (busy()) return;
          const A = PG.arena, g = lay(A);
          if (s.undos > 0 && s.hist.length) { const r = undoRect(A); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { undo(); return; } }
          let hit = -1, bd = 1e9;
          g.pos.forEach((p, i) => { const d = Math.abs(x - p.x); if (d < g.slot * 0.5 && y > p.base - g.rodH - g.st * 2 && y < p.base + g.st * 2 && d < bd) { bd = d; hit = i; } });
          if (hit < 0) { if (s.sel >= 0) { s.sel = -1; PG.sfx.back(); } return; }
          if (s.sel < 0) {
            if (!s.st[hit].length || s.done.has(hit)) { s.shakeB = hit; s.shakeT = s.t; PG.sfx.bad(); PG.buzz(PG.HAP.double); return; }
            s.sel = hit; s.selAt = s.t; ratchet(4, 0.05, 900); PG.buzz(PG.HAP.light); return;
          }
          if (hit === s.sel) { s.sel = -1; ratchet(3, 0.05, 700); PG.buzz(PG.HAP.tick); return; }
          if (!canMove(s.st[s.sel], s.st[hit])) { s.shakeB = hit; s.shakeT = s.t; PG.sfx.bad(); PG.buzz(PG.HAP.double); s.sel = -1; return; }
          const k = Math.min(topRun(s.st[s.sel]), CAP - s.st[hit].length), col = s.st[s.sel][s.st[s.sel].length - 1];
          const from = s.sel, fromH = s.st[from].length, toH = s.st[hit].length;
          { s.hist.push({ st: s.st.map(b => b.slice()), seen: s.seen.map(b => b.slice()), done: [...s.done], progress: inst.progress }); if (s.hist.length > 20) s.hist.shift(); }
          for (let m = 0; m < k; m++) { s.st[hit].push(s.st[from].pop()); s.seen[hit].push(true); s.seen[from].pop(); }
          // whatever is now on top of the source is revealed
          if (hidden) { const b = s.st[from], run = topRun(b); for (let m = b.length - run; m < b.length; m++) if (!s.seen[from][m]) { s.seen[from][m] = true; s.revealAt = s.t; s.revealB = from; } }
          // each nut flies on its own, a little after the one before: up the thread, over, and screwed down
          for (let m = 0; m < k; m++) s.flights.push({ from, to: hit, col, fromSlot: fromH - 1 - m, toSlot: toH + m, t: -m * 0.09, dur: 0.62, lift0: s.t - s.selAt });
          s.sel = -1; s.moves++; inst.stats.moves++;
          PG.sfx.whoosh();
          // haptics now, while the finger is on the glass (iOS only allows them here); a finished bolt feels different
          const fin = complete(hit) && !s.done.has(hit);
          PG.buzz(fin ? PG.HAP.success : PG.HAP.soft);
        },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt;
          const g = lay(A);
          for (const f of s.flights) {
            const prev = f.t; f.t += dt / f.dur;
            if (prev < 0.62 && f.t >= 0.62) ratchet(5, 0.035, 820); // screwing down
            if (f.t >= 1 && !f.done) {
              f.done = true; s.land.push({ i: f.to, slot: f.toSlot, t: s.t });
              const p = g.pos[f.to];
              PG.burst(p.x, p.base - f.toSlot * g.st, 'rgba(255,255,255,0.9)', 5, 70);
            }
          }
          if (s.flights.length && s.flights.every(f => f.done)) {
            const to = s.flights[0].to; s.flights = [];
            if (complete(to) && !s.done.has(to)) {
              s.done.add(to); s.doneAt[to] = s.t; inst.progress++;
              const p = g.pos[to];
              PG.reward({ score: 50, energy: 1, x: p.x, y: p.base - g.rodH });
              PG.burst(p.x, p.base - g.st * 2, COLS[s.st[to][0]], 22, 240); PG.burst(p.x, p.base - g.rodH, '#F5B12E', 12, 160);
              PG.sfx.loop();
            }
            checkState();
            if (inst.progress >= spec(level).colors) { inst.stars = s.moves <= par ? 3 : s.moves <= par * 1.35 ? 2 : 1; inst.stats.stars = inst.stars; }
          }
          s.land = s.land.filter(l => s.t - l.t < 0.4);
        },
        draw(ctx, A) {
          const g = lay(A), boltIm = PG.sprite('img/bolts/bolt.webp'), board = PG.sprite('img/bolts/board.webp'), bg = PG.sprite('img/bolts/bg.webp');
          const nutH = g.nw * NUT_AR * SQUASH;
          // the wall and the shelves never move: paint them once into a cached layer
          const key = `${A.w}x${A.h}x${PG.layout ? 1 : 0}`;
          if (bg && board && (!s.cache || s.cacheKey !== key)) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2), c = document.createElement('canvas');
            c.width = Math.round(A.w * dpr); c.height = Math.round(A.h * dpr);
            const x = c.getContext('2d'); x.scale(dpr, dpr);
            const k = Math.max(A.w / bg.naturalWidth, A.h / bg.naturalHeight);
            x.drawImage(bg, (A.w - bg.naturalWidth * k) / 2, (A.h - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k);
            x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 0, A.w, A.h);
            for (let r = 0; r < g.rows; r++) {
              const p = g.pos.find(q => q.row === r); if (!p) continue;
              const w = Math.min(A.w - 12, g.slot * p.cnt + 20), h = w * board.naturalHeight / board.naturalWidth;
              x.drawImage(board, (A.w - w) / 2, p.base - A.y - h * 0.3, w, h);
            }
            s.cache = c; s.cacheKey = key;
          }
          if (s.cache && s.cacheKey === key) ctx.drawImage(s.cache, A.x, A.y, A.w, A.h);
          else { ctx.fillStyle = '#DCE6F7'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          txt(String(inst.progress), A.x + A.w / 2, A.y + 34, 40, 'rgba(60,80,140,0.35)', { font: FD });
          txt(`ходів ${s.moves} · ★★★ до ${par}`, A.x + A.w / 2, A.y + 62, 12, s.moves <= par ? 'rgba(60,80,140,0.7)' : 'rgba(229,72,77,0.8)', { font: FB, weight: 900 });
          const boltW = boltIm ? g.nw * 0.3 / 78 * boltIm.naturalWidth : g.nw * 0.3, boltH = boltIm ? boltW * boltIm.naturalHeight / boltIm.naturalWidth : g.rodH;
          const boltTop = base => base - boltH - g.st * 0.3;
          const drawBolt = (x, base, clipY) => {
            ctx.save();
            if (clipY != null) { ctx.beginPath(); ctx.rect(x - boltW, boltTop(base) - 10, boltW * 2, clipY - boltTop(base) + 10); ctx.clip(); }
            if (boltIm) ctx.drawImage(boltIm, x - boltW / 2, boltTop(base), boltW, boltH);
            else { ctx.fillStyle = '#A9B3C4'; ctx.fillRect(x - boltW / 2, boltTop(base), boltW, boltH); }
            ctx.restore();
          };
          // where a nut sits on bolt i at stack slot m (its bottom edge), with landing squash and the finished-bolt hop
          const slotY = (p, m) => p.base - m * g.st;
          const flying = new Set(); s.flights.forEach(f => { if (!f.done || true) flying.add(f.to + ':' + f.toSlot); });
          g.pos.forEach((p, i) => {
            const sh = i === s.shakeB && s.t - s.shakeT < 0.35 ? Math.sin((s.t - s.shakeT) * 60) * 5 * (1 - (s.t - s.shakeT) / 0.35) : 0, x = p.x + sh;
            const b = s.st[i];
            const sel = i === s.sel ? topRun(b) : 0, liftK = sel ? PG.easeOutBack(Math.min(1, (s.t - s.selAt) / 0.28)) : 0;
            drawBolt(x, p.base, null);
            if (sel) { ctx.fillStyle = rgba('#FFFFFF', 0.4 + 0.2 * Math.sin(s.t * 8)); ctx.beginPath(); ctx.ellipse(x, p.base, g.nw * 0.62, g.st * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
            let topY = null;
            const doneK = s.doneAt[i] != null ? s.t - s.doneAt[i] : 9;
            for (let m = 0; m < b.length; m++) {
              if (flying.has(i + ':' + m)) continue; // drawn by its flight
              const lifted = sel && m >= b.length - sel;
              let y = slotY(p, m) - (lifted ? g.st * 1.35 * liftK + Math.sin(s.t * 6 + m) * 1.5 : 0);
              // finished: a little wave runs up the stack
              if (doneK < 0.9) y -= Math.max(0, Math.sin((doneK - m * 0.08) * Math.PI / 0.35)) * g.st * 0.5 * (doneK - m * 0.08 > 0 && doneK - m * 0.08 < 0.35 ? 1 : 0);
              const ld = s.land.find(l => l.i === i && l.slot === m), sq = ld ? 1 - Math.sin(Math.min(1, (s.t - ld.t) / 0.25) * Math.PI) * 0.12 : 1;
              ctx.save(); ctx.translate(x, y); ctx.scale(1 / Math.sqrt(sq), sq);
              if (s.seen[i][m]) nut(ctx, 0, 0, g.nw, b[m], lifted ? s.t * 10 + m : 0);
              else { nut(ctx, 0, 0, g.nw, 8, 0); txt('?', 0, -nutH * 0.38, nutH * 0.42, 'rgba(255,255,255,0.9)', { font: FD }); }
              ctx.restore();
              topY = y - nutH * (1 - HOLE_Y);
            }
            if (topY != null) drawBolt(x, p.base, topY);
            if (s.done.has(i)) {
              const k = Math.min(1, doneK / 0.4), sx = x, sy = boltTop(p.base) + boltW * 0.32;
              const r = 8 * PG.easeOutBack(k) * (1 + 0.08 * Math.sin(s.t * 5 + i));
              ctx.save(); ctx.fillStyle = 'rgba(245,177,46,0.25)'; ctx.beginPath(); ctx.arc(sx, sy, r * 1.7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#F5B12E'; ctx.beginPath();
              for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5 + s.t * 0.6, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
              ctx.closePath(); ctx.fill(); ctx.restore();
            }
          });
          {
            const r = undoRect(A), on = s.hist.length > 0, pulse = s.dead ? 0.5 + 0.5 * Math.sin(s.t * 10) : 0;
            ctx.fillStyle = on ? `rgba(255,255,255,${0.92})` : 'rgba(255,255,255,0.5)'; PG.rrect(r.x, r.y, r.w, r.h, 17); ctx.fill();
            ctx.strokeStyle = rgba(ACCENT, on ? 0.6 + pulse * 0.4 : 0.2); ctx.lineWidth = 2 + pulse * 2; ctx.stroke();
            txt('↩️ назад', r.x + r.w / 2, r.y + r.h / 2 + 1, 13, on ? '#2B3A6B' : 'rgba(43,58,107,0.4)', { font: FB, weight: 900 });
            if (s.dead) { ctx.fillStyle = 'rgba(229,72,77,0.92)'; PG.rrect(A.x + A.w / 2 - 140, A.y + 76, 280, 30, 15); ctx.fill(); txt('Звідси вже не пройти. Тисни «назад»', A.x + A.w / 2, A.y + 91, 13, '#FFFFFF', { font: FB, weight: 900 }); }
          }
          // the paid hint: a glow under the bolt to take from, then under the one to put on
          if (s.hintMove && !s.dead && !busy()) {
            const [hf, ht] = s.hintMove, idx = s.sel < 0 ? hf : s.sel === hf ? ht : -1;
            if (idx >= 0) { const p = g.pos[idx]; ctx.fillStyle = rgba('#F5B12E', 0.35 + 0.25 * Math.sin(s.t * 8)); ctx.beginPath(); ctx.ellipse(p.x, p.base + 2, g.nw * 0.7, g.st * 0.6, 0, 0, Math.PI * 2); ctx.fill(); txt('💡', p.x, p.base + g.st * 1.4, 16, '#000', {}); }
          }
          // nuts in flight: spin up the thread, fly over in an arc with a tilt, screw down with a spin
          for (const f of s.flights) {
            if (f.done || f.t < 0) {
              if (f.t < 0) { const p = g.pos[f.from]; nut(ctx, p.x, slotY(p, f.fromSlot) - g.st * 1.35, g.nw, f.col, s.t * 10); }
              else { const p = g.pos[f.to]; nut(ctx, p.x, slotY(p, f.toSlot), g.nw, f.col, 0); }
              continue;
            }
            const pf = g.pos[f.from], pt = g.pos[f.to];
            const y0 = slotY(pf, f.fromSlot) - g.st * 1.35, topF = boltTop(pf.base) - 6, topT = boltTop(pt.base) - 6, y3 = slotY(pt, f.toSlot);
            let x, y, tilt = 0, spin = 0;
            if (f.t < 0.25) { const e = PG.easeInOut(f.t / 0.25); x = pf.x; y = lerp(y0, topF, e); spin = f.t * 40; }
            else if (f.t < 0.62) { const e = PG.easeInOut((f.t - 0.25) / 0.37); x = lerp(pf.x, pt.x, e); y = lerp(topF, topT, e) - Math.sin(e * Math.PI) * g.st * 2.2; tilt = Math.sin(e * Math.PI) * 0.35 * Math.sign(pt.x - pf.x); }
            else { const e = PG.easeOutCubic((f.t - 0.62) / 0.38); x = pt.x; y = lerp(topT, y3, e); spin = f.t * 46; }
            y = Math.max(y, A.y + nutH * 1.05); // never leave the arena at the top
            ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); nut(ctx, 0, 0, g.nw, f.col, spin); ctx.restore();
          }
        }
      });
      return inst;
    }
  });
})();

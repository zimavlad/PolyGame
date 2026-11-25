// Гайки — a nuts-and-bolts sort. Tap a bolt: its top nuts of one colour spin up the thread. Tap another bolt: they
// fly over and screw down, if it is empty or its top nut has the same colour and there is room. Fill every bolt with
// one colour. Every level is checked by a solver before it is dealt, so it can always be solved.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, randi, shuffle, txt, rgba, easeInOut } = PG;
  const ACCENT = '#5C7CFA';
  const CAP = 4;
  const COLS = ['#F2615E', '#F5B12E', '#22B59B', '#7765EE', '#3E9BF0', '#F47FB0', '#8BC34A', '#FF8A3D'];
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  const spec = lv => ({ colors: Math.min(2 + lv, 8), empty: lv === 4 || lv >= 9 ? 1 : 2 });

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
    howto: ['Тапни болт — гайки підкрутяться вгору', 'Тапни інший — перекрутяться туди, якщо колір той самий'],
    goal: lv => ({ count: spec(lv).colors, unit: 'болтів' }),
    twist: lv => ({ 1: 'Розминка: 3 кольори', 2: 'Нове: 4 кольори', 3: '5 кольорів', 4: 'Нове: лише один порожній болт', 5: '7 кольорів, два порожні', 6: '8 кольорів' }[lv] || (spec(lv).empty === 1 ? 'Один порожній болт' : 'Вісім кольорів')),
    icon,
    create(level) {
      const st = deal(level), n = st.length;
      const s = { t: 0, st, sel: -1, anim: null, done: new Set(), spin: st.map(b => b.map(() => Math.random() * 6)), moves: 0, shakeB: -1, shakeT: -9 };
      const inst = { progress: 0, over: null, stats: { level, moves: 0 } };
      inst._s = s;
      const lay = A => {
        const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows), slot = A.w / (perRow + 0.2);
        const rowH = (A.h - 70) / rows;
        const nw = Math.min(slot * 0.88, 96, rowH / (rows === 1 ? 3.6 : 2.9)), st = nutStep(nw), rodH = nw * 2.55;
        const pos = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / perRow), c = i % perRow, cnt = r === rows - 1 ? n - perRow * (rows - 1) : perRow;
          pos.push({ x: A.x + A.w / 2 + (c - (cnt - 1) / 2) * slot, base: rows === 1 ? A.y + 60 + rowH * 0.74 : A.y + 60 + rowH * (r + 1) - rowH * 0.12, row: r, cnt }); }
        return { pos, nw, st, rodH, slot, rows, perRow };
      };
      inst._lay = lay; // for automated checks
      function checkDone(i) {
        const b = s.st[i];
        if (b.length === CAP && b.every(c => c === b[0]) && !s.done.has(i)) {
          s.done.add(i); inst.progress++;
          const A = PG.arena, g = lay(A), p = g.pos[i];
          PG.reward({ score: 50, energy: 1, x: p.x, y: p.base - g.rodH });
          PG.burst(p.x, p.base - g.st * 3, COLS[b[0]], 18, 220); s.doneAt = s.doneAt || {}; s.doneAt[i] = s.t; PG.sfx.loop(); PG.buzz(PG.HAP.success);
        }
      }
      function stuck() {
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (canMove(s.st[i], s.st[j]) && !(s.st[j].length === 0 && topRun(s.st[i]) === s.st[i].length)) return false;
        return !solved(s.st);
      }
      Object.assign(inst, {
        tap(x, y) {
          if (s.anim) return;
          const A = PG.arena, g = lay(A);
          let hit = -1, bd = 1e9;
          g.pos.forEach((p, i) => { const d = Math.abs(x - p.x); if (d < g.slot * 0.5 && y > p.base - g.rodH - g.st * 2 && y < p.base + g.st * 2 && d < bd) { bd = d; hit = i; } });
          if (hit < 0) { s.sel = -1; return; }
          if (s.sel < 0) {
            if (!s.st[hit].length || s.done.has(hit)) { s.shakeB = hit; s.shakeT = s.t; PG.sfx.bad(); return; }
            s.sel = hit; PG.sfx.pick(); PG.buzz(PG.HAP.tick); return;
          }
          if (hit === s.sel) { s.sel = -1; PG.sfx.back(); return; }
          if (!canMove(s.st[s.sel], s.st[hit])) { s.shakeB = hit; s.shakeT = s.t; PG.sfx.bad(); PG.buzz(PG.HAP.double); s.sel = -1; return; }
          const k = Math.min(topRun(s.st[s.sel]), CAP - s.st[hit].length), col = s.st[s.sel][s.st[s.sel].length - 1];
          const from = s.sel, fromH = s.st[from].length;
          for (let m = 0; m < k; m++) s.st[hit].push(s.st[from].pop());
          s.anim = { from, to: hit, k, col, fromH, toH: s.st[hit].length - k, t: 0, dur: 0.42 + k * 0.06 };
          s.sel = -1; s.moves++; inst.stats.moves++;
          PG.sfx.whoosh();
        },
        idle(dt) { s.t += dt; },
        update(dt) {
          s.t += dt;
          if (s.anim) {
            const a = s.anim, prev = a.t; a.t += dt / a.dur;
            // ratchet ticks while screwing down
            if (Math.floor(prev * 8) !== Math.floor(a.t * 8) && a.t > 0.5) { PG.sfx.tick(); PG.buzz(PG.HAP.tick); }
            if (a.t >= 1) { s.anim = null; checkDone(a.to); if (inst.progress < spec(level).colors && stuck()) inst.over = { won: false, cause: 'stuck' }; }
          }
        },
        draw(ctx, A) {
          const bg = PG.sprite('img/bolts/bg.webp');
          if (bg) { const k = Math.max(A.w / bg.naturalWidth, A.h / bg.naturalHeight); ctx.drawImage(bg, A.x + (A.w - bg.naturalWidth * k) / 2, A.y + (A.h - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          else { ctx.fillStyle = '#DCE6F7'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          txt(String(inst.progress), A.x + A.w / 2, A.y + 34, 40, 'rgba(60,80,140,0.35)', { font: FD });
          const g = lay(A), boltIm = PG.sprite('img/bolts/bolt.webp'), board = PG.sprite('img/bolts/board.webp');
          // shelves, one per row
          for (let r = 0; r < g.rows; r++) {
            const p = g.pos.find(q => q.row === r); if (!p) continue;
            const w = Math.min(A.w - 12, g.slot * p.cnt + 20), h = board ? w * board.naturalHeight / board.naturalWidth : 20;
            if (board) ctx.drawImage(board, A.x + (A.w - w) / 2, p.base - h * 0.42, w, h); else { ctx.fillStyle = '#C08A5B'; ctx.fillRect(A.x + (A.w - w) / 2, p.base, w, 16); }
          }
          const boltW = boltIm ? g.nw * 0.3 / 78 * boltIm.naturalWidth : g.nw * 0.3, boltH = boltIm ? boltW * boltIm.naturalHeight / boltIm.naturalWidth : g.rodH;
          const drawBolt = (x, base, clipY) => {
            ctx.save();
            if (clipY != null) { ctx.beginPath(); ctx.rect(x - boltW, base - boltH - 10, boltW * 2, clipY - (base - boltH - 10)); ctx.clip(); }
            if (boltIm) ctx.drawImage(boltIm, x - boltW / 2, base - boltH - g.st * 0.3, boltW, boltH);
            else { ctx.fillStyle = '#A9B3C4'; ctx.fillRect(x - boltW / 2, base - boltH, boltW, boltH); }
            ctx.restore();
          };
          g.pos.forEach((p, i) => {
            const sh = i === s.shakeB && s.t - s.shakeT < 0.35 ? Math.sin((s.t - s.shakeT) * 60) * 4 : 0, x = p.x + sh;
            const b = s.st[i];
            let count = b.length; if (s.anim && s.anim.to === i) count -= s.anim.k;
            const sel = i === s.sel ? topRun(b) : 0;
            // the bolt behind the nuts…
            drawBolt(x, p.base, null);
            // glow under the selected bolt
            if (sel) { ctx.fillStyle = rgba('#FFFFFF', 0.45 + 0.2 * Math.sin(s.t * 8)); ctx.beginPath(); ctx.ellipse(x, p.base, g.nw * 0.62, g.st * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
            let topY = p.base;
            for (let m = 0; m < count; m++) {
              const lifted = sel && m >= b.length - sel;
              const lift = lifted ? g.st * (1.3 + 0.12 * Math.sin(s.t * 7)) : 0;
              const y = p.base - m * g.st - lift;
              nut(ctx, x, y, g.nw, b[m], lifted ? s.t * 9 : 0);
              topY = y - g.nw * NUT_AR * SQUASH * (1 - HOLE_Y);
            }
            // …and the rod again above the top nut, so it looks like it runs through the hole
            if (count) drawBolt(x, p.base, topY);
            // a finished bolt: soft glow and a little star
            if (s.done.has(i)) {
              const k = s.doneAt && s.doneAt[i] ? Math.min(1, (s.t - s.doneAt[i]) / 0.4) : 1;
              ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(s.t * 4 + i);
              const sx = x, sy = p.base - boltH - g.st * 0.3 + boltW * 0.32 - 3 * PG.easeOutBack(k);
              ctx.fillStyle = '#F5B12E'; ctx.beginPath();
              for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 4 : 9; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
              ctx.closePath(); ctx.fill(); ctx.restore();
            }
          });
          if (s.anim) {
            const a = s.anim, pf = g.pos[a.from], pt = g.pos[a.to], e = easeInOut(Math.min(1, a.t));
            for (let m = 0; m < a.k; m++) {
              const y0 = pf.base - (a.fromH - 1 - m) * g.st - g.st * 1.3, y1 = pt.base - (a.toH + m) * g.st;
              const arc = Math.min(pf.base, pt.base) - boltH - g.st * (0.5 + m);
              const x = lerp(pf.x, pt.x, e), y = e < 0.5 ? lerp(y0, arc, e * 2) : lerp(arc, y1, (e - 0.5) * 2);
              nut(ctx, x, y, g.nw, a.col, s.t * 12 + m);
            }
          }
        }
      });
      return inst;
    }
  });
})();

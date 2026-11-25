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

  function nut(ctx, x, y, w, col, rot, top) {
    const h = w * 0.34, rx = w / 2;
    // hex prism seen from the front: the six faces collapse to three visible bands, shifting with rotation
    const ph = ((rot % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
    const edges = []; for (let i = 0; i < 6; i++) { const a = ph + i * Math.PI / 3; if (Math.sin(a) > -0.01) edges.push(Math.cos(a)); }
    edges.sort((a, b) => a - b);
    const xs = [-1].concat(edges.filter(e => e > -0.999 && e < 0.999)).concat([1]);
    for (let i = 0; i < xs.length - 1; i++) {
      const mid = (xs[i] + xs[i + 1]) / 2, light = 0.75 + 0.45 * (1 - Math.abs(mid + 0.35));
      ctx.fillStyle = shade(col, light);
      ctx.fillRect(x + xs[i] * rx, y - h / 2, (xs[i + 1] - xs[i]) * rx + 0.6, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x - rx, y - h / 2, w, h * 0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x - rx, y + h / 2 - h * 0.16, w, h * 0.16);
    ctx.strokeStyle = shade(col, 0.6); ctx.lineWidth = 1; ctx.strokeRect(x - rx, y - h / 2, w, h);
    if (top) { // the hex top face with the threaded hole, seen from slightly above
      const ry = h * 0.42, cy = y - h / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = ph + i * Math.PI / 3; const px = x + Math.cos(a) * rx, py = cy + Math.sin(a) * ry; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fillStyle = shade(col, 1.18); ctx.fill(); ctx.strokeStyle = shade(col, 0.75); ctx.stroke();
      ctx.fillStyle = 'rgba(40,46,60,0.55)'; ctx.beginPath(); ctx.ellipse(x, cy, rx * 0.32, ry * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  PG.arcade.register({
    id: 'bolts',
    title: 'Гайки',
    family: 'Головоломка',
    accent: ACCENT,
    rush: false,
    howto: ['Тапни болт — гайки підкрутяться вгору', 'Тапни інший — перекрутяться туди, якщо колір той самий'],
    goal: lv => ({ count: spec(lv).colors, unit: 'болтів' }),
    twist: lv => ({ 1: 'Розминка: 3 кольори', 2: 'Нове: 4 кольори', 3: '5 кольорів', 4: 'Нове: лише один порожній болт', 5: '7 кольорів, два порожні', 6: '8 кольорів' }[lv] || (spec(lv).empty === 1 ? 'Один порожній болт' : 'Вісім кольорів')),
    icon(ctx, x, y, r) { nut(ctx, x, y + r * 0.25, r * 1.3, COLS[0], 0.3); nut(ctx, x, y - r * 0.2, r * 1.3, COLS[2], 0.6, true); },
    create(level) {
      const st = deal(level), n = st.length;
      const s = { t: 0, st, sel: -1, anim: null, done: new Set(), spin: st.map(b => b.map(() => Math.random() * 6)), moves: 0, shakeB: -1, shakeT: -9 };
      const inst = { progress: 0, over: null, stats: { level, moves: 0 } };
      inst._s = s;
      const lay = A => {
        const rows = n > 5 ? 2 : 1, perRow = Math.ceil(n / rows), slot = A.w / (perRow + 0.3);
        const nw = Math.min(slot * 0.86, 84), nh = nw * 0.34, rodH = nh * (CAP + 1.6);
        const pos = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / perRow), c = i % perRow, cnt = r === rows - 1 ? n - perRow * (rows - 1) : perRow;
          pos.push({ x: A.x + A.w / 2 + (c - (cnt - 1) / 2) * slot, base: A.y + A.h * (rows === 1 ? 0.72 : r === 0 ? 0.5 : 0.88) }); }
        return { pos, nw, nh, rodH };
      };
      function checkDone(i) {
        const b = s.st[i];
        if (b.length === CAP && b.every(c => c === b[0]) && !s.done.has(i)) {
          s.done.add(i); inst.progress++;
          const A = PG.arena, g = lay(A), p = g.pos[i];
          PG.reward({ score: 50, energy: 1, x: p.x, y: p.base - g.rodH });
          PG.burst(p.x, p.base - g.rodH * 0.6, COLS[b[0]], 16, 200); PG.sfx.loop(); PG.buzz(PG.HAP.success);
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
          g.pos.forEach((p, i) => { const d = Math.abs(x - p.x); if (d < g.nw * 0.75 && y > p.base - g.rodH - g.nh * 3 && y < p.base + g.nh * 2 && d < bd) { bd = d; hit = i; } });
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
          const g0 = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g0.addColorStop(0, '#EAF0FF'); g0.addColorStop(1, '#C9D6F2');
          ctx.fillStyle = g0; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt(String(inst.progress), A.x + A.w / 2, A.y + A.h * 0.16, Math.min(90, A.w * 0.25), 'rgba(255,255,255,0.8)', { font: FD });
          const g = lay(A);
          g.pos.forEach((p, i) => {
            const sh = i === s.shakeB && s.t - s.shakeT < 0.35 ? Math.sin((s.t - s.shakeT) * 60) * 4 : 0, x = p.x + sh;
            // wooden base and steel rod with thread
            ctx.fillStyle = '#B07A4C'; PG.rrect(x - g.nw * 0.75, p.base, g.nw * 1.5, g.nh * 0.9, 6); ctx.fill();
            ctx.fillStyle = '#8E5E37'; ctx.fillRect(x - g.nw * 0.75, p.base + g.nh * 0.55, g.nw * 1.5, g.nh * 0.35);
            const rw = g.nw * 0.2, top = p.base - g.rodH;
            const rg = ctx.createLinearGradient(x - rw / 2, 0, x + rw / 2, 0); rg.addColorStop(0, '#8E99AE'); rg.addColorStop(0.4, '#F2F5FA'); rg.addColorStop(1, '#7A8599');
            ctx.fillStyle = rg; ctx.fillRect(x - rw / 2, top, rw, g.rodH);
            ctx.strokeStyle = 'rgba(90,100,120,0.45)'; ctx.lineWidth = 1;
            for (let y = top + 4; y < p.base; y += 5) { ctx.beginPath(); ctx.moveTo(x - rw / 2, y); ctx.lineTo(x + rw / 2, y + 2); ctx.stroke(); }
            // bolt head on top, golden when the bolt is complete
            ctx.fillStyle = s.done.has(i) ? '#F5B12E' : '#9AA4B8'; PG.rrect(x - rw * 1.1, top - g.nh * 0.5, rw * 2.2, g.nh * 0.55, 4); ctx.fill();
            if (s.done.has(i)) { const k = 0.5 + 0.5 * Math.sin(s.t * 5 + i); ctx.fillStyle = rgba('#FFFFFF', k); ctx.beginPath(); ctx.arc(x + rw, top - g.nh * 0.4, 3, 0, Math.PI * 2); ctx.fill(); }
            // nuts (the moving ones are drawn by the animation)
            const b = s.st[i];
            let count = b.length; if (s.anim && s.anim.to === i) count -= s.anim.k;
            for (let m = 0; m < count; m++) {
              let lift = 0; if (i === s.sel && m >= b.length - topRun(b)) lift = g.nh * (1.2 + 0.15 * Math.sin(s.t * 8));
              const y = p.base - g.nh * (m + 0.5) - lift;
              nut(ctx, x, y, g.nw, COLS[b[m]], s.spin[i][m] + (lift ? s.t * 6 : 0), m === count - 1);
            }
          });
          if (s.anim) {
            const a = s.anim, pf = g.pos[a.from], pt = g.pos[a.to], e = easeInOut(Math.min(1, a.t));
            for (let m = 0; m < a.k; m++) {
              const y0 = pf.base - g.nh * (a.fromH - m - 0.5) - g.nh * 1.2, y1 = pt.base - g.nh * (a.toH + m + 0.5);
              const arc = Math.min(pf.base, pt.base) - g.rodH - g.nh * (1.5 + m);
              const x = lerp(pf.x, pt.x, e), y = e < 0.5 ? lerp(y0, arc, e * 2) : lerp(arc, y1, (e - 0.5) * 2);
              nut(ctx, x, y, g.nw, COLS[a.col], s.t * 9 + m, m === a.k - 1);
            }
          }
        }
      });
      return inst;
    }
  });
})();

// Food Hunt — after Funfinity's Food Hunt (the Pixel Flow genre). Tap a squad of ants: it marches once around a
// pixel-art snack and eats the outermost blocks of its own colour. A squad with appetite left waits in a slot;
// when a squad comes back and every slot is taken, the round is lost. Eat the whole snack to win.
(function () {
  const PG = window.PG;
  const { INK, FD, FB, clamp, lerp, randi, shuffle, easeOutBack, easeOutCubic, circle, rrect, txt, rgba } = PG;
  const tone = typeof PG.tone === 'function' ? PG.tone : () => {};
  const ACCENT = '#EF6AA6';
  const COL = {
    r: '#F2615E', o: '#F28A3C', y: '#F5B12E', g: '#22B59B', b: '#9B6B4E',
    p: '#F47FB0', s: '#3E9BF0', v: '#7765EE', k: '#4A4060', c: '#FFE2A8'
  };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
  // Pixel snacks, easiest first. '.' is empty.
  const ARTS = [
    { name: 'Яблуко', rows: ['....b...', '...bgg..', '.rrbrrr.', 'rrrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rr.rr.'] },
    { name: 'Кавун', rows: ['rrrrrrrrrr', 'rrkrrrrkrr', 'rrrrkrrrrr', 'grrrrrrrrg', '.grkrrrrg.', '..grrrrg..', '...gggg...'] },
    { name: 'Полуниця', rows: ['..g.g.g..', '...ggg...', '.rrrgrrr.', 'rrryrrryr', 'rrrrrrrrr', 'ryrrryrrr', '.rrrrrrr.', '.rrryrrr.', '..rrrrr..', '...rrr...'] },
    { name: 'Пончик', rows: ['...yyyy...', '.yyppppyy.', '.ypspgppy.', 'yppppppspy', 'ypgp..ppyy', 'yppp..pgpy', 'ypsppppppy', '.yppgppsy.', '.yyppppyy.', '...yyyy...'] },
    { name: 'Піца', rows: ['ooooooooooo', 'oyyyyyyyyyo', '.yrryyyyry.', '.yrryygyyy.', '..yyyyrry..', '..ygyyrry..', '...yyyyy...', '...yrryy...', '....yyy....', '.....y.....'] },
    { name: 'Роли', rows: ['..kkkkkk..', '.kkcccckk.', 'kkcccccckk', 'kccooggcck', 'kccoooocck', 'kccoooocck', 'kccggoocck', 'kkcccccckk', '.kkcccckk.', '..kkkkkk..'] },
    { name: 'Морозиво', rows: ['....r....', '...ppp...', '..ppppp..', '.ppvppsp.', '.pspppvp.', '..ppppp..', '..yyyyy..', '..ybyby..', '...yyy...', '...yby...', '....y....'] },
    { name: 'Капкейк', rows: ['.....r....', '...pppp...', '..pppspp..', '.ppsppppp.', '.pppppspp.', 'pppppppppp', '.bybybyby.', '.bybybyby.', '..bybyby..', '..bybyby..', '..yyyyyy..'] },
    { name: 'Бургер', rows: ['..oooooo..', '.oocoocoo.', 'oooooooooo', 'gggggggggg', 'rrrrrrrrrr', 'bbbbbbbbbb', 'yyyyyyyyyy', '.oooooooo.', '..oooooo..'] }
  ];
  const artOf = lv => ARTS[(Math.max(1, lv) - 1) % ARTS.length];
  const sizeOf = art => art.rows.join('').replace(/\./g, '').length;

  /* ---- the rules, shared by the generator, the solver and the live game ---- */
  // One lap visits the four sides clockwise from the bottom-left corner: left side bottom-up, top side left to right,
  // right side top-down, bottom side right to left. At every row/column the squad looks straight into the snack.
  function lapShots(W, H) {
    const s = [];
    for (let r = H - 1; r >= 0; r--) s.push(0, r);
    for (let c = 0; c < W; c++) s.push(1, c);
    for (let r = 0; r < H; r++) s.push(2, r);
    for (let c = W - 1; c >= 0; c--) s.push(3, c);
    return s;
  }
  // The first block met looking in from a side, or -1.
  function firstIn(g, W, H, side, i) {
    if (side === 0) { for (let c = 0; c < W; c++) if (g[i * W + c] !== '.') return i * W + c; }
    else if (side === 1) { for (let r = 0; r < H; r++) if (g[r * W + i] !== '.') return r * W + i; }
    else if (side === 2) { for (let c = W - 1; c >= 0; c--) if (g[i * W + c] !== '.') return i * W + c; }
    else { for (let r = H - 1; r >= 0; r--) if (g[r * W + i] !== '.') return r * W + i; }
    return -1;
  }
  // A lone squad's lap: returns how many blocks it ate (the grid is changed in place).
  function simLap(g, W, H, shots, col, ammo) {
    let ate = 0;
    for (let k = 0; k < shots.length && ate < ammo; k += 2) {
      const i = firstIn(g, W, H, shots[k], shots[k + 1]);
      if (i >= 0 && g[i] === col) { g[i] = '.'; ate++; }
    }
    return ate;
  }
  // Squads in an order that a player can follow without ever parking: each one empties itself in a single lap.
  function planSquads(grid, W, H, shots, chunk) {
    const g = grid.slice(), seq = [];
    let left = g.filter(ch => ch !== '.').length, guard = 0;
    while (left > 0 && guard++ < 500) {
      const exposed = {};
      for (let k = 0; k < shots.length; k += 2) { const i = firstIn(g, W, H, shots[k], shots[k + 1]); if (i >= 0) exposed[g[i]] = (exposed[g[i]] || 0) + 1; }
      const cols = Object.keys(exposed);
      let t = Math.random() * cols.reduce((s, c) => s + exposed[c], 0), col = cols[0];
      for (const c of cols) { t -= exposed[c]; if (t <= 0) { col = c; break; } }
      const ate = simLap(g, W, H, shots, col, chunk[0] + randi(chunk[1] - chunk[0] + 1));
      if (!ate) continue;
      const last = seq[seq.length - 1];
      if (last && last.c === col && last.n + ate <= chunk[1]) {
        // a follow-up of the same colour joins the previous squad when it would still clear in one lap
        const g2 = grid.slice(); seq.forEach(q => simLap(g2, W, H, shots, q.c, q === last ? q.n + ate : q.n));
        if (g2.join('') === g.join('')) { last.n += ate; left -= ate; continue; }
      }
      seq.push({ c: col, n: ate }); left -= ate;
    }
    return seq;
  }
  // Depth-first search over lone laps: the moves that clear the queues with this many slots, or null. Greedy first.
  // A move is { i: queue index } or { i: -1, sq: a parked squad }.
  function solve(grid, W, H, shots, cols, nSlots, cap, ptr0, slots0) {
    let nodes = 0;
    const seen = new Set(), path = [];
    const go = (g, ptr, slots, left) => {
      if (!left) return true;
      if (++nodes > cap) return false;
      const key = g.join('') + '|' + ptr.join(',') + '|' + slots.map(s => s.c + s.n).sort().join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      const tries = [];
      cols.forEach((q, i) => { if (ptr[i] < q.length) tries.push({ i, j: -1, sq: q[ptr[i]] }); });
      slots.forEach((s, j) => tries.push({ i: -1, j, sq: s }));
      for (const t of tries) { t.g = g.slice(); t.ate = simLap(t.g, W, H, shots, t.sq.c, t.sq.n); }
      tries.sort((a, b) => b.ate - a.ate);
      for (const t of tries) {
        if (t.j >= 0 && !t.ate) continue;
        const s2 = slots.slice();
        if (t.j >= 0) s2.splice(t.j, 1);
        if (t.sq.n > t.ate) { if (s2.length >= nSlots) continue; s2.push({ c: t.sq.c, n: t.sq.n - t.ate }); }
        const p2 = ptr.slice(); if (t.i >= 0) p2[t.i]++;
        path.push({ i: t.i, sq: t.sq });
        if (go(t.g, p2, s2, left - t.ate)) return true;
        path.pop();
      }
      return false;
    };
    const ok = go(grid.slice(), ptr0 || cols.map(() => 0), slots0 || [], grid.filter(ch => ch !== '.').length);
    return ok ? path : null;
  }

  /* ---- drawing ---- */
  function block(ctx, x, y, s, ch) {
    const col = COL[ch] || INK;
    ctx.fillStyle = col; rrect(x + 0.6, y + 0.6, s - 1.2, s - 1.2, s * 0.2); ctx.fill();
    if (ch === 'c') { ctx.strokeStyle = 'rgba(155,107,78,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; rrect(x + s * 0.18, y + s * 0.14, s * 0.38, s * 0.16, s * 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.09)'; rrect(x + s * 0.14, y + s * 0.74, s * 0.72, s * 0.12, s * 0.06); ctx.fill();
  }
  // An ant facing +x, about 0.9·s long. ph animates the legs.
  function ant(ctx, x, y, s, ch, ang, ph) {
    const col = COL[ch] || INK;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(39,48,63,0.7)'; ctx.lineWidth = Math.max(1, s * 0.06); ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const sw = Math.sin(ph + i * 2.1) * s * 0.1, lx = i * s * 0.13;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + sw, -s * 0.34); ctx.moveTo(lx, 0); ctx.lineTo(lx - sw, s * 0.34); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(s * 0.34, -s * 0.06); ctx.quadraticCurveTo(s * 0.46, -s * 0.2, s * 0.52, -s * 0.16);
    ctx.moveTo(s * 0.34, s * 0.06); ctx.quadraticCurveTo(s * 0.46, s * 0.2, s * 0.52, s * 0.16); ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = ch === 'c' ? 'rgba(122,86,56,0.7)' : 'rgba(39,48,63,0.28)'; ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath(); ctx.ellipse(-s * 0.24, 0, s * 0.22, s * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    circle(0, 0, s * 0.1); ctx.fill(); ctx.stroke();
    circle(s * 0.22, 0, s * 0.13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.28, -s * 0.07, s * 0.09, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; circle(s * 0.27, -s * 0.06, s * 0.045); ctx.fill(); circle(s * 0.27, s * 0.06, s * 0.045); ctx.fill();
    ctx.fillStyle = INK; circle(s * 0.29, -s * 0.06, s * 0.022); ctx.fill(); circle(s * 0.29, s * 0.06, s * 0.022); ctx.fill();
    ctx.restore();
  }
  function badge(ctx, x, y, r, n, ch) {
    ctx.fillStyle = '#FFFFFF'; circle(x, y, r); ctx.fill();
    ctx.strokeStyle = COL[ch] || INK; ctx.lineWidth = Math.max(1.5, r * 0.18); circle(x, y, r - ctx.lineWidth / 2); ctx.stroke();
    txt(String(n), x, y + 0.5, r * (n > 9 ? 1.0 : 1.2), INK, { font: FD });
  }
  // A squad waiting in a queue or a slot: a white tile with the ant and its appetite.
  function tile(ctx, x, y, T, sq, alpha, glow) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(39,48,63,0.10)'; rrect(x - T / 2, y - T / 2 + 3, T, T, T * 0.26); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; rrect(x - T / 2, y - T / 2, T, T, T * 0.26); ctx.fill();
    ctx.fillStyle = sq.c === 'c' ? 'rgba(155,107,78,0.14)' : rgba(COL[sq.c], 0.16); rrect(x - T / 2 + 3, y - T / 2 + 3, T - 6, T - 6, T * 0.22); ctx.fill();
    if (glow) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 3; rrect(x - T / 2 - 3, y - T / 2 - 3, T + 6, T + 6, T * 0.3); ctx.stroke(); }
    ant(ctx, x - T * 0.04, y + T * 0.06, T * 0.78, sq.c, -Math.PI / 2, 0);
    badge(ctx, x + T * 0.3, y - T * 0.3, T * 0.2, sq.n, sq.c);
    ctx.globalAlpha = 1;
  }

  PG.arcade.register({
    id: 'foodhunt',
    title: 'Food Hunt',
    family: 'Головоломка',
    accent: ACCENT,
    howto: ['Тапни мурах: вони з’їдять свій колір', 'Хто не доїв, чекає в слоті'],
    goal: lv => ({ count: sizeOf(artOf(lv)), unit: 'шматочків' }),
    icon(ctx, x, y, r) {
      const s = r * 0.42;
      [['r', -1, -1], ['r', 0, -1], ['g', -1, 0], ['r', 0, 0]].forEach(([ch, i, j]) => block(ctx, x - r * 0.72 + (i + 1) * s, y - r * 0.62 + (j + 1) * s, s, ch));
      ant(ctx, x + r * 0.5, y + r * 0.38, r * 0.78, 'k', -Math.PI / 2 - 0.5, 0.6);
    },
    create(level, api) {
      const lv = Math.max(1, level | 0), art = artOf(lv);
      // Difficulty, all in one place. Level 1 (the apple) is a tutorial: two queues in a playable order, roomy squads,
      // five slots. Then more queues, squads moved ahead of their turn (they must wait in a slot), hungrier squads
      // that need two laps, and fewer slots. Every layout is checked by the solver before it is used.
      // Simulated, 200 rounds a level: a player tapping at random wins ~100% up to level 3, 70-95% at 4-9 and
      // 35-100% later (the burger and the cupcake are the hard ones); a careful player wins them all.
      const tier = lv <= 1 ? 0 : lv <= 2 ? 1 : lv <= 5 ? 2 : lv <= 9 ? 3 : 4;
      const D = {
        queues: [2, 2, 3, 4, 4][tier],
        slots: [5, 5, 4, 4, 3][tier],
        chunk: [[12, 18], [10, 16], [10, 18], [12, 22], [14, 24]][tier], // a squad's appetite, in blocks
        swaps: [0, 1, 3, 3, 4][tier],          // squads moved ahead of their turn
        merges: [0, 0, 3, 4, 6][tier],         // squads too hungry for one lap
        mirror: Math.floor((lv - 1) / ARTS.length) % 2 === 1,
        lapSec: lv <= 2 ? 4.2 : 3.8,          // one lap of the snack, whatever its size
        hint: lv <= 2                           // after a pause, point at a squad that can eat right now
      };
      if (api && api.tune) Object.assign(D, api.tune); // balance experiments
      const H = art.rows.length, W = art.rows[0].length;
      const grid = [];
      art.rows.forEach(row => { const r = D.mirror ? [...row].reverse() : [...row]; for (let c = 0; c < W; c++) grid.push(r[c] || '.'); });
      const SH = lapShots(W, H);

      // queues: the plan dealt into columns in order (always winnable), then mutations the solver still wins:
      // a squad moved up its queue, or two squads of one colour merged into a hungrier one
      const plan = planSquads(grid, W, H, SH, D.chunk);
      const queues = Array.from({ length: D.queues }, () => []);
      plan.forEach((sq, i) => {
        const short = queues.reduce((b, q, j) => q.length < queues[b].length ? j : b, 0);
        queues[i < D.queues ? i : Math.random() < 0.6 ? short : randi(D.queues)].push(Object.assign({}, sq));
      });
      const want = D.swaps + D.merges;
      for (let t = 0, done = 0; t < want * 5 && done < want; t++) {
        const keep = queues.map(q => q.map(sq => Object.assign({}, sq)));
        const q = queues[randi(D.queues)];
        if (Math.random() < D.merges / want) {
          if (!q.length) continue;
          const a = q[randi(q.length)], others = [];
          queues.forEach(o => o.forEach(b => { if (b !== a && b.c === a.c) others.push([o, b]); }));
          if (!others.length) continue;
          const [o, b] = others[randi(others.length)];
          // keep at least two squads a queue and appetites within reason
          if (a.n + b.n > D.chunk[1] * 1.6 || queues.reduce((n, x) => n + x.length, 0) <= D.queues * 2) continue;
          a.n += b.n; o.splice(o.indexOf(b), 1);
        } else {
          if (q.length < 2) continue;
          const i = randi(q.length - 1);
          [q[i], q[i + 1]] = [q[i + 1], q[i]];
        }
        if (solve(grid, W, H, SH, queues, D.slots, 1500)) done++;
        else keep.forEach((k, i) => { queues[i].length = 0; queues[i].push(...k); });
      }
      shuffle(queues);

      const slots = Array(D.slots).fill(null);
      const ants = [], eats = [];
      const S = { clk: 0, eatT: -9, idle: 0, winAt: 0, seq: 0, shake: [0, 0, 0, 0] };
      const inst = { progress: 0, over: null, stats: { level: lv, art: art.name, squads: plan.length, launches: 0, parks: 0 } };
      const V = {};
      // read by automated checks; solve() plans lone laps from the current state
      inst.dbg = { grid, W, H, queues, slots, ants, D, V, SH, simLap, solve: () => solve(grid, W, H, SH, queues, D.slots, 20000, queues.map(() => 0), slots.filter(Boolean)) };

      /* ---- geometry, from the arena every frame ---- */
      function geo(A) {
        // the board leaves room for the path, the ants on it and their badges: 2.4 cells above, 1.6 below
        const pad = 10, bottom = 28, boardH = A.h * 0.6;
        const cs = Math.min(30, (A.w - pad * 2) / (W + 3.4), (boardH - pad) / (H + 4));
        const m = cs * 1.15, iw = W * cs, ih = H * cs;
        V.cs = cs; V.m = m; V.iw = iw; V.ih = ih;
        V.ix = A.x + (A.w - iw) / 2; V.iy = A.y + pad + 2.4 * cs + (boardH - pad - (H + 4) * cs) / 2;
        V.K = Math.PI / 2 * m / cs; // a corner, in cells
        V.len = 2 * W + 2 * H + 4 * V.K;
        V.shotU = [];
        for (let k = 0; k < SH.length; k += 2) {
          const side = SH[k], n = k / 2;
          const at = side === 0 ? V.K + (n + 0.5)
            : side === 1 ? 2 * V.K + H + (n - H + 0.5)
              : side === 2 ? 3 * V.K + H + W + (n - H - W + 0.5)
                : 4 * V.K + 2 * H + W + (n - 2 * H - W + 0.5);
          V.shotU.push(at);
        }
        const sz = Math.min(46, (A.w - pad * 2) / (D.slots + 1.8));
        V.slot = sz; V.slotY = A.y + boardH + sz / 2 + 10;
        V.slotX = j => A.x + A.w / 2 + (j - (D.slots - 1) / 2) * sz * 1.18;
        const top = V.slotY + sz / 2 + 16, room = A.y + A.h - bottom - top;
        V.T = Math.max(26, Math.min(62, (A.w - pad * 2) / D.queues * 0.72, (room - 4) / 2.65));
        V.qY = top + V.T / 2 + 4;
        V.qX = i => A.x + A.w / 2 + (i - (D.queues - 1) / 2) * Math.min((A.w - pad * 2) / D.queues, V.T * 1.7);
        return V;
      }
      // a point on the path at u cells from the start (the ant hill at the bottom-left corner), plus its heading
      function pos(u) {
        const { ix, iy, iw, ih, m, cs, K } = V;
        u = ((u % V.len) + V.len) % V.len;
        const arc = (cx, cy, a0, f) => { const a = a0 + f * Math.PI / 2; return [cx + Math.cos(a) * m, cy + Math.sin(a) * m, a + Math.PI / 2]; };
        if (u < K) return arc(ix, iy + ih, Math.PI / 2, u / K);
        u -= K; if (u < H) return [ix - m, iy + ih - u * cs, -Math.PI / 2];
        u -= H; if (u < K) return arc(ix, iy, Math.PI, u / K);
        u -= K; if (u < W) return [ix + u * cs, iy - m, 0];
        u -= W; if (u < K) return arc(ix + iw, iy, -Math.PI / 2, u / K);
        u -= K; if (u < H) return [ix + iw + m, iy + u * cs, Math.PI / 2];
        u -= H; if (u < K) return arc(ix + iw, iy + ih, 0, u / K);
        u -= K; return [ix + iw - u * cs, iy + ih + m, Math.PI];
      }
      const cellXY = i => [V.ix + (i % W + 0.5) * V.cs, V.iy + (Math.floor(i / W) + 0.5) * V.cs];

      /* ---- play ---- */
      function launch(sq, from) {
        if (ants.filter(a => a.state === 'walk').length >= 6) { PG.sfx.tick(); return false; }
        ants.push({ c: sq.c, n: sq.n, from, p: 0, u: 0, k: 0, ph: Math.random() * 6, state: 'walk', ate: 0, seq: ++S.seq });
        inst.stats.launches++; S.idle = 0;
        PG.sfx.pick(); PG.buzz(PG.HAP.tick);
        return true;
      }
      function eat(a, i) {
        grid[i] = '.'; a.n--; a.ate++; inst.progress++;
        const [x, y] = cellXY(i);
        eats.push({ i, ch: a.c, t0: S.clk, x, y, a });
        PG.burst(x, y, COL[a.c], 2, 70);
        if (S.clk - S.eatT > 0.045) { S.eatT = S.clk; tone(NOTES[Math.min(a.ate - 1, NOTES.length - 1)], 0.06, 'triangle', 0.05); PG.buzz(PG.HAP.tick); }
        PG.reward({ score: 2 });
      }
      function fail(a) {
        a.state = 'stuck';
        inst.over = { won: false, cause: 'slots' };
        PG.sfx.die(); PG.shake(5);
      }
      function stepAnt(a, dt) {
        a.ph += dt * 16;
        if (a.state === 'walk') { // from the queue or slot to the ant hill
          a.p += dt / 0.3;
          const ahead = ants.find(b => b.state === 'walk' && b.seq < a.seq); // first come, first on the path
          if (a.p >= 1 && !ahead && !ants.some(b => b.state === 'lap' && b.u < 1.7)) { a.state = 'lap'; a.u = 0; a.k = 0; }
          a.p = Math.min(a.p, 1);
          return;
        }
        if (a.state === 'lap') {
          a.u += V.len / D.lapSec * dt;
          while (a.k < V.shotU.length && V.shotU[a.k] <= a.u && a.n > 0) {
            const i = firstIn(grid, W, H, SH[a.k * 2], SH[a.k * 2 + 1]);
            if (i >= 0 && grid[i] === a.c) eat(a, i);
            a.k++;
          }
          if (a.n === 0) { a.state = 'full'; a.t0 = S.clk; PG.sfx.pop(); PG.buzz(PG.HAP.light); return; }
          if (a.u >= V.len) {
            const j = slots.findIndex(s => !s);
            if (j < 0) { fail(a); return; }
            slots[j] = { c: a.c, n: a.n, at: S.clk + 0.3 };
            a.state = 'park'; a.slot = j; a.t0 = S.clk; inst.stats.parks++;
            PG.sfx.back(); PG.buzz(PG.HAP.soft);
            if (slots.every(Boolean)) S.warnAt = S.clk;
          }
          return;
        }
        if ((a.state === 'park' && S.clk - a.t0 > 0.3) || (a.state === 'full' && S.clk - a.t0 > 0.4)) a.state = 'gone';
      }
      function useful(sq) { return simLap(grid.slice(), W, H, SH, sq.c, sq.n) > 0; }

      inst.idle = (dt, A) => { S.clk += dt; geo(A); };
      inst.tap = (x, y) => {
        if (inst.over || !V.cs) return;
        // a waiting squad in a slot
        for (let j = 0; j < D.slots; j++) {
          const s = slots[j];
          if (!s || S.clk < s.at || Math.abs(x - V.slotX(j)) > V.slot * 0.6 || Math.abs(y - V.slotY) > V.slot * 0.6) continue;
          if (launch(s, { slot: j })) slots[j] = null;
          return;
        }
        // the front squad of a queue
        for (let i = 0; i < D.queues; i++) {
          if (Math.abs(x - V.qX(i)) > V.T * 0.75 || y < V.qY - V.T * 0.7 || y > V.qY + V.T * 2.4) continue;
          const q = queues[i];
          if (!q.length) return;
          if (y > V.qY + V.T * 0.6) { S.shake[i] = S.clk; PG.sfx.tick(); return; } // only the front squad can go
          if (launch(q[0], { queue: i })) { q.shift(); S.slide = S.slide || []; S.slide[i] = S.clk; }
          return;
        }
      };
      inst.update = (dt, A) => {
        S.clk += dt; geo(A);
        if (inst.over && !inst.over.won) return;
        for (const a of ants) stepAnt(a, dt);
        for (let i = ants.length - 1; i >= 0; i--) if (ants[i].state === 'gone') ants.splice(i, 1);
        for (let i = eats.length - 1; i >= 0; i--) if (S.clk - eats[i].t0 > 0.3) eats.splice(i, 1);
        if (!ants.length) S.idle += dt; else S.idle = 0;
      };
      inst.win = () => {
        S.winAt = S.clk;
        const [x, y] = [V.ix + V.iw / 2, V.iy + V.ih / 2];
        PG.floatText(x, y, `${art.name}: ням!`, ACCENT, 24);
        if (!inst.stats.parks) { PG.reward({ energy: 1, x, y: y + 34 }); PG.floatText(x, y - 34, 'БЕЗ ЖОДНОГО СЛОТА!', INK, 16); }
      };

      inst.draw = (ctx, A) => {
        geo(A);
        const { ix, iy, iw, ih, m, cs } = V;
        // picnic blanket
        ctx.fillStyle = '#FFF5EC'; ctx.fillRect(A.x, A.y, A.w, A.h);
        const st = 26;
        ctx.fillStyle = 'rgba(239,106,166,0.07)';
        for (let x = A.x + st / 2; x < A.x + A.w; x += st * 2) ctx.fillRect(x, A.y, st, A.h);
        for (let y = A.y + st / 2; y < A.y + A.h; y += st * 2) ctx.fillRect(A.x, y, A.w, st);
        // the path the ants walk, and the plate
        ctx.strokeStyle = '#F0DFC9'; ctx.lineWidth = cs * 0.95; ctx.lineJoin = 'round';
        rrect(ix - m, iy - m, iw + 2 * m, ih + 2 * m, m); ctx.stroke();
        ctx.strokeStyle = '#E2C9A6'; ctx.lineWidth = Math.max(1.5, cs * 0.08); ctx.setLineDash([cs * 0.25, cs * 0.45]);
        rrect(ix - m, iy - m, iw + 2 * m, ih + 2 * m, m); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.shadowColor = 'rgba(39,48,63,0.12)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#FFFFFF'; rrect(ix - cs * 0.3, iy - cs * 0.3, iw + cs * 0.6, ih + cs * 0.6, cs * 0.5); ctx.fill(); ctx.restore();
        // the snack
        for (let i = 0; i < grid.length; i++) {
          const x = ix + (i % W) * cs, y = iy + Math.floor(i / W) * cs;
          if (grid[i] !== '.') { block(ctx, x, y, cs, grid[i]); continue; }
          ctx.fillStyle = 'rgba(39,48,63,0.07)'; circle(x + cs / 2, y + cs / 2, cs * 0.06); ctx.fill();
        }
        // bites flying to the ant that took them
        for (const e of eats) {
          const k = clamp((S.clk - e.t0) / 0.25, 0, 1), [ax, ay] = e.a.state === 'lap' ? pos(e.a.u) : [e.x, e.y];
          const s = cs * (1 - k * 0.8);
          ctx.globalAlpha = 1 - k * 0.6; block(ctx, lerp(e.x, ax, easeOutCubic(k)) - s / 2, lerp(e.y, ay, easeOutCubic(k)) - s / 2, s, e.ch); ctx.globalAlpha = 1;
        }
        // the ant hill where every lap starts and ends
        const [hx, hy] = pos(0);
        ctx.fillStyle = '#C79A6E'; ctx.beginPath(); ctx.ellipse(hx, hy + cs * 0.15, cs * 0.9, cs * 0.55, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#7A5638'; ctx.beginPath(); ctx.ellipse(hx, hy - cs * 0.05, cs * 0.28, cs * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        // slots
        const full = slots.filter(Boolean).length, warn = full >= D.slots - 1;
        txt(`Слоти ${full}/${D.slots}`, A.x + A.w / 2, V.slotY - V.slot / 2 - 9, 11.5, warn ? PG.BAD : PG.SOFT, { font: FB, weight: 900 });
        for (let j = 0; j < D.slots; j++) {
          const x = V.slotX(j), y = V.slotY, s = slots[j];
          ctx.fillStyle = '#F4E9DC'; rrect(x - V.slot / 2, y - V.slot / 2, V.slot, V.slot, V.slot * 0.26); ctx.fill();
          ctx.strokeStyle = warn ? rgba(PG.BAD, 0.45 + 0.35 * Math.sin(S.clk * 7)) : '#E6D3BC'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
          if (s && S.clk >= s.at) tile(ctx, x, y, V.slot * 0.92, s, 1, S.hint === s);
        }
        // queues: the front squad is tappable, the next two peek out behind it
        for (let i = 0; i < D.queues; i++) {
          const q = queues[i], x0 = V.qX(i);
          const sl = S.slide && S.slide[i] != null ? 1 - easeOutCubic(clamp((S.clk - S.slide[i]) / 0.22, 0, 1)) : 0;
          const sh = S.shake[i] && S.clk - S.shake[i] < 0.25 ? Math.sin((S.clk - S.shake[i]) * 60) * 4 : 0;
          for (let d = Math.min(q.length, 3) - 1; d >= 0; d--) {
            const y = V.qY + (d + sl) * V.T * 0.9, sc = Math.pow(0.8, d + sl);
            tile(ctx, x0 + (d === 0 ? sh : 0), y, V.T * sc, q[d], d === 0 ? 1 : 0.62 - d * 0.12, d === 0 && S.hint === q[0]);
          }
          if (q.length > 3) txt(`+${q.length - 3}`, x0, V.qY + V.T * 2.45, 11.5, PG.SOFT, { font: FB, weight: 900 });
          if (!q.length) { ctx.strokeStyle = '#EADCCB'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); rrect(x0 - V.T / 2, V.qY - V.T / 2, V.T, V.T, V.T * 0.26); ctx.stroke(); ctx.setLineDash([]); }
        }
        // ants: on the way to the hill, on the lap, parking, or full and happy
        const as = Math.max(14, cs * 1.35);
        for (const a of ants) {
          let x, y, ang = -Math.PI / 2, s = as;
          if (a.state === 'walk') {
            const src = a.from.slot != null ? [V.slotX(a.from.slot), V.slotY] : [V.qX(a.from.queue), V.qY];
            const k = easeOutCubic(a.p); x = lerp(src[0], hx, k); y = lerp(src[1], hy, k) - Math.sin(k * Math.PI) * 18;
            ang = Math.atan2(hy - src[1], hx - src[0]);
          } else if (a.state === 'lap' || a.state === 'stuck') {
            [x, y, ang] = pos(a.u);
          } else if (a.state === 'park') {
            const k = easeOutCubic(clamp((S.clk - a.t0) / 0.3, 0, 1)), [px, py] = pos(0);
            x = lerp(px, V.slotX(a.slot), k); y = lerp(py, V.slotY, k) - Math.sin(k * Math.PI) * 16; s = lerp(as, V.slot * 0.7, k);
          } else if (a.state === 'full') {
            const k = clamp((S.clk - a.t0) / 0.4, 0, 1);
            [x, y, ang] = pos(a.u); y -= easeOutBack(k) * cs * 0.8; ctx.globalAlpha = 1 - k;
          } else continue;
          if (S.winAt) y -= Math.abs(Math.sin((S.clk - S.winAt) * 9 + a.ph)) * 5;
          ant(ctx, x, y, s, a.c, ang, a.state === 'stuck' ? 0 : a.ph);
          if (a.state !== 'full' && a.state !== 'park') badge(ctx, x, y - s * 0.62, Math.max(8, s * 0.26), a.n, a.c);
          if (a.state === 'stuck') txt('!', x + s * 0.5, y - s * 0.6, s * 0.7, PG.BAD, { font: FD });
          ctx.globalAlpha = 1;
        }
        // first levels: after a pause, point at a squad that can eat right now
        S.hint = null;
        if (D.hint && !inst.over && S.idle > 3.5) {
          S.hint = slots.find(s => s && S.clk >= s.at && useful(s)) || queues.map(q => q[0]).find(sq => sq && useful(sq)) || null;
          if (S.hint) {
            const j = slots.indexOf(S.hint), qi = queues.findIndex(q => q[0] === S.hint);
            const [x, y] = j >= 0 ? [V.slotX(j), V.slotY] : [V.qX(qi), V.qY];
            const r = (j >= 0 ? V.slot : V.T) * (0.75 + 0.06 * Math.sin(S.clk * 6));
            ctx.strokeStyle = rgba(ACCENT, 0.6); ctx.lineWidth = 3; circle(x, y, r); ctx.stroke();
            txt('Тап!', x, y - r - 9, 13, ACCENT, { font: FD });
          }
        }
        if (inst.over && !inst.over.won) {
          ctx.fillStyle = 'rgba(255,245,236,0.55)'; ctx.fillRect(A.x, V.slotY - V.slot, A.w, V.slot * 2);
          txt('Слоти заповнені', A.x + A.w / 2, V.slotY, 20, PG.BAD, { font: FD });
        }
      };
      return inst;
    }
  });
})();

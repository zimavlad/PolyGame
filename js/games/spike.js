// Spike Rush — after Don't Touch the Spikes (Ketchapp). Tap to flap, bounce wall to wall, avoid the spikes.
(function () {
  const PG = window.PG;
  const { PAL, INK, SPIKE, FD, clamp, randi, shuffle, easeOutBack, circle, txt, dot } = PG;
  const BG = ['#E9EDF2', '#F4E4E2', '#E0F0EA', '#E8E5F6', '#F5EDDA', '#DEEAF5'];

  function drawBird(ctx, x, y, r, dir, flapAt, spin) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    if (spin) ctx.rotate(spin);
    const fk = clamp((PG.now - flapAt) / 0.25, 0, 1);
    ctx.fillStyle = PAL[0]; circle(0, 0, r); ctx.fill();
    ctx.fillStyle = PAL[1];
    ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.12); ctx.lineTo(r * 1.38, r * 0.1); ctx.lineTo(r * 0.8, r * 0.32); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(-r * 0.15, r * 0.18); ctx.rotate(-0.9 * (1 - fk) + 0.15);
    ctx.fillStyle = '#D94845'; ctx.beginPath(); ctx.ellipse(-r * 0.28, 0, r * 0.5, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FFFFFF'; circle(r * 0.35, -r * 0.28, r * 0.3); ctx.fill();
    ctx.fillStyle = INK; circle(r * 0.43, -r * 0.26, spin ? r * 0.06 : r * 0.14); ctx.fill();
    ctx.restore();
  }
  function triSign(px, py, ax, ay, bx, by) { return (px - bx) * (ay - by) - (ax - bx) * (py - by); }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function circleTri(cx, cy, r, t) {
    const [ax, ay, bx, by, qx, qy] = t;
    const s1 = triSign(cx, cy, ax, ay, bx, by), s2 = triSign(cx, cy, bx, by, qx, qy), s3 = triSign(cx, cy, qx, qy, ax, ay);
    const neg = s1 < 0 || s2 < 0 || s3 < 0, pos = s1 > 0 || s2 > 0 || s3 > 0;
    if (!(neg && pos)) return true;
    return segDist(cx, cy, ax, ay, bx, by) < r || segDist(cx, cy, bx, by, qx, qy) < r || segDist(cx, cy, qx, qy, ax, ay) < r;
  }

  PG.arcade.register({
    id: 'spike',
    title: 'Spike Rush',
    family: 'Ketchapp',
    accent: PAL[0],
    howto: ['Тапай, щоб пташка підлетіла', 'Відбивайся від стін, не торкайся шипів'],
    goal: lv => ({ count: Math.min(6 + lv * 2, 26), unit: 'відбиттів' }),
    icon(ctx, x, y, r) { drawBird(ctx, x - r * 0.1, y, r * 0.62, 1, -9, 0); },
    create(level, api) {
      // Level 1 is gentle: slow flight, one spike, a four-slot gap. Each level adds a little.
      const speed = Math.min(0.62 + (level - 1) * 0.035, 0.98); // arena widths per second
      const gap = level <= 2 ? 4 : 3;
      const base = level === 1 ? 1 : level <= 3 ? 2 : 3;
      const per = level <= 2 ? 3 : 2;            // bounces per extra spike within a round
      const extra = Math.round((api.fill || 0) * 1.5); // a crowded puzzle board makes the rush harder
      const g = { nx: 0.5, ny: 0.45, vy: 0, dir: 1, slots: 0, spikes: { L: [], R: [] }, candy: null, flapAt: -9, spin: 0 };
      const inst = { progress: 0, over: null, stats: { flaps: 0, candies: 0, level } };

      function geo(A) {
        const r = A.w * 0.045, sh = Math.max(14, A.w * 0.06);
        if (!g.slots) { g.slots = clamp(Math.round((A.h - 2 * sh - r * 1.2) / (r * 2.8)), 7, 13); gen('R'); }
        const top = A.y + sh + r * 0.6, bot = A.y + A.h - sh - r * 0.6;
        return { r, sh, top, slotH: (bot - top) / g.slots };
      }
      function gen(side) {
        const n = g.slots, other = side === 'R' ? 'L' : 'R';
        const k = Math.min(base + Math.floor(inst.progress / per) + extra, n - gap);
        const start = randi(n - gap + 1), pool = [];
        for (let i = 0; i < n; i++) if (i < start || i >= start + gap) pool.push(i);
        shuffle(pool);
        g.spikes[side] = pool.slice(0, k).map(i => ({ i, born: PG.now }));
        g.spikes[other].forEach(s => { if (!s.dying) s.dying = PG.now; });
      }
      function tri(A, side, s) {
        const { r, top, slotH } = geo(A);
        let e = clamp((PG.now - s.born) / 0.16, 0, 1);
        if (s.dying) e = Math.min(e, 1 - clamp((PG.now - s.dying) / 0.16, 0, 1));
        const cy = top + (s.i + 0.5) * slotH, hb = slotH * 0.42, d = r * 1.35 * e;
        const wx = side === 'L' ? A.x : A.x + A.w, tx = side === 'L' ? wx + d : wx - d;
        return [wx, cy - hb, wx, cy + hb, tx, cy, d];
      }
      function hitSpike(A, px, py, r) {
        const side = g.dir === 1 ? 'R' : 'L';
        for (const s of g.spikes[side]) {
          if (s.dying) continue;
          const t = tri(A, side, s);
          if (t[6] < 2) continue; // still sliding out
          if (circleTri(px, py, r * 0.8, t)) return true;
        }
        return false;
      }
      function spawnCandy() { g.candy = { nx: g.dir === 1 ? 0.78 : 0.22, slot: randi(g.slots), color: randi(4), born: PG.now }; }
      function die(A, cause) {
        inst.over = { won: false, cause };
        g.vy = -0.5;
        PG.sfx.die(); PG.shake(8);
        PG.burst(A.x + g.nx * A.w, A.y + g.ny * A.h, PAL[0], 14, 200);
      }

      inst.idle = (dt, A) => { geo(A); g.ny = 0.45 + Math.sin(PG.now * 4) * 0.012; };
      inst.start = () => { spawnCandy(); };
      inst.tap = () => {
        if (inst.over) return;
        g.vy = -0.66; g.flapAt = PG.now; inst.stats.flaps++; PG.sfx.flap();
      };
      inst.win = () => { ['L', 'R'].forEach(sd => g.spikes[sd].forEach(s => { if (!s.dying) s.dying = PG.now; })); g.candy = null; };
      inst.update = (dt, A) => {
        const { r, sh, top, slotH } = geo(A);
        if (inst.over) {
          if (inst.over.won) { g.ny += (0.45 - g.ny) * Math.min(1, dt * 4); return; }
          g.vy += 2.3 * dt; g.ny += g.vy * dt; g.spin += dt * 10; return;
        }
        const spd = speed * (1 + Math.min(inst.progress, 20) * 0.015);
        g.vy += 2.3 * dt; g.ny += g.vy * dt; g.nx += g.dir * spd * dt;
        const rn = r / A.w;
        const wall = g.nx + rn >= 1 ? 'R' : g.nx - rn <= 0 ? 'L' : null;
        if (wall) g.nx = wall === 'R' ? 1 - rn : rn;
        const px = A.x + g.nx * A.w, py = A.y + g.ny * A.h;
        // hit test before the bounce, so the contact frame is checked against the wall just reached
        const hitTop = py - r * 0.8 < A.y + sh, hitBottom = py + r * 0.8 > A.y + A.h - sh;
        if (hitTop || hitBottom || hitSpike(A, px, py, r)) { die(A, hitTop ? 'ceiling' : hitBottom ? 'floor' : 'spike'); return; }
        if (wall) {
          g.dir = wall === 'R' ? -1 : 1;
          inst.progress++;
          PG.reward({ score: 10 }); PG.sfx.wall(); PG.buzz(PG.HAP.tick);
          PG.burst(wall === 'R' ? A.x + A.w : A.x, py, '#FFFFFF', 6, 120);
          gen(wall === 'R' ? 'L' : 'R');
          if (!g.candy && Math.random() < 0.6) spawnCandy();
        }
        if (g.candy) {
          const cx = A.x + g.candy.nx * A.w, cy = top + (g.candy.slot + 0.5) * slotH;
          if (Math.hypot(px - cx, py - cy) < r * 1.7) {
            inst.stats.candies++;
            PG.reward({ energy: 1, score: 25, x: cx, y: cy - 20 });
            PG.sfx.candy(); PG.buzz(PG.HAP.double);
            PG.burst(cx, cy, PAL[g.candy.color], 12, 160);
            g.candy = null;
          }
        }
      };
      inst.draw = (ctx, A) => {
        const { r, sh, top, slotH } = geo(A);
        const bg = BG[Math.floor(inst.progress / 5) % BG.length];
        ctx.fillStyle = bg; ctx.fillRect(A.x, A.y, A.w, A.h);
        const cx = A.x + A.w / 2, cy = A.y + A.h * 0.45, R = A.w * 0.24;
        ctx.fillStyle = 'rgba(255,255,255,0.78)'; circle(cx, cy, R); ctx.fill();
        txt(String(inst.progress).padStart(2, '0'), cx, cy + R * 0.04, R * 0.72, 'rgba(39,48,63,0.13)', { font: FD });
        const n = Math.max(6, Math.round(A.w / (sh * 1.05))), sw = A.w / n;
        ctx.fillStyle = SPIKE;
        ctx.fillRect(A.x, A.y, A.w, 3); ctx.fillRect(A.x, A.y + A.h - 3, A.w, 3);
        for (let i = 0; i < n; i++) {
          const x0 = A.x + i * sw;
          ctx.beginPath(); ctx.moveTo(x0, A.y); ctx.lineTo(x0 + sw, A.y); ctx.lineTo(x0 + sw / 2, A.y + sh); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x0, A.y + A.h); ctx.lineTo(x0 + sw, A.y + A.h); ctx.lineTo(x0 + sw / 2, A.y + A.h - sh); ctx.closePath(); ctx.fill();
        }
        for (const side of ['L', 'R']) for (const s of g.spikes[side]) {
          const t = tri(A, side, s); if (t[6] < 0.5) continue;
          ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[2], t[3]); ctx.lineTo(t[4], t[5]); ctx.closePath(); ctx.fill();
        }
        if (g.candy) {
          const k = easeOutBack(clamp((PG.now - g.candy.born) / 0.3, 0, 1));
          const x = A.x + g.candy.nx * A.w, y = top + (g.candy.slot + 0.5) * slotH + Math.sin(PG.now * 5) * 3;
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(x, y, r * 0.95 * k); ctx.fill();
          dot(x, y, r * 0.68 * k, PAL[g.candy.color]);
        }
        drawBird(ctx, A.x + g.nx * A.w, A.y + g.ny * A.h, r, g.dir, g.flapAt, inst.over && !inst.over.won ? g.spin : 0);
      };
      return inst;
    }
  });
})();

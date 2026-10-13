// ППО — Missile Command (Atari, 1980) as a fake playable ad: tap the sky to burst interceptors and keep the city up for 20 s.
(function () {
  const PG = window.PG;
  const { PAL, INK, FD, clamp, lerp, rand, easeOutCubic, circle, rrect, txt, shuffle } = PG;
  const TIME = 20, LOSE_AT = 4, MAX_SHOTS = 6, FUSE = 0.07;
  // waves: [start s, missiles, fall time s]; two lone slow ones first, the last wave is still in the air at the win
  const WAVES = [[0.8, 1, 5.4], [3.3, 1, 5.0], [5.4, 2, 4.6], [7.6, 2, 4.3], [9.6, 2, 4.1], [11.6, 3, 3.9], [13.6, 2, 3.7], [15.2, 3, 3.5], [16.9, 2, 3.3]];
  const SKY = ['#B9B3EE', '#E6C2DF', '#FAD9C6'], SUN = '#FFE2B8', FAR = 'rgba(150,138,210,0.28)', GROUND = '#7B75AF', GROUND_HI = '#958FC7';
  const BLD = ['#7F74D9', '#36A994', '#E9767A', '#5C8FD6', '#E3A23A', '#A06CC9'];
  const RUIN = '#6E7389', RUIN_D = '#4A4F63', LIT = '#FFE6A0', LIT_WIN = '#FFF4CC', DARK_WIN = 'rgba(39,48,63,0.2)';
  const TURRET = '#525C82', TURRET_D = '#3B4263', BODY = '#2E3446', TIP = '#FF9E57', TRAIL = '255,255,255', SMOKE = '108,110,134';
  // explosion rings: radius (share of the unit size), grow, hold and fade times
  const RING = { R: 0.15, g: 0.16, h: 0.3, f: 0.3 }, CHAIN = { R: 0.075, g: 0.1, h: 0.12, f: 0.2 }, SALUTE = { R: 0.12, g: 0.2, h: 0.15, f: 0.5 };
  const DASH = [5, 6], SOLID = [];

  PG.ads.register({
    id: 'ppo',
    title: 'ППО',
    hook: '99% не втримають небо 20\u00A0секунд!', // the no-break space keeps "20 секунд" on one line
    create() {
      const heights = shuffle([0.17, 0.22, 0.27, 0.19, 0.24, 0.31]), colors = shuffle(BLD.slice());
      const buildings = [0, 1, 2, 4, 5, 6].map((slot, i) => {
        const hk = heights[i], rows = Math.max(3, Math.round(hk / 0.046)), cols = Math.random() < 0.5 ? 2 : 3;
        return {
          slot, hk, wk: rand(0.68, 0.84), dx: rand(-0.05, 0.05), color: colors[i], rows, cols, roof: i % 3,
          lit: Array.from({ length: rows * cols }, () => Math.random() < 0.78), down: false, downAt: 0, x: 0, y: 0, w: 0, h: 0
        };
      });
      const stars = Array.from({ length: 14 }, () => ({ x: Math.random(), y: rand(0.05, 0.4), r: rand(0.8, 1.7), p: rand(0, 6) }));
      const clouds = [0.3, 0.52, 0.7].map((y, i) => ({ x: (i * 0.41 + Math.random() * 0.2) % 1, y, s: rand(0.75, 1.1), v: rand(0.006, 0.012) }));
      // a pale far skyline behind the city: [x, width, height] in shares of the width and the unit size
      const far = [];
      for (let x = -0.02; x < 1; x += far[far.length - 1][1] + 0.01) far.push([x, rand(0.07, 0.12), rand(0.1, 0.2)]);
      // when each missile appears and how long it falls
      const plan = [];
      for (const [at, n, fall] of WAVES) for (let i = 0; i < n; i++) plan.push({ at: at + i * rand(0.35, 0.55), fall: fall + rand(-0.15, 0.15), lead: i === 0 });
      const missiles = [], shots = [], rings = [];
      const H = { sx: 0, sy: 0, x: 0, y: 0 }, V = { u: 1, gh: 0, base: 0, sw: 0, lr: 0, lx: 0, ly: 0, sky: null, skyY: -1, skyH: -1 };
      let t = 0, clk = 0, next = 0, down = 0, killed = 0, fired = 0, state = 'play', endT = 0, endAt = 0;
      let aim = -Math.PI / 2, aimTo = -Math.PI / 2, lastShot = -9, salutes = 0, tick = 3, lastA = null;
      const inst = { over: null, hint: 'Тапай у небо, щоб збити ракету' };

      function geo(A) {
        V.u = Math.max(80, Math.min(A.w, A.h * 0.75));
        V.gh = Math.max(14, V.u * 0.05);
        V.base = A.y + A.h - V.gh;
        V.sw = A.w / 7;
        V.lr = Math.min(V.sw * 0.34, V.u * 0.055);
        V.lx = A.x + A.w / 2; V.ly = V.base - V.lr * 0.5;
        for (const b of buildings) {
          b.w = V.sw * b.wk; b.h = V.u * b.hk;
          b.x = A.x + (b.slot + 0.5 + b.dx) * V.sw - b.w / 2; b.y = V.base - b.h;
        }
        return V;
      }
      // interceptor flight time to a point on screen: 0.26 s close by, about 0.45 s to the far corners of the sky
      const fly = (x, y, A) => clamp(0.22 + 0.24 * Math.hypot(x - V.lx, y - V.ly) / A.h, 0.26, 0.46);
      inst.dbg = { missiles, buildings, shots, rings, V, t: 0, state, fly: (x, y, A) => (geo(A), fly(x, y, A)) }; // read by automated checks

      function spawn(p) {
        const up = buildings.filter(b => !b.down);
        if (!up.length) return;
        // prefer a building nothing is flying at yet
        const free = up.filter(b => !missiles.some(m => m.alive && buildings[m.b] === b));
        const b = PG.pick(free.length ? free : up), bx = (b.slot + 0.5 + b.dx) / 7;
        let sx = 0.5;
        for (let k = 0; k < 8; k++) {
          sx = clamp(bx + rand(-0.5, 0.5), 0.06, 0.94);
          if (!missiles.some(m => m.alive && Math.abs(m.sx - sx) < 0.16)) break;
        }
        missiles.push({ sx, b: buildings.indexOf(b), off: rand(-0.22, 0.22), t0: t, fall: p.fall, alive: true, hit: false, deadAt: 0, x: 0, y: -99, vx: 0, vy: 0, x0: 0, y0: 0 });
        if (p.lead && PG.tone) PG.tone(980, 0.45, 'sine', 0.025, 0, 0.55); // a soft falling whistle as a wave comes in
      }
      function place(m, A) {
        const b = buildings[m.b], k = (t - m.t0) / m.fall;
        m.x0 = A.x + m.sx * A.w; m.y0 = A.y - 10;
        const tx = b.x + b.w * (0.5 + m.off), ty = b.y + 1;
        m.vx = (tx - m.x0) / m.fall; m.vy = (ty - m.y0) / m.fall;
        m.x = m.x0 + m.vx * m.fall * k; m.y = m.y0 + m.vy * m.fall * k;
        return k;
      }
      // where a shot starts (the barrel tip) and where its head is now, into H
      function head(s, A) {
        const tx = A.x + s.tx * A.w, ty = A.y + s.ty * A.h, d = Math.hypot(tx - V.lx, ty - V.ly) || 1;
        const k = s.done ? 1 : clamp((clk - s.t0) / s.dur, 0, 1);
        H.sx = V.lx + (tx - V.lx) / d * V.lr * 1.7; H.sy = V.ly + (ty - V.ly) / d * V.lr * 1.7;
        H.x = lerp(H.sx, tx, k); H.y = lerp(H.sy, ty, k);
        return H;
      }
      function ring(cx, cy, spec, color, A) {
        rings.push({ cx: (cx - A.x) / A.w, cy: (cy - A.y) / A.h, t0: clk, spec, color, n: 0 });
      }
      function radius(r) {
        const a = clk - r.t0, s = r.spec, R = s.R * V.u;
        if (a < s.g) return R * easeOutCubic(a / s.g);
        return a < s.g + s.h ? R : R * (1 + 0.12 * (a - s.g - s.h) / s.f);
      }
      function kill(m, r, A) {
        m.alive = false; m.deadAt = clk; killed++;
        r.n++;
        if (r.n === 1) PG.sfx.pop(); else PG.sfx.chain(r.n + 1);
        PG.buzz(PG.HAP.light);
        PG.burst(m.x, m.y, PAL[1], 8, 150); PG.burst(m.x, m.y, PAL[0], 4, 110);
        if (r.n === 2) PG.floatText(m.x, m.y - 16, '×2', PAL[3], 18);
        ring(m.x, m.y, CHAIN, PAL[0], A); // the missile's own small burst can catch a neighbour
      }
      function impact(m) {
        m.alive = false; m.hit = true; m.deadAt = clk;
        const b = buildings[m.b];
        PG.burst(m.x, m.y, '#8A8FA6', 10, 150);
        if (b.down) { PG.sfx.cut(); return; }
        b.down = true; b.downAt = clk; down++;
        PG.sfx.hit(); PG.buzz(PG.HAP.thud); PG.shake(6);
        PG.burst(m.x, m.y + b.h * 0.2, RUIN, 8, 120);
      }
      function finish(won) {
        state = won ? 'won' : 'lost'; endT = clk; endAt = clk + (won ? 1.2 : 1.1);
        for (const m of missiles) if (m.alive) {
          m.alive = false; m.deadAt = clk;
          if (won) { PG.burst(m.x, m.y, PAL[1], 8, 140); ring(m.x, m.y, CHAIN, PAL[1], lastA); }
        }
        if (won) { PG.sfx.candy(); PG.buzz(PG.HAP.double); } else PG.sfx.bad();
      }
      function launch(tx, ty, A, salute) {
        const dur = fly(tx, ty, A);
        shots.push({ tx: (tx - A.x) / A.w, ty: (ty - A.y) / A.h, t0: clk, dur, done: false, doneAt: 0, salute });
        aimTo = Math.atan2(ty - V.ly, tx - V.lx); lastShot = clk; fired++;
        PG.sfx.whoosh();
      }

      inst.down = (x, y, A) => {
        if (state !== 'play' || !A || clk - lastShot < 0.08) return;
        geo(A);
        let live = 0;
        for (const s of shots) if (!s.done) live++;
        if (live >= MAX_SHOTS) { PG.sfx.tick(); return; }
        launch(clamp(x, A.x + 8, A.x + A.w - 8), clamp(y, A.y + 8, V.ly - V.lr * 2.4), A, 0);
        PG.buzz(PG.HAP.tick);
      };
      inst.update = (dt, A) => {
        if (!(dt > 0) || !A) return;
        geo(A); lastA = A;
        clk += dt;
        aim += (aimTo - aim) * Math.min(1, dt * 22);
        if (state === 'play') {
          t += dt;
          if (t >= TIME) finish(true);
          else {
            while (next < plan.length && plan[next].at <= t) spawn(plan[next++]);
            if (TIME - t < tick) { PG.sfx.tick(); tick--; } // the last three seconds tick
          }
        }
        if (state === 'won' && salutes < 3 && clk - endT >= 0.12 + salutes * 0.26) {
          const k = salutes++;
          launch(A.x + A.w * [0.26, 0.74, 0.5][k], A.y + A.h * [0.24, 0.21, 0.17][k], A, k + 1);
        }
        for (const m of missiles) if (m.alive && state === 'play' && place(m, A) >= 1) impact(m);
        for (const s of shots) {
          if (s.done) continue;
          head(s, A);
          // proximity fuse: an interceptor that passes close to a missile bursts right there
          let near = clk - s.t0 >= s.dur;
          if (!near && !s.salute) {
            const f = FUSE * V.u;
            for (const m of missiles) if (m.alive && (m.x - H.x) * (m.x - H.x) + (m.y - H.y) * (m.y - H.y) <= f * f) { near = true; break; }
          }
          if (!near) continue;
          s.done = true; s.doneAt = clk; s.tx = (H.x - A.x) / A.w; s.ty = (H.y - A.y) / A.h;
          const x = H.x, y = H.y;
          if (s.salute) {
            const c = PAL[(s.salute + 1) % 4];
            ring(x, y, SALUTE, c, A); PG.burst(x, y, c, 18, 230); PG.burst(x, y, '#FFFFFF', 6, 150); PG.sfx.chain(3 + s.salute * 2); PG.buzz(PG.HAP.light);
          } else { ring(x, y, RING, PAL[1], A); if (PG.tone) PG.tone(210, 0.16, 'sine', 0.07, 0, 0.5); } // a soft low puff
        }
        // rings catch missiles while they grow, hold and start to fade (rings added here are checked too)
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i], s = r.spec;
          if (state !== 'play' || clk - r.t0 > s.g + s.h + s.f * 0.5) continue;
          const cx = A.x + r.cx * A.w, cy = A.y + r.cy * A.h, R = radius(r) + 3;
          for (const m of missiles) if (m.alive && (m.x - cx) * (m.x - cx) + (m.y - cy) * (m.y - cy) <= R * R) kill(m, r, A);
        }
        if (state === 'play' && down >= LOSE_AT) finish(false);
        for (let i = missiles.length - 1; i >= 0; i--) if (!missiles[i].alive && clk - missiles[i].deadAt > 0.9) missiles.splice(i, 1);
        for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done && clk - shots[i].doneAt > 0.4) shots.splice(i, 1);
        for (let i = rings.length - 1; i >= 0; i--) { const s = rings[i].spec; if (clk - rings[i].t0 > s.g + s.h + s.f) rings.splice(i, 1); }
        inst.dbg.t = t; inst.dbg.state = state; inst.dbg.down = down; inst.dbg.killed = killed; inst.dbg.fired = fired;
        if (endAt && !inst.over && clk >= endAt) inst.over = { won: state === 'won' };
      };

      function drawSky(ctx, A) {
        if (V.skyY !== A.y || V.skyH !== A.h) {
          V.sky = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
          V.sky.addColorStop(0, SKY[0]); V.sky.addColorStop(0.55, SKY[1]); V.sky.addColorStop(1, SKY[2]);
          V.skyY = A.y; V.skyH = A.h;
        }
        ctx.fillStyle = V.sky; ctx.fillRect(A.x, A.y, A.w, A.h);
        for (const s of stars) {
          ctx.globalAlpha = 0.45 + 0.35 * Math.sin(clk * 2.2 + s.p);
          ctx.fillStyle = '#FFFFFF'; circle(A.x + s.x * A.w, A.y + s.y * (V.base - A.y), s.r); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (const c of clouds) {
          const w = V.u * 0.3 * c.s, x = A.x - w + ((c.x + clk * c.v) % 1) * (A.w + w * 2), y = A.y + c.y * (V.base - A.y), r = w * 0.2;
          // one path, so the overlapping puffs do not double the alpha
          ctx.beginPath(); ctx.arc(x - w / 2 + r * 0.6, y, r * 0.6, 0, Math.PI * 2); ctx.arc(x + w / 2 - r * 0.6, y, r * 0.6, 0, Math.PI * 2);
          ctx.rect(x - w / 2 + r * 0.6, y - r * 0.6, w - r * 1.2, r * 1.2);
          ctx.moveTo(x - w * 0.14 + r * 1.05, y - r * 0.55); ctx.arc(x - w * 0.14, y - r * 0.55, r * 1.05, 0, Math.PI * 2);
          ctx.moveTo(x + w * 0.14 + r * 0.8, y - r * 0.45); ctx.arc(x + w * 0.14, y - r * 0.45, r * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        // a low dusk sun and a pale far skyline behind the city
        ctx.fillStyle = SUN; circle(A.x + A.w * 0.74, V.base - V.u * 0.1, V.u * 0.2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(A.x + A.w * 0.74, V.base - V.u * 0.1, V.u * 0.13); ctx.fill();
        ctx.fillStyle = FAR;
        for (const f of far) ctx.fillRect(A.x + f[0] * A.w, V.base - f[2] * V.u, f[1] * A.w, f[2] * V.u);
      }
      function drawTrail(ctx, m) {
        const len = Math.hypot(m.x - m.x0, m.y - m.y0);
        if (len < 2) return;
        const fade = m.alive ? 1 : clamp(1 - (clk - m.deadAt) / 0.8, 0, 1), ux = (m.x - m.x0) / len, uy = (m.y - m.y0) / len;
        const L = Math.min(len, V.u * 0.75), ex = m.x - ux * L, ey = m.y - uy * L;
        const g = ctx.createLinearGradient(m.x, m.y, ex, ey);
        g.addColorStop(0, `rgba(${TRAIL},${0.85 * fade})`); g.addColorStop(1, `rgba(${TRAIL},0)`);
        ctx.strokeStyle = g; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.35; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      function drawMissile(ctx, m) {
        const L = clamp(V.u * 0.05, 13, 18), w = L * 0.34, a = Math.atan2(m.vy, m.vx);
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a);
        ctx.fillStyle = BODY;
        ctx.beginPath(); ctx.moveTo(-L, -w * 1.1); ctx.lineTo(-L * 0.62, 0); ctx.lineTo(-L, w * 1.1); ctx.closePath(); ctx.fill();
        rrect(-L, -w / 2, L, w, w / 2); ctx.fill();
        const fl = 0.85 + 0.15 * Math.sin(clk * 24 + m.sx * 40);
        ctx.fillStyle = 'rgba(255,158,87,0.35)'; circle(0, 0, w * 2 * fl); ctx.fill();
        ctx.fillStyle = TIP; circle(0, 0, w * 0.85); ctx.fill();
        ctx.fillStyle = '#FFF1D6'; circle(w * 0.1, 0, w * 0.38); ctx.fill();
        ctx.restore();
      }
      function drawShots(ctx, A) {
        for (const s of shots) {
          head(s, A);
          const tx = A.x + s.tx * A.w, ty = A.y + s.ty * A.h, sx = H.sx, sy = H.sy, hx = H.x, hy = H.y;
          const fade = s.done ? clamp(1 - (clk - s.doneAt) / 0.4, 0, 1) : 1, col = s.salute ? PAL[(s.salute + 1) % 4] : PAL[2];
          ctx.globalAlpha = 0.75 * fade; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.globalAlpha = 1;
          if (s.done) continue;
          // target cross, then the interceptor head
          if (!s.salute) {
            const c = 5;
            ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(tx - c, ty - c); ctx.lineTo(tx + c, ty + c); ctx.moveTo(tx + c, ty - c); ctx.lineTo(tx - c, ty + c); ctx.stroke();
          }
          ctx.fillStyle = PG.rgba(col, 0.35); circle(hx, hy, 6); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; circle(hx, hy, 3); ctx.fill();
        }
      }
      function drawRings(ctx, A) {
        for (const r of rings) {
          const s = r.spec, a = clk - r.t0, R = radius(r), x = A.x + r.cx * A.w, y = A.y + r.cy * A.h;
          const al = a < s.g + s.h ? 1 : clamp(1 - (a - s.g - s.h) / s.f, 0, 1);
          ctx.globalAlpha = al;
          ctx.fillStyle = PG.rgba(r.color, 0.28); circle(x, y, R); ctx.fill();
          if (a < 0.1) { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - a / 0.1)})`; circle(x, y, R * 0.8); ctx.fill(); }
          ctx.strokeStyle = r.color; ctx.lineWidth = s === CHAIN ? 2.5 : 3.5; circle(x, y, R); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(x, y, R * 0.35 * (1 - al * 0.3)); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      function drawBuilding(ctx, b, i) {
        // on a win the city lights up from left to right
        const x = b.x, y = b.y, w = b.w, h = b.h, hitK = b.down ? clamp((clk - b.downAt) / 0.3, 0, 1) : 0, winK = state === 'won' ? clamp((clk - endT - i * 0.08) / 0.35, 0, 1) : 0;
        if (b.down) {
          // jagged broken top, a crack and dark windows
          ctx.fillStyle = RUIN;
          ctx.beginPath(); ctx.moveTo(x, V.base); ctx.lineTo(x, y + h * 0.22); ctx.lineTo(x + w * 0.28, y + h * 0.1); ctx.lineTo(x + w * 0.46, y + h * 0.3);
          ctx.lineTo(x + w * 0.7, y + h * 0.16); ctx.lineTo(x + w, y + h * 0.28); ctx.lineTo(x + w, V.base); ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = b.color;
          if (winK > 0) { ctx.save(); ctx.shadowColor = `rgba(255,214,130,${winK})`; ctx.shadowBlur = 30 * winK; }
          rrect(x, y, w, h + 4, Math.min(5, w * 0.12)); ctx.fill();
          if (winK > 0) ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y + 3, w * 0.22, h - 3);
          // roof details
          ctx.fillStyle = b.color;
          if (b.roof === 1) {
            ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.7, y - h * 0.22); ctx.stroke();
            ctx.fillStyle = PAL[0]; circle(x + w * 0.7, y - h * 0.22, 2.5); ctx.fill();
          } else if (b.roof === 2) { rrect(x + w * 0.18, y - h * 0.1, w * 0.3, h * 0.12, 2); ctx.fill(); }
        }
        // windows
        const mx = w * 0.17, top = h * (b.down ? 0.36 : 0.12), gap = w * 0.1;
        const ww = (w - mx * 2 - gap * (b.cols - 1)) / b.cols, rh = (h - top - h * 0.08) / b.rows, wh = Math.min(rh * 0.62, ww * 1.3);
        for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
          const wy = y + top + r * rh;
          if (wy + wh > V.base - 2) continue;
          const on = !b.down && (b.lit[r * b.cols + c] || winK > 0.3);
          ctx.fillStyle = on ? (winK > 0 ? LIT_WIN : LIT) : DARK_WIN;
          ctx.fillRect(x + mx + c * (ww + gap), wy, ww, wh);
        }
        if (!b.down) return;
        ctx.strokeStyle = RUIN_D; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + w * 0.46, y + h * 0.3); ctx.lineTo(x + w * 0.38, y + h * 0.5); ctx.lineTo(x + w * 0.56, y + h * 0.62); ctx.lineTo(x + w * 0.44, y + h * 0.84); ctx.stroke();
        if (hitK < 1) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - hitK)})`; ctx.fillRect(x, y, w, h); }
        // a soft puff, then thin smoke that keeps rising
        const age = clk - b.downAt;
        if (age < 0.6) { ctx.fillStyle = `rgba(${SMOKE},${0.5 * (1 - age / 0.6)})`; circle(x + w / 2, y + h * 0.15, w * (0.4 + age)); ctx.fill(); }
        for (let i = 0; i < 3; i++) {
          const q = (age * 0.55 + i / 3) % 1;
          ctx.fillStyle = `rgba(${SMOKE},${0.38 * (1 - q) * clamp(age * 2, 0, 1)})`;
          circle(x + w * 0.45 + Math.sin(q * 5 + i * 2) * w * 0.12, y + h * 0.12 - q * V.u * 0.16, w * (0.12 + q * 0.18)); ctx.fill();
        }
      }
      function drawLauncher(ctx) {
        const x = V.lx, y = V.ly, r = V.lr, kick = clamp(1 - (clk - lastShot) / 0.12, 0, 1);
        const bl = r * (1.7 - 0.45 * kick), ca = Math.cos(aim), sa = Math.sin(aim);
        ctx.strokeStyle = TURRET_D; ctx.lineWidth = r * 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ca * bl, y + sa * bl); ctx.stroke();
        if (kick > 0) { ctx.fillStyle = PG.rgba(PAL[1], 0.8 * kick); circle(x + ca * (bl + r * 0.3), y + sa * (bl + r * 0.3), r * 0.55 * kick + 2); ctx.fill(); }
        ctx.fillStyle = TURRET; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; circle(x - r * 0.38, y - r * 0.45, r * 0.22); ctx.fill();
        ctx.fillStyle = TURRET_D; rrect(x - r * 1.45, y, r * 2.9, V.base - y + 2, 3); ctx.fill();
        ctx.fillStyle = state === 'play' ? PAL[2] : PAL[1]; circle(x, y + (V.base - y) * 0.5, 2.2); ctx.fill();
      }
      function drawHud(ctx, A) {
        const s = 11, gap = 4, iw = s * 6 + gap * 5, ix = A.x + A.w - 18 - iw, bw = ix - 12 - (A.x + 18);
        const k = clamp(1 - t / TIME, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; rrect(A.x + 18, A.y + 14, bw, 8, 4); ctx.fill();
        ctx.fillStyle = PAL[2]; rrect(A.x + 18, A.y + 14, Math.max(8, bw * k), 8, 4); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const b = buildings[i], x = ix + i * (s + gap), y = A.y + 13, bad = b.down && clk - b.downAt < 0.6;
          ctx.fillStyle = b.down ? (bad ? PG.BAD : 'rgba(39,48,63,0.22)') : INK;
          ctx.beginPath(); ctx.moveTo(x, y + s * 0.45); ctx.lineTo(x + s / 2, y); ctx.lineTo(x + s, y + s * 0.45); ctx.lineTo(x + s * 0.86, y + s * 0.45);
          ctx.lineTo(x + s * 0.86, y + s); ctx.lineTo(x + s * 0.14, y + s); ctx.lineTo(x + s * 0.14, y + s * 0.45); ctx.closePath(); ctx.fill();
        }
      }
      function caption(ctx, A, msg, color) {
        const ka = clamp((clk - endT) / 0.25, 0, 1), cx = A.x + A.w / 2, cy = A.y + (V.base - A.y) * 0.4;
        ctx.font = `800 16px ${FD}`;
        const w = Math.min(A.w - 32, ctx.measureText(msg).width + 40);
        ctx.globalAlpha = ka;
        ctx.fillStyle = 'rgba(255,255,255,0.94)'; rrect(cx - w / 2, cy - 19, w, 38, 19); ctx.fill();
        txt(msg, cx, cy + 1, 16, color, { font: FD, max: w - 24 });
        ctx.globalAlpha = 1;
      }

      inst.draw = (ctx, A) => {
        geo(A);
        drawSky(ctx, A);
        // the big faint countdown; the last three seconds beat and show a little stronger
        const left = Math.ceil(TIME - Math.min(t, TIME)), last = left <= 3 && state === 'play';
        const pulse = last ? 1 + 0.08 * ((TIME - t) % 1) : 1, na = state === 'play' ? (last ? 0.55 : 0.4) : 0.4 * clamp(1 - (clk - endT) / 0.3, 0, 1);
        if (na > 0) txt(String(left), A.x + A.w / 2, A.y + (V.base - A.y) * 0.44, V.u * 0.42 * pulse, `rgba(255,255,255,${na})`, { font: FD });
        for (const m of missiles) drawTrail(ctx, m);
        drawShots(ctx, A);
        drawRings(ctx, A);
        for (const m of missiles) if (m.alive) drawMissile(ctx, m);
        // first-time pointer: a pulsing circle where to tap, until the first shot
        if (!fired && state === 'play') {
          const m = missiles.find(q => q.alive && q.y > A.y + 40);
          if (m) {
            const r = V.u * 0.075, px = clamp(m.x + m.vx * 0.5, A.x + r + 6, A.x + A.w - r - 6), py = m.y + m.vy * 0.5, p = 0.5 + 0.5 * Math.sin(clk * 7);
            const right = px < A.x + A.w / 2;
            ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.setLineDash(DASH);
            circle(px, py, r + V.u * 0.015 * p); ctx.stroke(); ctx.setLineDash(SOLID);
            txt('Тап!', px + (right ? 1 : -1) * (r + 14), py, 15, INK, { font: FD, align: right ? 'left' : 'right' });
          }
        }
        // the city
        for (let i = 0; i < buildings.length; i++) drawBuilding(ctx, buildings[i], i);
        drawLauncher(ctx);
        ctx.fillStyle = GROUND; ctx.fillRect(A.x, V.base, A.w, A.y + A.h - V.base);
        ctx.fillStyle = GROUND_HI; ctx.fillRect(A.x, V.base, A.w, 3);
        drawHud(ctx, A);
        if (state === 'won') caption(ctx, A, 'Місто врятовано!', PAL[2]);
        else if (state === 'lost') caption(ctx, A, 'Ой! Місто не встояло', PAL[0]);
      };
      return inst;
    }
  });
})();

// Flappy — after Flappy Bird. Tap to flap, fly through the gaps between the pipes, touch nothing.
(function () {
  const PG = window.PG;
  const { PAL, INK, SPIKE, FD, clamp, lerp, rand, circle, rrect, txt, bolt } = PG;
  const goalOf = lv => Math.min(6 + lv * 2, 22);
  const BX = 0.3, Y0 = 0.55;                          // the bird's x (arena widths) and start height (low enough to clear the intro card)
  const GRAV = 2.4, FLAP = 0.74, VMAX = 1.25;         // play heights per s² / per s (the same feel at every level)
  const WING = '#DD9416', CHEEK = 'rgba(242,97,94,0.35)';
  const PIPE_HI = 'rgba(255,255,255,0.24)', PIPE_SH = 'rgba(16,70,58,0.12)', LIP = '#1EA88F';
  const HILL_FAR = '#CDEBDD', HILL_NEAR = '#B3E0CA', GRASS = '#71D1AA', GRASS_D = '#4FBC94', SAND = '#F3E4BF', SAND_D = '#EAD5A2';
  // sky top / bottom: daytime at the start, a soft sunset by the finish pipe
  const SKY = [[198, 229, 247], [240, 247, 252], [249, 207, 194], [252, 239, 224]];
  const CLOUDS = [[0.05, 0.12, 0.085], [0.42, 0.24, 0.065], [0.78, 0.09, 0.075], [1.08, 0.33, 0.06], [1.32, 0.18, 0.09]]; // x, y (of A.h), size (of A.w)
  const SPAN = 1.6;                                   // clouds wrap over this many arena widths

  function drawBird(ctx, x, y, r, rot, flapAt, dead) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const fk = clamp((PG.now - flapAt) / 0.25, 0, 1);
    ctx.fillStyle = PAL[1]; circle(0, 0, r); ctx.fill();
    ctx.fillStyle = PAL[0];
    ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.12); ctx.lineTo(r * 1.38, r * 0.1); ctx.lineTo(r * 0.8, r * 0.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = CHEEK; circle(r * 0.5, r * 0.22, r * 0.17); ctx.fill();
    ctx.save(); ctx.translate(-r * 0.15, r * 0.18); ctx.rotate(-0.9 * (1 - fk) + 0.15);
    ctx.fillStyle = WING; ctx.beginPath(); ctx.ellipse(-r * 0.28, 0, r * 0.5, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FFFFFF'; circle(r * 0.35, -r * 0.28, r * 0.3); ctx.fill();
    ctx.fillStyle = INK; circle(r * 0.43, -r * 0.26, dead ? r * 0.06 : r * 0.14); ctx.fill();
    ctx.restore();
  }
  // One half of a pipe: the body from y0 to y1 and its lip (lw wide, lh tall) at lipY.
  function column(ctx, x, w, y0, y1, lipY, lw, lh, fin) {
    if (y1 > y0) {
      ctx.fillStyle = PAL[2]; ctx.fillRect(x, y0, w, y1 - y0);
      ctx.fillStyle = PIPE_HI; ctx.fillRect(x + w * 0.14, y0, w * 0.16, y1 - y0);
      ctx.fillStyle = PIPE_SH; ctx.fillRect(x + w * 0.78, y0, w * 0.22, y1 - y0);
    }
    const lx = x + (w - lw) / 2;
    if (!fin) {
      ctx.fillStyle = LIP; rrect(lx, lipY, lw, lh, 4); ctx.fill();
      ctx.fillStyle = PIPE_HI; ctx.fillRect(lx + lw * 0.12, lipY + 2, lw * 0.14, lh - 4);
      return;
    }
    // the finish pipe: a chequered lip
    ctx.fillStyle = '#FFFFFF'; rrect(lx, lipY, lw, lh, 4); ctx.fill();
    const n = Math.max(4, Math.round(lw / (lh * 0.5))), sw = lw / n, sh = lh / 2;
    ctx.fillStyle = INK; ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.rect(lx + i * sw, lipY + (i % 2) * sh, sw + 0.3, sh);
    ctx.fill();
  }
  function coin(ctx, x, y, r, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(x, y, r * 1.35); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(0.45 + 0.55 * Math.abs(Math.cos(t * 2.4)), 1);
    ctx.fillStyle = PAL[1]; circle(0, 0, r); ctx.fill();
    ctx.fillStyle = '#FFD06A'; circle(0, 0, r * 0.74); ctx.fill();
    bolt(0, 0, r * 1.05, '#FFFFFF');
    ctx.restore();
  }
  function cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.53, y); ctx.arc(x - s * 0.95, y, s * 0.42, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.42, y - s * 0.3); ctx.arc(x - s * 0.2, y - s * 0.3, s * 0.62, 0, Math.PI * 2);
    ctx.moveTo(x + s * 1.1, y - s * 0.05); ctx.arc(x + s * 0.62, y - s * 0.05, s * 0.48, 0, Math.PI * 2);
    ctx.rect(x - s * 0.95, y - s * 0.05, s * 1.6, s * 0.47);
    ctx.fill();
  }
  const hash = i => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };
  // A row of rounded hills standing on baseY, scrolled by off pixels.
  function hills(ctx, A, baseY, off, bw, hMax, col, seed) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = Math.floor(off / bw) - 1, x = A.x + i * bw - off; x < A.x + A.w + bw; i++, x += bw) {
      const h = hMax * (0.55 + 0.45 * hash(i + seed));
      ctx.moveTo(x + bw * 0.8, baseY); ctx.ellipse(x, baseY, bw * 0.8, h, 0, 0, Math.PI, true);
    }
    ctx.fill();
  }
  function hitRect(cx, cy, r, x0, y0, x1, y1) {
    const dx = cx - clamp(cx, x0, x1), dy = cy - clamp(cy, y0, y1);
    return dx * dx + dy * dy < r * r;
  }

  PG.arcade.register({
    id: 'flappy',
    title: 'Flappy',
    family: 'Класика',
    accent: PAL[1],
    howto: ['Тапай, щоб пташка підлетіла', 'Пролітай між трубами, нічого не торкайся'],
    goal: lv => ({ count: goalOf(lv), unit: 'труб' }),
    icon(ctx, x, y, r) {
      ctx.fillStyle = PAL[2];
      ctx.fillRect(x + r * 0.42, y - r * 0.9, r * 0.36, r * 0.42); ctx.fillRect(x + r * 0.36, y - r * 0.56, r * 0.48, r * 0.16);
      ctx.fillRect(x + r * 0.42, y + r * 0.5, r * 0.36, r * 0.42); ctx.fillRect(x + r * 0.36, y + r * 0.4, r * 0.48, r * 0.16);
      drawBird(ctx, x - r * 0.2, y, r * 0.5, -0.2, -9, false);
    },
    create(level, api) {
      // Difficulty, all in one place. Horizontal numbers are arena widths, vertical ones fractions of the play height.
      // Level 1: a huge gap, slow scroll, wide spacing, small height changes and no moving pipes.
      const L = level - 1, goal = goalOf(level);
      const SPEED = Math.min(0.29 + L * 0.017, 0.45);               // scroll speed, widths per second
      const SPACING = Math.max(0.86 - L * 0.022, 0.64);             // centre to centre between pipes
      const GAP = Math.max(0.37 - L * 0.011, 0.29) - (api && api.fill || 0) * 0.02; // gap height (a full puzzle board trims it)
      const VARY = Math.min(0.14 + L * 0.028, 0.32);                // largest change of gap height from one pipe to the next
      const BAND = Math.min(0.14 + L * 0.016, 0.3);                 // gap centres stay within 0.5 ± BAND
      const MOVE_P = level < 4 ? 0 : Math.min(0.15 + (level - 4) * 0.07, 0.5); // share of pipes whose gap slides up and down
      const MOVE_A = Math.min(0.04 + (level - 4) * 0.008, 0.08);    // ...by this much
      const RAMP = 0.01, RAMP_GAP = 0.002;                          // per pipe inside a round: +1% speed (up to 20 pipes), -0.2% gap (up to 12)
      const COIN_P = 0.3;                                           // chance of an energy coin in a gap
      const PERFECT = 0.045;                                        // "perfect" when this close to the gap centre
      const FIRST = 1.12;                                           // where the first pipe waits before the start

      const g = { ny: Y0, vy: 0, rot: 0, flapAt: -9, t: 0, dist: 0, pipes: [], last: null, spawned: 0,
        started: false, deadAt: -9, landed: false, popAt: -9, skyK: 0, nextFlap: 0, lastC: Y0, lastAmp: 0 };
      const inst = { progress: 0, over: null, stats: { level, flaps: 0, coins: 0, perfects: 0 } };
      const V = { top: 0, bot: 0, ph: 0, r: 0, pw: 0, lw: 0, lh: 0, ceil: 0, gh: 0 };
      const C = { q: -1, y: 0, h: 0, grad: null };
      inst.dbg = { g, V, cfg: { goal, SPEED, SPACING, GAP, VARY, BAND, MOVE_P, MOVE_A } }; // read by automated checks

      function geo(A) {
        V.ceil = Math.max(10, A.h * 0.022); V.gh = Math.max(36, A.h * 0.09);
        V.top = A.y + V.ceil; V.bot = A.y + A.h - V.gh; V.ph = V.bot - V.top;
        V.r = V.ph * 0.034; V.pw = A.w * 0.165; V.lw = V.pw * 1.16; V.lh = Math.max(12, V.ph * 0.045);
      }
      const speedNow = () => SPEED * (1 + Math.min(inst.progress, 20) * RAMP);
      const centre = p => p.c + (p.amp ? p.amp * Math.sin(g.t * p.w + p.phase) : 0);
      function spawn(x) {
        const i = g.spawned, gap = GAP - Math.min(i, 12) * RAMP_GAP;
        const moving = i >= 2 && Math.random() < MOVE_P, amp = moving ? MOVE_A : 0;
        const lo = Math.max(0.5 - BAND, gap / 2 + 0.07) + amp, hi = Math.min(0.5 + BAND, 1 - gap / 2 - 0.07) - amp;
        // climbing takes taps, falling is free: a rise must fit the open stretch between two pipes
        const free = (SPACING - 0.29) / (SPEED * (1 + Math.min(i, 20) * RAMP));
        const rise = Math.max(gap / 2 - 0.06 + 0.32 * free - amp - g.lastAmp, 0.04);
        const d = Math.max(rand(-VARY, VARY), -rise);
        const c = i === 0 ? Y0 + rand(-0.06, 0.02) : clamp(g.lastC + d, Math.min(lo, hi), Math.max(lo, hi));
        const fin = i === goal - 1;
        const p = { x, c, gap, amp, w: rand(1.6, 2.3), phase: rand(0, Math.PI * 2), passed: false, fin,
          coin: !fin && i >= 1 && Math.random() < COIN_P ? { dy: rand(-0.24, 0.24) * gap, got: false } : null };
        g.pipes.push(p); g.last = p; g.lastC = c; g.lastAmp = amp; g.spawned++;
      }
      function fill() {
        while (g.spawned < goal && (!g.last || g.last.x + SPACING < 1.4)) spawn(g.last ? g.last.x + SPACING : FIRST);
      }
      fill();

      function die(A, cause, px, py) {
        inst.over = { won: false, cause };
        g.deadAt = PG.now;
        g.vy = cause === 'ceiling' ? 0.3 : cause === 'ground' ? -0.4 : -0.3; // a little bump, then the fall
        g.landed = false;
        PG.sfx.hit(); PG.sfx.die(); PG.shake(8);
        PG.burst(px, py, PAL[1], 14, 200); PG.burst(px, py, '#FFFFFF', 6, 150);
      }
      function pass(A, p, px, py) {
        p.passed = true; inst.progress++; g.popAt = PG.now;
        PG.reward({ score: 10 });
        PG.sfx.note(Math.min(10, Math.round(inst.progress / goal * 9))); PG.buzz(PG.HAP.tick);
        const off = Math.abs(g.ny - centre(p));
        if (off < PERFECT && !p.fin) {
          inst.stats.perfects++;
          PG.reward({ score: 10 });
          PG.floatText(px, py - V.r * 2.2, 'ІДЕАЛЬНО!', PAL[2], 17);
          PG.burst(px, py, '#FFFFFF', 6, 120);
        }
      }

      inst.idle = (dt, A) => {
        geo(A);
        if (g.started) return; // paused mid-round: everything stays put
        g.ny = Y0 + Math.sin(PG.now * 4) * 0.015; g.rot = 0;
        g.dist += SPEED * 0.4 * dt;
        if (PG.now > g.nextFlap) { g.flapAt = PG.now; g.nextFlap = PG.now + 0.35; }
      };
      inst.start = () => { g.started = true; };
      inst.tap = () => {
        if (inst.over) return;
        const A = PG.arena;
        g.vy = -FLAP; g.flapAt = PG.now; inst.stats.flaps++;
        PG.sfx.flap();
        PG.burst(A.x + BX * A.w - V.r * 0.7, V.top + g.ny * V.ph + V.r * 0.4, '#FFFFFF', 3, 70);
      };
      inst.win = () => {
        const A = PG.arena;
        PG.floatText(A.x + BX * A.w + 30, V.top + g.ny * V.ph - V.r * 2.4, 'ФІНІШ!', PAL[1], 24);
      };
      inst.update = (dt, A) => {
        geo(A);
        g.skyK += (inst.progress / goal - g.skyK) * Math.min(1, dt * 2);
        const r = V.r, px = A.x + BX * A.w;
        if (inst.over) {
          if (inst.over.won) {
            // glide to the middle and keep flapping lazily while the pipes roll away
            const sp = speedNow() * dt;
            g.dist += sp; for (const p of g.pipes) p.x -= sp;
            g.vy = 0; g.ny += (0.42 - g.ny) * Math.min(1, dt * 3); g.rot += (-0.1 - g.rot) * Math.min(1, dt * 6);
            if (PG.now > g.nextFlap) { g.flapAt = PG.now; g.nextFlap = PG.now + 0.3; }
            return;
          }
          g.rot += (1.5 - g.rot) * Math.min(1, dt * 7);
          if (g.landed) return;
          g.vy = Math.min(g.vy + GRAV * 1.4 * dt, VMAX * 1.5); g.ny += g.vy * dt;
          if (V.top + g.ny * V.ph + r > V.bot) {
            g.ny = (V.bot - r - V.top) / V.ph; g.landed = true;
            PG.burst(px, V.bot, SAND_D, 8, 110); PG.sfx.hit();
          }
          return;
        }
        g.t += dt;
        const sp = speedNow() * dt;
        g.dist += sp;
        for (const p of g.pipes) p.x -= sp;
        while (g.pipes.length && g.pipes[0].x < -0.4) g.pipes.shift();
        fill();

        g.vy = Math.min(g.vy + GRAV * dt, VMAX); g.ny += g.vy * dt;
        g.rot += (clamp(g.vy * 1.1, -0.45, 1.2) - g.rot) * Math.min(1, dt * 9);
        const py = V.top + g.ny * V.ph;
        // a slightly forgiving hitbox: 80% of the bird against the ground and ceiling, 76% against pipes
        if (py - r * 0.8 < V.top) { die(A, 'ceiling', px, py); return; }
        if (py + r * 0.8 > V.bot) { die(A, 'ground', px, py); return; }
        const hr = r * 0.76, half = V.pw / 2, lo = (V.lw - V.pw) / 2;
        for (const p of g.pipes) {
          const cx = A.x + p.x * A.w;
          if (cx + half + lo < px - r || cx - half - lo > px + r) {
            if (!p.passed && p.x < BX) pass(A, p, px, py);
            continue;
          }
          const c = centre(p), gt = V.top + (c - p.gap / 2) * V.ph, gb = V.top + (c + p.gap / 2) * V.ph;
          if (hitRect(px, py, hr, cx - half, A.y - 50, cx + half, gt) || hitRect(px, py, hr, cx - half, gb, cx + half, A.y + A.h + 50) ||
              hitRect(px, py, hr, cx - half - lo, gt - V.lh, cx + half + lo, gt) || hitRect(px, py, hr, cx - half - lo, gb, cx + half + lo, gb + V.lh)) {
            die(A, 'pipe', px, py); return;
          }
          if (p.coin && !p.coin.got) {
            const ky = V.top + c * V.ph + p.coin.dy * V.ph;
            if (Math.hypot(px - cx, py - ky) < r + V.r * 0.75) {
              p.coin.got = true; inst.stats.coins++;
              PG.reward({ energy: 1, score: 20, x: cx, y: ky - 22 });
              PG.sfx.coin(); PG.buzz(PG.HAP.double);
              PG.burst(cx, ky, PAL[1], 12, 160);
            }
          }
          if (!p.passed && p.x < BX) pass(A, p, px, py);
        }
      };

      inst.draw = (ctx, A) => {
        geo(A);
        // sky, rebuilt only when the arena or the sunset step changes
        const q = Math.round(Math.pow(clamp(g.skyK, 0, 1), 1.4) * 40);
        if (C.q !== q || C.y !== A.y || C.h !== A.h) {
          const k = q / 40, mix = (a, b) => `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
          C.grad = ctx.createLinearGradient(0, A.y, 0, V.bot);
          C.grad.addColorStop(0, mix(SKY[0], SKY[2])); C.grad.addColorStop(1, mix(SKY[1], SKY[3]));
          C.q = q; C.y = A.y; C.h = A.h;
        }
        ctx.fillStyle = C.grad; ctx.fillRect(A.x, A.y, A.w, A.h);

        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < CLOUDS.length; i++) {
          const cl = CLOUDS[i], x = ((cl[0] - g.dist * 0.12) % SPAN + SPAN) % SPAN - 0.3;
          cloud(ctx, A.x + x * A.w, A.y + cl[1] * A.h + V.ceil, cl[2] * A.w);
        }
        // the sun carries the big progress number
        const sx = A.x + A.w / 2, sy = A.y + A.h * 0.38, R = A.w * 0.24;
        const pk = clamp((PG.now - g.popAt) / 0.3, 0, 1);
        ctx.fillStyle = '#FBF8EC'; circle(sx, sy, R); ctx.fill();
        txt(String(inst.progress).padStart(2, '0'), sx, sy + R * 0.04, R * 0.72 * (1 + 0.18 * (1 - pk)), `rgba(39,48,63,${0.13 + 0.12 * (1 - pk)})`, { font: FD });

        hills(ctx, A, V.bot, g.dist * A.w * 0.22, A.w * 0.42, A.h * 0.17, HILL_FAR, 0);
        hills(ctx, A, V.bot, g.dist * A.w * 0.45, A.w * 0.3, A.h * 0.085, HILL_NEAR, 50);

        // pipes and their coins
        const half = V.pw / 2;
        for (const p of g.pipes) {
          const cx = A.x + p.x * A.w;
          if (cx + V.lw < A.x || cx - V.lw > A.x + A.w) continue;
          const c = centre(p), gt = V.top + (c - p.gap / 2) * V.ph, gb = V.top + (c + p.gap / 2) * V.ph;
          column(ctx, cx - half, V.pw, A.y, gt - V.lh, gt - V.lh, V.lw, V.lh, p.fin);
          column(ctx, cx - half, V.pw, gb + V.lh, V.bot, gb, V.lw, V.lh, p.fin);
          if (p.fin) {
            // label the finish on whichever half has more room
            const up = gt - V.lh - V.top, down = V.bot - gb - V.lh;
            if (Math.max(up, down) > 80) {
              ctx.save(); ctx.translate(cx, up > down ? V.top + up / 2 : gb + V.lh + down / 2); ctx.rotate(-Math.PI / 2);
              txt('ФІНІШ', 0, 1, Math.min(V.pw * 0.34, 17), '#FFFFFF', { font: FD, max: Math.max(up, down) - 16 });
              ctx.restore();
            }
          }
          if (p.coin && !p.coin.got) coin(ctx, cx, V.top + (c + p.coin.dy) * V.ph + Math.sin(PG.now * 4 + p.phase) * 2, V.r * 0.72, PG.now + p.phase);
        }

        // spiky ceiling
        const n = Math.max(8, Math.round(A.w / 20)), sw = A.w / n;
        ctx.fillStyle = SPIKE; ctx.fillRect(A.x, A.y, A.w, 3);
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const x0 = A.x + i * sw; ctx.moveTo(x0, A.y); ctx.lineTo(x0 + sw, A.y); ctx.lineTo(x0 + sw / 2, A.y + V.ceil); ctx.closePath(); }
        ctx.fill();

        // ground: grass lip and scrolling sand stripes
        const gt = 7, per = 26, off = (g.dist * A.w) % per, bot = A.y + A.h;
        ctx.fillStyle = SAND; ctx.fillRect(A.x, V.bot, A.w, V.gh);
        ctx.fillStyle = SAND_D; ctx.beginPath();
        for (let x = A.x - off - per; x < A.x + A.w + per; x += per) {
          ctx.moveTo(x, V.bot + gt); ctx.lineTo(x + per * 0.5, V.bot + gt); ctx.lineTo(x + per * 0.5 - 12, bot); ctx.lineTo(x - 12, bot); ctx.closePath();
        }
        ctx.fill();
        ctx.fillStyle = GRASS; ctx.fillRect(A.x, V.bot, A.w, gt);
        ctx.fillStyle = GRASS_D; ctx.fillRect(A.x, V.bot + gt - 2, A.w, 2);

        const dead = inst.over && !inst.over.won;
        drawBird(ctx, A.x + BX * A.w, V.top + g.ny * V.ph, V.r, g.rot, g.flapAt, dead);
        if (dead) {
          const f = 1 - clamp((PG.now - g.deadAt) / 0.2, 0, 1);
          if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * f})`; ctx.fillRect(A.x, A.y, A.w, A.h); }
        }
      };
      return inst;
    }
  });
})();

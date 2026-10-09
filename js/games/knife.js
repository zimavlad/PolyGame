// Knife Hit — after Ketchapp's Knife Hit. Tap to throw a knife into the spinning log; never hit a knife already in it.
(function () {
  const PG = window.PG;
  const { PAL, INK, DIM, FD, clamp, lerp, rand, easeOutBack, easeOutCubic, circle, rrect, txt, rgba } = PG;
  const tone = typeof PG.tone === 'function' ? PG.tone : () => {};
  const TAU = Math.PI * 2, DOWN = Math.PI / 2;
  const ACCENT = '#D4823A';
  const WOOD = { bark: '#A8673C', groove: '#8C5230', face: '#EDB673', ring: '#D9995A', mark: 'rgba(122,64,24,0.22)' };
  const STEEL = '#C3CCD8', STEEL_HI = '#EEF2F7', BOLSTER = '#4A5368';
  const BGS = [['#EAF4F1', '#D3E8E2'], ['#EEEAF9', '#DBD4F2']];
  const goalOf = lv => Math.min(6 + lv, 16);

  const norm = a => { a %= TAU; return a < 0 ? a + TAU : a; };
  function angDist(a, b) { const d = Math.abs(norm(a) - norm(b)); return d > Math.PI ? TAU - d : d; }

  // A knife with its tip at (0,0) and the handle along +y. mono paints a flat silhouette (the quiver icons).
  function drawKnife(ctx, L, mono) {
    const bw = L * 0.14, hw = L * 0.19, bl = L * 0.56;
    ctx.fillStyle = mono || STEEL;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, bl); ctx.lineTo(-bw / 2, L * 0.05); ctx.lineTo(-bw * 0.15, 0);
    ctx.quadraticCurveTo(bw / 2, L * 0.07, bw / 2, L * 0.22); ctx.lineTo(bw / 2, bl); ctx.closePath(); ctx.fill();
    if (!mono) { ctx.fillStyle = STEEL_HI; ctx.fillRect(-bw / 2, L * 0.07, bw * 0.4, bl - L * 0.07); }
    ctx.fillStyle = mono || BOLSTER; rrect(-hw * 0.65, bl - L * 0.01, hw * 1.3, L * 0.065, L * 0.025); ctx.fill();
    ctx.fillStyle = mono || INK; rrect(-hw / 2, bl + L * 0.05, hw, L * 0.39, hw * 0.45); ctx.fill();
    if (!mono) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; circle(0, bl + L * 0.17, hw * 0.14); ctx.fill(); circle(0, bl + L * 0.32, hw * 0.14); ctx.fill(); }
  }
  // The log's cut face, centred on (0,0). The grooves, crack and knot make the spin readable.
  function drawLogFace(ctx, R) {
    ctx.fillStyle = WOOD.bark; circle(0, 0, R); ctx.fill();
    ctx.fillStyle = WOOD.groove;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.95, a, a + 0.24); ctx.arc(0, 0, R * 0.88, a + 0.24, a, true); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = WOOD.face; circle(0, 0, R * 0.85); ctx.fill();
    ctx.strokeStyle = WOOD.ring; ctx.fillStyle = WOOD.ring; ctx.lineWidth = Math.max(1.5, R * 0.035); ctx.lineCap = 'round';
    circle(0, 0, R * 0.62); ctx.stroke(); circle(0, 0, R * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.14, R * 0.04); ctx.lineTo(R * 0.46, R * 0.2); ctx.lineTo(R * 0.72, R * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-R * 0.48, -R * 0.3, R * 0.1, R * 0.065, 0.6, 0, TAU); ctx.fill();
    circle(0, 0, R * 0.09); ctx.fill();
  }
  // Apple with its stem along +y (away from the log). half: -1 / 1 draws only that half (a sliced piece).
  function drawApple(ctx, r, half) {
    ctx.fillStyle = PAL[0];
    if (half) {
      ctx.beginPath(); ctx.arc(0, 0, r, half > 0 ? -DOWN : DOWN, half > 0 ? DOWN : DOWN * 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFF1DC'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.78, 0, half > 0 ? -DOWN : DOWN, half > 0 ? DOWN : DOWN * 3); ctx.closePath(); ctx.fill();
      return;
    }
    circle(0, 0, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; circle(-r * 0.36, r * 0.3, r * 0.26); ctx.fill();
    ctx.strokeStyle = '#7A4A2A'; ctx.lineWidth = Math.max(1.5, r * 0.2); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.lineTo(r * 0.14, r * 1.35); ctx.stroke();
    ctx.fillStyle = PAL[2]; ctx.beginPath(); ctx.ellipse(r * 0.5, r * 1.2, r * 0.42, r * 0.2, -0.45, 0, TAU); ctx.fill();
  }
  function thunk() { tone(160, .1, 'triangle', .17, 0, .5); tone(85, .14, 'sine', .16, 0, .7); tone(1250, .025, 'square', .018); }
  function clang() { tone(1480, .16, 'square', .03, 0, .85); tone(2220, .12, 'triangle', .05, .005, .9); tone(990, .22, 'sine', .04, .01); }
  function crack() { tone(240, .2, 'sawtooth', .045, 0, .35); tone(120, .26, 'triangle', .14, .02, .5); for (let i = 0; i < 3; i++) tone(700 + i * 230, .05, 'square', .02, .03 + i * .045); }

  PG.arcade.register({
    id: 'knife',
    title: 'Knife Hit',
    family: 'Ketchapp',
    accent: ACCENT,
    howto: ['Тапни, щоб кинути ніж у колоду', 'Не влуч у ніж, що вже стирчить'],
    goal: lv => ({ count: goalOf(lv), unit: 'ножів' }),
    icon(ctx, x, y, r) {
      ctx.save(); ctx.translate(x, y - r * 0.22);
      ctx.save(); ctx.translate(0, r * 0.3); drawKnife(ctx, r * 0.8); ctx.restore();
      ctx.rotate(0.5); drawLogFace(ctx, r * 0.5);
      ctx.restore();
    },
    create(level, api) {
      // Difficulty, all in one place. Level 1: one slow, steady log with nothing in it and 7 knives to throw.
      // From level 5 the round has two logs, and the second ("final") one spins harder.
      const lv = Math.max(1, level | 0), goal = goalOf(lv), first = Math.floor(goal * 0.4);
      const crowd = Math.round(((api && api.fill) || 0) * 1.2); // a crowded puzzle board adds a stuck knife
      const D = {
        logs: lv >= 5 ? [first, goal - first] : [goal],                      // knives to throw into each log
        pre: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3][Math.min(lv, 10) - 1] + crowd,   // knives already stuck in the final log
        spin: Math.min(1.25 + (lv - 1) * 0.1, 2.15),                        // base log speed, rad/s
        vary: lv < 2 ? 0 : Math.min(0.12 + (lv - 2) * 0.06, 0.55),          // speed change between motion phases
        flip: lv < 3 ? 0 : Math.min(0.18 + (lv - 3) * 0.05, 0.5),           // chance a phase reverses the spin
        phase: Math.max(2.8 - (lv - 1) * 0.14, 1.5),                        // seconds per motion phase
        ease: Math.min(2 + lv * 0.15, 3.5),                                 // how quickly the log changes speed, 1/s
        ramp: 0.03,                                                         // +3% speed per knife already in the log
        maxSpin: 3.6,                                                       // hard cap, rad/s
        apple: 0.55,                                                        // chance of an apple on each log
        sep: 0.17,                                                          // knives closer than this (rad) collide
        flight: 0.1                                                         // seconds from hand to log
      };
      const g = {
        rot: Math.random() * TAU, w: 0, target: 0, dir: 1, spin: 0, vary: 0, flip: 0, phaseT: 0, phaseLen: 0,
        stage: 0, quota: 0, left: 0, onLog: 0, knives: [], apple: null,
        flights: [], readyAt: 0, queued: 0, first: false, started: false,
        born: 0, hitAt: -9, broken: false, nextAt: 0, debris: [], bounced: null
      };
      // g is exposed read-only for automated checks
      const inst = { progress: 0, over: null, stats: { level: lv, throws: 0, apples: 0, near: 0, logs: 0 }, cfg: D, g };
      const c = { R: 0, KL: 0, r1: 0, cx: 0, cy: 0, rest: 0 };
      function geo(A) {
        c.R = Math.min(A.w * 0.21, A.h * 0.155); c.KL = c.R * 1.12; c.r1 = c.R - c.KL * 0.2; // r1: how deep a tip sits
        c.cx = A.x + A.w / 2; c.cy = A.y + A.h * 0.36; c.rest = A.y + A.h * 0.75;
        return c;
      }
      const effW = () => clamp(g.w * (1 + D.ramp * g.onLog), -D.maxSpin, D.maxSpin);
      const landA = () => norm(DOWN - g.rot);
      function clearAt(a, margin) { for (const k of g.knives) if (angDist(k.a, a) < D.sep + margin) return false; return true; }
      function freeAngle(gap) {
        for (let t = 0; t < 40; t++) { const a = Math.random() * TAU; if (clearAt(a, gap - D.sep)) return a; }
        return null;
      }
      function newLog(stage) {
        const last = stage === D.logs.length - 1, boss = last && stage > 0;
        Object.assign(g, { stage, quota: D.logs[stage], left: D.logs[stage], onLog: 0, apple: null, broken: false, born: PG.now, queued: 0, readyAt: PG.now, phaseT: 0, phaseLen: D.phase });
        g.knives.length = 0; g.flights.length = 0;
        g.spin = D.spin * (boss ? 1.06 : 1); g.vary = D.vary + (boss ? 0.1 : 0); g.flip = D.flip + (boss ? 0.15 : 0);
        g.dir = lv === 1 || Math.random() < 0.5 ? 1 : -1;
        g.w = g.target = g.spin * g.dir;
        const pre = last ? D.pre : Math.max(0, D.pre - 1);
        for (let i = 0; i < pre; i++) { const a = freeAngle(0.8); if (a !== null) g.knives.push({ a }); }
        if (Math.random() < D.apple) { const a = freeAngle(0.5); if (a !== null) g.apple = { a, born: PG.now }; }
      }
      newLog(0);

      function spin(dt) {
        if (g.vary || g.flip) {
          g.phaseT += dt;
          if (g.phaseT >= g.phaseLen) {
            g.phaseT = 0; g.phaseLen = D.phase * rand(0.75, 1.25);
            if (Math.random() < g.flip) g.dir = -g.dir;
            g.target = g.dir * g.spin * (1 + g.vary * rand(-1, 0.6));
          }
        }
        g.w += (g.target - g.w) * Math.min(1, dt * D.ease);
        g.rot = norm(g.rot + effW() * dt);
      }
      function moveDebris(dt) {
        for (let i = g.debris.length - 1; i >= 0; i--) {
          const d = g.debris[i];
          d.t += dt; d.vy += 16 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
          if (d.t > 1.6) g.debris.splice(i, 1);
        }
        const b = g.bounced;
        if (b) { b.vy += 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; }
      }
      // Several knives may be in the air at once: throwing too fast is how most rounds are lost.
      function throwKnife() {
        if (inst.over || g.broken || g.left <= 0 || PG.now < g.readyAt) return false;
        g.flights.push({ f: 0 }); g.left--; g.queued = 0; g.readyAt = PG.now + 0.06; inst.stats.throws++;
        tone(380, .07, 'sine', .05, 0, 2.4); PG.buzz(PG.HAP.tick);
        return true;
      }
      // A stuck knife blocks the throw once a part of it within w of the centre line is below the flying tip.
      function blockedAt(tipY) {
        const w = c.r1 * Math.tan(D.sep), r2 = c.r1 + c.KL;
        for (const k of g.knives) {
          const th = k.a + g.rot, s = Math.abs(Math.cos(th)), dn = Math.sin(th);
          if (dn <= 0) continue;
          const rm = s * r2 <= w ? r2 : w / s;
          if (rm < c.r1) continue;
          const y = c.cy + rm * dn;
          if (tipY <= y) return y;
        }
        return -1;
      }
      function sliceApple() {
        const th = g.apple.a + g.rot, x = c.cx + Math.cos(th) * c.R * 1.14, y = c.cy + Math.sin(th) * c.R * 1.14;
        g.apple = null; inst.stats.apples++;
        PG.reward({ energy: 1, score: 25, x, y: y - 28 });
        PG.sfx.candy(); PG.buzz(PG.HAP.double);
        PG.burst(x, y, PAL[0], 12, 180); PG.burst(x, y, '#FFF1DC', 6, 140);
        for (let sd = -1; sd <= 1; sd += 2) {
          g.debris.push({ k: 2, half: sd, x: Math.cos(th) * 1.14, y: Math.sin(th) * 1.14, vx: sd * rand(2, 3), vy: -rand(1.5, 2.5), rot: th - DOWN, vr: sd * rand(4, 7), t: 0 });
        }
      }
      function bounce(y, fl) {
        g.queued = 0;
        for (const o of g.flights) { // the knives still in the air drop away
          if (o === fl) continue;
          const ty = lerp(c.rest, c.cy + c.r1, o.f);
          g.debris.push({ k: 1, x: 0, y: (ty + c.KL / 2 - c.cy) / c.R, vx: rand(-1.5, 1.5), vy: 2, rot: 0, vr: rand(-6, 6), t: 0 });
        }
        g.flights.length = 0;
        g.bounced = { x: 0, y: (y - c.cy + c.KL / 2) / c.R, vx: rand(1.5, 3) * (Math.random() < 0.5 ? -1 : 1), vy: 3.5, rot: 0, vr: rand(9, 13) * (Math.random() < 0.5 ? -1 : 1) };
        inst.over = { won: false, cause: 'knife' };
        clang(); PG.sfx.die(); PG.shake(8);
        PG.burst(c.cx, y, '#FFFFFF', 10, 220); PG.burst(c.cx, y, PAL[1], 6, 170);
        PG.floatText(c.cx, y + c.KL * 0.5, 'Дзинь!', PAL[0], 24);
      }
      function breakLog() {
        g.broken = true; g.flights.length = 0; g.queued = 0; inst.stats.logs++;
        const off = Math.random() * TAU;
        for (let i = 0; i < 6; i++) {
          const a0 = off + i * TAU / 6, am = a0 + Math.PI / 6 + g.rot, sp = rand(2.2, 3.6);
          g.debris.push({ k: 0, a0, a1: a0 + TAU / 6, x: 0, y: 0, vx: Math.cos(am) * sp, vy: Math.sin(am) * sp - 2.5, rot: g.rot, vr: rand(-3, 3), t: 0 });
        }
        const rr = (c.r1 + c.KL / 2) / c.R;
        for (const k of g.knives) {
          const th = k.a + g.rot, sp = rand(3, 4.5);
          g.debris.push({ k: 1, x: Math.cos(th) * rr, y: Math.sin(th) * rr, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp - 3, rot: th - DOWN, vr: rand(-9, 9), t: 0 });
        }
        if (g.apple) { const th = g.apple.a + g.rot; PG.burst(c.cx + Math.cos(th) * c.R * 1.14, c.cy + Math.sin(th) * c.R * 1.14, PAL[0], 8, 160); g.apple = null; }
        g.knives.length = 0;
        crack(); PG.shake(6); PG.buzz(PG.HAP.double);
        PG.burst(c.cx, c.cy, WOOD.face, 16, 260); PG.burst(c.cx, c.cy, WOOD.bark, 8, 200);
      }
      function stick(fl) {
        const a = landA();
        let near = 9;
        for (const k of g.knives) near = Math.min(near, angDist(k.a, a));
        if (near < D.sep) { bounce(c.cy + c.r1, fl); return; } // the log turned under the knife in the last instant
        g.knives.push({ a });
        g.onLog++; g.hitAt = PG.now;
        inst.progress++;
        thunk(); PG.buzz(PG.HAP.light); PG.shake(2.5);
        PG.reward({ score: 10 });
        const hy = c.cy + c.R;
        PG.burst(c.cx, hy, WOOD.face, 6, 140); PG.burst(c.cx, hy, WOOD.bark, 3, 110);
        if (near < D.sep + 0.07) {
          inst.stats.near++; PG.reward({ score: 5 });
          PG.floatText(c.cx + c.R * 0.95, hy + 14, 'Впритул!', PAL[1], 18);
        }
        if (g.left <= 0 && g.flights.length === 1 && g.stage < D.logs.length - 1) {
          breakLog(); g.nextAt = PG.now + 0.75;
          PG.reward({ score: 30, x: c.cx, y: c.cy });
        }
      }
      // Moves one knife; returns true once it has stuck or bounced.
      function flyStep(fl, h) {
        fl.f = Math.min(1, fl.f + h / D.flight);
        const tipY = lerp(c.rest, c.cy + c.r1, fl.f);
        if (g.apple) {
          const th = g.apple.a + g.rot, ay = c.cy + Math.sin(th) * c.R * 1.14;
          if (Math.sin(th) > 0 && Math.abs(Math.cos(th)) * c.R * 1.14 < c.R * 0.26 && tipY <= ay + c.R * 0.16) sliceApple();
        }
        const y = blockedAt(tipY);
        if (y >= 0) { bounce(y, fl); return true; }
        if (fl.f >= 1) { stick(fl); return true; }
        return false;
      }

      inst.idle = (dt, A) => {
        geo(A); moveDebris(dt);
        if (!g.started) g.rot = norm(g.rot + effW() * dt); // the log turns behind the intro card; a pause freezes it
      };
      inst.start = () => { g.started = true; g.first = true; };
      inst.tap = () => {
        if (inst.over || g.broken) return;
        if (g.first) { // the tap that closes the intro card never throws straight into a knife
          g.first = false;
          if (!clearAt(norm(DOWN - g.rot - effW() * D.flight), 0.04)) return;
        }
        if (!throwKnife()) g.queued = PG.now;
      };
      inst.win = () => { geo(PG.arena); breakLog(); };
      inst.update = (dt, A) => {
        geo(A); moveDebris(dt);
        if (inst.over) {
          if (!inst.over.won) { g.w *= Math.pow(0.15, dt); g.rot = norm(g.rot + effW() * dt); }
          return;
        }
        if (g.broken) {
          if (PG.now >= g.nextAt) {
            newLog(g.stage + 1);
            const last = g.stage === D.logs.length - 1;
            PG.floatText(c.cx, c.cy + c.R * 1.5, last ? 'Фінальна колода!' : `Колода ${g.stage + 1}`, ACCENT, 22);
            PG.sfx.whoosh();
          }
          return;
        }
        const n = g.flights.length ? 3 : 1, h = dt / n; // sub-steps keep a fast log from slipping a knife past the check
        for (let i = 0; i < n && !inst.over && !g.broken; i++) {
          spin(h);
          for (let j = 0; j < g.flights.length;) {
            const done = flyStep(g.flights[j], h);
            if (inst.over || g.broken) break;
            if (done) g.flights.splice(j, 1); else j++;
          }
        }
        if (g.queued && !inst.over && !g.broken) { if (PG.now - g.queued > 0.3) g.queued = 0; else throwKnife(); }
      };

      let bgY = NaN, bgH = NaN, bgS = -1, bgG = null;
      function bgFill(ctx, A) {
        if (A.y !== bgY || A.h !== bgH || g.stage !== bgS || !bgG) {
          const p = BGS[g.stage % BGS.length];
          bgG = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); bgG.addColorStop(0, p[0]); bgG.addColorStop(1, p[1]);
          bgY = A.y; bgH = A.h; bgS = g.stage;
        }
        return bgG;
      }
      function drawDebris(ctx) {
        const R = c.R;
        for (const d of g.debris) {
          ctx.save();
          ctx.globalAlpha = 1 - clamp((d.t - 0.7) / 0.8, 0, 1);
          ctx.translate(c.cx + d.x * R, c.cy + d.y * R); ctx.rotate(d.rot);
          if (d.k === 0) {
            ctx.fillStyle = WOOD.bark; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, d.a0, d.a1); ctx.closePath(); ctx.fill();
            ctx.fillStyle = WOOD.face; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.85, d.a0, d.a1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = WOOD.ring; ctx.lineWidth = Math.max(1.5, R * 0.035);
            ctx.beginPath(); ctx.arc(0, 0, R * 0.62, d.a0, d.a1); ctx.stroke();
          } else if (d.k === 1) { ctx.translate(0, -c.KL / 2); drawKnife(ctx, c.KL); }
          else drawApple(ctx, R * 0.2, d.half);
          ctx.restore();
        }
      }
      inst.draw = (ctx, A) => {
        geo(A);
        const { R, KL, cx, cy } = c;
        ctx.fillStyle = bgFill(ctx, A); ctx.fillRect(A.x, A.y, A.w, A.h);
        // the knife in flight goes under the log, so its tip disappears into the wood
        for (const fl of g.flights) {
          const tipY = lerp(c.rest, cy + c.r1, fl.f);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - KL * 0.05, tipY + KL, KL * 0.1, Math.max(0, c.rest - tipY) * 0.7);
          ctx.save(); ctx.translate(cx, tipY); drawKnife(ctx, KL); ctx.restore();
        }
        if (!g.broken) {
          const s = easeOutBack(clamp((PG.now - g.born) / 0.35, 0, 1));
          const hk = clamp((PG.now - g.hitAt) / 0.14, 0, 1), bump = R * 0.07 * (1 - hk) * (1 - hk);
          ctx.save(); ctx.translate(cx, cy - bump); ctx.scale(s, s);
          for (const k of g.knives) { ctx.save(); ctx.rotate(k.a + g.rot - DOWN); ctx.translate(0, c.r1); drawKnife(ctx, KL); ctx.restore(); }
          ctx.save(); ctx.rotate(g.rot); drawLogFace(ctx, R); ctx.restore();
          txt(String(inst.progress), 0, R * 0.05, R * 0.66, WOOD.mark, { font: FD });
          if (hk < 1) { ctx.globalAlpha = 0.4 * (1 - hk); ctx.fillStyle = '#FFFFFF'; circle(0, 0, R); ctx.fill(); ctx.globalAlpha = 1; }
          if (g.apple) {
            const ar = R * 0.2 * easeOutBack(clamp((PG.now - g.apple.born) / 0.3, 0, 1));
            ctx.save(); ctx.rotate(g.apple.a + g.rot - DOWN); ctx.translate(0, R + ar * 0.7); drawApple(ctx, ar, 0); ctx.restore();
          }
          ctx.restore();
        }
        drawDebris(ctx);
        // the next knife slides up into the hand
        if (!inst.over && !g.broken && g.left > 0 && PG.now >= g.readyAt) {
          const k = easeOutCubic(clamp((PG.now - g.readyAt) / 0.12, 0, 1));
          ctx.save(); ctx.globalAlpha = k; ctx.translate(cx, c.rest + KL * 0.35 * (1 - k)); drawKnife(ctx, KL); ctx.restore();
        }
        if (g.bounced) {
          const b = g.bounced;
          ctx.save(); ctx.translate(cx + b.x * R, cy + b.y * R); ctx.rotate(b.rot); ctx.translate(0, -KL / 2); drawKnife(ctx, KL); ctx.restore();
        }
        // knives left for this log, bottom-up on the left like the original
        const n = g.quota, step = Math.min(26, A.h * 0.05, (A.h * 0.5) / Math.max(1, n)), L = step * 1.3;
        const qx = A.x + Math.max(20, A.w * 0.07), qy = A.y + A.h - 40;
        for (let i = 0; i < n; i++) {
          ctx.save(); ctx.translate(qx, qy - i * step); ctx.rotate(0.6); ctx.translate(0, -L / 2);
          drawKnife(ctx, L, i < g.left ? INK : 'rgba(39,48,63,0.16)'); ctx.restore();
        }
        // which log of the round this is
        const m = D.logs.length;
        if (m > 1) {
          for (let i = 0; i < m; i++) {
            const x = A.x + A.w - 22 - (m - 1 - i) * 18, y = A.y + 22, cur = i === g.stage && !g.broken;
            ctx.fillStyle = i < g.stage || (i === g.stage && g.broken) ? rgba(ACCENT, 0.45) : cur ? ACCENT : DIM;
            circle(x, y, cur ? 6.5 : 5); ctx.fill();
          }
        }
      };
      return inst;
    }
  });
})();

// Color Switch — after the mobile classic. Tap to hop up; pass only through your own colour; the orb changes it.
(function () {
  const PG = window.PG;
  const { PAL, INK, FD, FB, clamp, rand, randi, shuffle, circle, rrect, txt, dot } = PG;
  const TAU = Math.PI * 2, Q = Math.PI / 2;
  // World lengths are in units U of about one arena width, y grows upward; the ball always sits at x = 0.
  const BALL_Y = 0.64;                                          // the camera keeps the rising ball at this share of the arena height
  const GRAV = 3.7, JUMP = 1.12, VMAX = 1.6, BR = 0.036, STEP = 1 / 120; // physics, the same at every level
  const ORB_R = 0.05, STAR_R = 0.048;
  const KINDS = ['ring', 'bar', 'cross', 'twin', 'ring2', 'bar2'];
  const FRESH = { 3: 'bar', 4: 'cross', 5: 'twin', 6: 'ring2', 8: 'bar2' }; // the kind a level introduces comes third
  const HUES = [226, 196, 160, 330, 262, 18];
  const goalOf = lv => Math.min(4 + lv, 14);
  const mod = (a, m) => ((a % m) + m) % m;
  const seg = (a, rot) => Math.floor(mod(a - rot, TAU) / Q) & 3; // the quarter of a ring at screen angle a

  function orbShape(ctx, x, y, r, spin) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = PAL[i];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, spin + i * Q, spin + (i + 1) * Q + 0.01); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, r * 0.2); circle(x, y, r); ctx.stroke();
  }
  function starShape(ctx, x, y, r, spin) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = spin - Q + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = PAL[1]; ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.lineJoin = 'round'; ctx.stroke();
  }

  PG.arcade.register({
    id: 'colorswitch',
    title: 'Color Switch',
    family: 'Класика',
    accent: PAL[0],
    howto: ['Тапай, щоб м’ячик підстрибнув', 'Пролітай лише крізь свій колір'],
    goal: lv => ({ count: goalOf(lv), unit: 'перешкод' }),
    icon(ctx, x, y, r) {
      ctx.lineWidth = r * 0.24; ctx.lineCap = 'butt';
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = PAL[i]; ctx.beginPath(); ctx.arc(x, y, r * 0.62, i * Q - Q / 2, (i + 1) * Q - Q / 2 + 0.02); ctx.stroke(); }
      dot(x, y + r * 0.1, r * 0.2, PAL[0]);
    },
    create(level) {
      const lv = Math.max(1, level | 0), L = lv - 1;
      // Difficulty, all in one place (lengths in U, speeds per second). Level 1: slow single rings with thick bands,
      // a small hitbox, forgiving seams and wide gaps. Every level spins a little faster and tightens a little;
      // bars arrive at 3, crosses at 4, twin rings at 5, double rings at 6, swinging rings at 7, double bars at 8.
      const D = {
        spin: Math.min(1.15 + L * 0.1, 2.1),       // ring and cross spin, rad/s
        slide: Math.min(0.3 + L * 0.03, 0.58),     // bar slide speed
        ramp: 0.03, rampCap: 10,                   // inside a round: +3% speed per obstacle, up to +30%
        R: Math.max(0.37 - L * 0.005, 0.32),       // ring radius (middle of the band)
        band: Math.max(0.042 - L * 0.001, 0.033),  // half thickness of every band, bar and arm
        gap: Math.max(0.62 - L * 0.018, 0.46),     // free space between obstacles; the colour orb sits in the middle
        hitK: Math.min(0.6 + L * 0.03, 0.86),      // the ball's hitbox as a share of its drawn radius
        seam: Math.max(0.03 - L * 0.0025, 0.008),  // a wrong colour may overlap the ball this far past a seam, forgiven
        flip: lv >= 2 ? 0.5 : 0,                   // chance an obstacle turns the other way
        swing: lv >= 7 ? 0.3 : 0,                  // chance a ring swings back and forth instead of turning
        star: 0.45,                                // chance of a star (the first obstacle always has one)
        mix: { ring: 3, bar: lv >= 3 ? 1.2 : 0, cross: lv >= 4 ? 1 : 0, twin: lv >= 5 ? 1 : 0, ring2: lv >= 6 ? 1 : 0, bar2: lv >= 8 ? 0.8 : 0 }
      };
      const goal = goalOf(lv);
      const b = { y: 0, vy: 0, col: randi(4), swAt: -9 };
      const V = { U: 300, X: 0, Y0: 0 };
      const C = { h: -1, grad: null, gy: 0, gh: 0, num: '' };
      let cam = 0.24, clock = 0, started = false, deadAt = -9, passAt = -9, hue = HUES[0];
      const inst = { progress: 0, over: null, stats: { level: lv, taps: 0, stars: 0, orbs: 0 } };

      /* ---- the course: every obstacle is built up front, stacked with a gap and an orb between ---- */
      function pickType(prev) {
        let tot = 0;
        for (const t of KINDS) if (t === 'ring' || t !== prev) tot += D.mix[t];
        let r = Math.random() * tot;
        for (const t of KINDS) {
          if (t !== 'ring' && t === prev) continue;
          r -= D.mix[t];
          if (r < 0) return t;
        }
        return 'ring';
      }
      function make(type, k) {
        const sp = 1 + D.ramp * Math.min(k, D.rampCap), dir = Math.random() < D.flip ? -1 : 1;
        const o = {
          type, y: 0, hh: 0, rot: rand(0, TAU), w: D.spin * sp * dir, amp: 0, base: 0, ph: 0, cols: shuffle([0, 1, 2, 3]),
          R: D.R, R2: 0, h: D.band, off: 0, len: 0, sw: 0.5, dy: 0, passed: false, orb: null, star: null, pop: 0
        };
        if (type === 'ring2') { o.R = Math.min(D.R + 0.03, 0.4); o.R2 = o.R - 2 * D.band - 0.035; o.w *= 0.9; }
        else if (type === 'twin') { o.R = D.R * 0.82; o.off = o.R * 0.34; } // the lens between them leaves room to hover
        else if (type === 'cross') { // arms always sweep up across the path, so the ball can follow one through
          o.off = (randi(2) ? 1 : -1) * 0.2; o.len = 0.3; o.w = Math.sign(o.off) * Math.abs(o.w) * 0.75;
        }
        else if (type === 'bar' || type === 'bar2') { o.w = D.slide * sp * dir; o.rot = rand(0, 4 * o.sw); o.dy = type === 'bar2' ? 0.1 : 0; }
        if ((type === 'ring' || type === 'ring2' || type === 'twin') && k > 0 && Math.random() < D.swing) {
          o.amp = Math.PI * 1.15; o.base = o.rot; o.ph = rand(0, TAU); // swings ±207°, so every colour still reaches the path
        }
        o.hh = type === 'bar' || type === 'bar2' ? o.dy + o.h : type === 'cross' ? o.len + o.h : o.R + o.h;
        return o;
      }
      const obs = [];
      let edge = 0.45, prev = '';
      for (let k = 0; k < goal; k++) {
        const o = make(k === 0 ? 'ring' : k === 2 && FRESH[lv] ? FRESH[lv] : pickType(prev), k);
        o.y = edge + o.hh;
        // the orb sits low in the gap: a ball that grabs it mid-hop still stops short of the next obstacle
        if (k > 0) o.orb = { y: edge - D.gap * 0.62, at: 0 };
        const open = o.type === 'ring' || o.type === 'ring2' || o.type === 'twin'; // a star fits in the hollow
        if (k === 0 || Math.random() < D.star) o.star = { y: open ? o.y : edge - D.gap * 0.22, at: 0 };
        edge = o.y + o.hh + D.gap; prev = o.type;
        obs.push(o);
      }
      const last = obs[obs.length - 1], finishY = last.y + last.hh + BR;

      /* ---- motion and collision (screen angles: 0 right, π/2 down) ---- */
      function spin(o, dt) {
        if (o.amp) { o.ph += dt * Math.abs(o.w) / o.amp; o.rot = o.base + o.amp * Math.sin(o.ph); }
        else if (o.type === 'bar' || o.type === 'bar2') o.rot = mod(o.rot + o.w * dt, 4 * o.sw);
        else o.rot = mod(o.rot + o.w * dt, TAU);
      }
      // A ring band against the ball (0, by): finds the angular span the ball covers on the band, trims the seam
      // allowance off both ends and checks the colour at each end. mir: the ring mirrored about x = 0.
      function ringHit(o, cx, R, mir, by, col, rh) {
        const dx = -cx, dy = o.y - by, d = Math.hypot(dx, dy);
        if (d < 1e-6 || Math.abs(d - R) >= o.h + rh) return false;
        const lo = Math.max(R - o.h, d - rh), hi = Math.min(R + o.h, d + rh);
        const p = clamp(Math.sqrt(Math.max(0, d * d - rh * rh)), lo, hi);
        const half = Math.acos(clamp((p * p + d * d - rh * rh) / (2 * p * d), -1, 1)) - D.seam / R;
        const a = mir ? Math.PI - Math.atan2(dy, dx) : Math.atan2(dy, dx);
        if (half <= 0) return o.cols[seg(a, o.rot)] !== col;
        return o.cols[seg(a - half, o.rot)] !== col || o.cols[seg(a + half, o.rot)] !== col;
      }
      const barCol = (o, x, mir) => o.cols[Math.floor(mod((mir ? -x : x) - o.rot, 4 * o.sw) / o.sw) & 3];
      function barHit(o, yb, mir, by, col, rh) {
        const dy = Math.abs(by - yb);
        if (dy >= o.h + rh) return false;
        const s = (dy <= o.h ? rh : Math.sqrt(rh * rh - (dy - o.h) * (dy - o.h))) - D.seam;
        if (s <= 0) return barCol(o, 0, mir) !== col;
        return barCol(o, -s, mir) !== col || barCol(o, s, mir) !== col;
      }
      function crossHit(o, by, col, rh) {
        const px = -o.off, py = o.y - by;
        for (let i = 0; i < 4; i++) {
          if (o.cols[i] === col) continue;
          const a = o.rot + i * Q, ux = Math.cos(a), uy = Math.sin(a);
          const t = clamp(px * ux + py * uy, 0, o.len);
          if (Math.hypot(px - t * ux, py - t * uy) < o.h + rh - D.seam * 0.5) return true;
        }
        return false;
      }
      function hitOb(o, by, col, rh) {
        switch (o.type) {
          case 'ring': return ringHit(o, 0, o.R, false, by, col, rh);
          case 'ring2': return ringHit(o, 0, o.R, false, by, col, rh) || ringHit(o, 0, o.R2, true, by, col, rh);
          case 'twin': return ringHit(o, -o.off, o.R, false, by, col, rh) || ringHit(o, o.off, o.R, true, by, col, rh);
          case 'bar': return barHit(o, o.y, false, by, col, rh);
          case 'bar2': return barHit(o, o.y - o.dy, false, by, col, rh) || barHit(o, o.y + o.dy, true, by, col, rh);
          case 'cross': return crossHit(o, by, col, rh);
        }
        return false;
      }

      /* ---- view ---- */
      function view(A) {
        V.U = Math.max(40, Math.min(A.w, A.h * 0.66)) || 300;
        V.X = A.x + A.w / 2;
        V.Y0 = A.y + A.h * BALL_Y + cam * V.U; // screen y of world height 0
      }
      const sy = y => V.Y0 - y * V.U;
      const bottomOf = A => cam - (1 - BALL_Y) * A.h / V.U; // world height of the arena's bottom edge

      /* ---- play ---- */
      function die(A, cause) {
        inst.over = { won: false, cause }; deadAt = clock;
        const x = V.X, y = Math.min(sy(b.y), A.y + A.h - 16);
        PG.sfx.die(); PG.shake(cause === 'fall' ? 4 : 8);
        PG.burst(x, y, PAL[b.col], 20, 240);
        for (let i = 1; i < 4; i++) PG.burst(x, y, PAL[(b.col + i) % 4], 4, 170);
        PG.floatText(x, y - 34, cause === 'fall' ? 'Упав!' : 'Не той колір!', INK, 19);
      }
      function takeOrb(o) {
        o.orb.at = clock; inst.stats.orbs++;
        b.col = (b.col + 1 + randi(3)) % 4; b.swAt = clock; // every obstacle carries all four colours
        const y = sy(o.orb.y);
        PG.sfx.pop(); PG.buzz(PG.HAP.light);
        for (let i = 0; i < 4; i++) PG.burst(V.X, y, PAL[i], 4, 140);
      }
      function takeStar(o) {
        o.star.at = clock; inst.stats.stars++;
        const y = sy(o.star.y);
        PG.reward({ energy: 1, score: 20, x: V.X, y: y - 26 });
        PG.sfx.candy(); PG.buzz(PG.HAP.double);
        PG.burst(V.X, y, PAL[1], 12, 160);
      }
      function pass(o) {
        o.passed = true; inst.progress++; passAt = clock;
        PG.reward({ score: 10 });
        PG.sfx.chain(Math.min(inst.progress + 1, 10)); PG.buzz(PG.HAP.tick);
        PG.burst(V.X, sy(b.y), '#FFFFFF', 6, 110);
      }
      function step(h, A) {
        for (const o of obs) spin(o, h);
        b.vy = Math.max(b.vy - GRAV * h, -VMAX);
        b.y += b.vy * h;
        const bottom = bottomOf(A);
        if (b.y < 0 && -BR > bottom) { b.y = 0; b.vy = 0; } // the start pad catches the ball while it is on screen
        if (b.y + BR < bottom) { die(A, 'fall'); return; }
        const rh = BR * D.hitK;
        for (const o of obs) {
          if (Math.abs(b.y - o.y) > o.hh + BR) continue;
          if (hitOb(o, b.y, b.col, rh)) { die(A, 'color'); return; }
        }
        for (const o of obs) {
          if (o.orb && !o.orb.at && Math.abs(b.y - o.orb.y) < BR + ORB_R * 0.8) takeOrb(o);
          if (o.star && !o.star.at && Math.abs(b.y - o.star.y) < BR + STAR_R) takeStar(o);
          if (!o.passed && b.y - BR > o.y + o.hh) pass(o);
        }
      }

      inst.peek = () => ({ b, obs, D, cam, goal, finishY, hit: hitOb, spin, BR, GRAV, JUMP, VMAX, BALL_Y, STEP }); // for automated checks
      inst.idle = dt => { if (!started) for (const o of obs) spin(o, dt); }; // a paused round stays frozen
      inst.start = () => { started = true; };
      inst.tap = () => {
        if (inst.over || !started) return;
        b.vy = JUMP; inst.stats.taps++;
        PG.sfx.flap();
      };
      inst.win = () => {
        for (const o of obs) {
          o.pop = clock;
          const y = sy(o.y);
          if (y > PG.arena.y - 40 && y < PG.arena.y + PG.arena.h + 40) PG.burst(V.X + o.off * V.U, y, PAL[o.cols[0]], 10, 200);
        }
        for (let i = 0; i < 4; i++) PG.burst(V.X, sy(b.y), PAL[i], 6, 190);
      };
      inst.update = (dt, A) => {
        view(A);
        hue += (HUES[Math.floor(inst.progress / 3) % HUES.length] - hue) * Math.min(1, dt * 3);
        if (!started) return;
        if (inst.over) {
          clock += dt;
          for (const o of obs) spin(o, dt);
          if (inst.over.won) { b.vy += (0.3 - b.vy) * Math.min(1, dt * 4); b.y += b.vy * dt; }
        } else {
          let left = dt;
          while (left > 1e-6 && !inst.over) { const h = Math.min(STEP, left); clock += h; left -= h; step(h, A); }
        }
        if (b.y > cam && !(inst.over && !inst.over.won)) cam += (b.y - cam) * Math.min(1, dt * 8);
      };

      /* ---- drawing ---- */
      function paint(ctx, A) {
        const h = Math.round(hue);
        if (h !== C.h || !C.grad || C.gy !== A.y || C.gh !== A.h) {
          const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
          g.addColorStop(0, `hsl(${h},58%,95%)`); g.addColorStop(1, `hsl(${h + 24},46%,87%)`);
          C.h = h; C.grad = g; C.gy = A.y; C.gh = A.h; C.num = `hsla(${h},32%,30%,0.11)`;
        }
        ctx.fillStyle = C.grad; ctx.fillRect(A.x, A.y, A.w, A.h);
        const pk = clamp(1 - (clock - passAt) / 0.3, 0, 1);
        txt(String(inst.progress), V.X, A.y + A.h * 0.3, Math.min(A.w * 0.42, A.h * 0.27) * (1 + 0.12 * pk), C.num, { font: FD });
      }
      function arcs(ctx, o, cx, R, mir, hl) {
        const U = V.U, x = V.X + cx * U, y = sy(o.y), w = 2 * o.h * U;
        ctx.lineCap = 'butt';
        for (let layer = 0; layer < 2; layer++) { // the ball's own colour goes on top
          for (let i = 0; i < 4; i++) {
            const mine = hl && o.cols[i] === b.col;
            if (mine !== (layer === 1)) continue;
            const a0 = mir ? Math.PI - o.rot - (i + 1) * Q : o.rot + i * Q;
            ctx.lineWidth = mine ? w * (1.1 + 0.12 * Math.sin(PG.now * 7)) : w;
            ctx.strokeStyle = PAL[o.cols[i]];
            ctx.beginPath(); ctx.arc(x, y, R * U, a0 - 0.006, a0 + Q + 0.006); ctx.stroke();
          }
        }
      }
      function bar(ctx, A, o, yb, mir) {
        const U = V.U, half = A.w / 2 / U + 0.02, top = sy(yb + o.h), hp = 2 * o.h * U;
        for (let k = Math.floor((-half - o.rot) / o.sw); o.rot + k * o.sw < half; k++) {
          const a = Math.max(o.rot + k * o.sw, -half), e = Math.min(o.rot + (k + 1) * o.sw, half);
          ctx.fillStyle = PAL[o.cols[k & 3]];
          ctx.fillRect(V.X + (mir ? -e : a) * U - 0.5, top, (e - a) * U + 1, hp);
        }
      }
      function cross(ctx, o) {
        const U = V.U, x = V.X + o.off * U, y = sy(o.y);
        ctx.lineWidth = 2 * o.h * U; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const a = o.rot + i * Q;
          ctx.strokeStyle = PAL[o.cols[i]];
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * o.len * U, y + Math.sin(a) * o.len * U); ctx.stroke();
        }
        ctx.fillStyle = '#FFFFFF'; circle(x, y, o.h * 1.25 * U); ctx.fill();
      }
      function drawOb(ctx, A, o, hl) {
        const U = V.U;
        if (sy(o.y - o.hh) < A.y - 4 || sy(o.y + o.hh) > A.y + A.h + 4) return;
        let k = 0;
        if (o.pop) { k = (clock - o.pop) / 0.4; if (k >= 1) return; }
        if (k > 0) {
          const cx = V.X + o.off * U, cy = sy(o.y), s = 1 + 0.25 * k;
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
        }
        if (o.type === 'ring') arcs(ctx, o, 0, o.R, false, hl);
        else if (o.type === 'ring2') { arcs(ctx, o, 0, o.R, false, hl); arcs(ctx, o, 0, o.R2, true, hl); }
        else if (o.type === 'twin') { arcs(ctx, o, -o.off, o.R, false, hl); arcs(ctx, o, o.off, o.R, true, hl); }
        else if (o.type === 'bar') bar(ctx, A, o, o.y, false);
        else if (o.type === 'bar2') { bar(ctx, A, o, o.y - o.dy, false); bar(ctx, A, o, o.y + o.dy, true); }
        else if (o.type === 'cross') cross(ctx, o);
        if (k > 0) ctx.restore();
      }
      function pickups(ctx, A) {
        const U = V.U;
        for (const o of obs) {
          if (o.orb) {
            const y = sy(o.orb.y), k = o.orb.at ? (clock - o.orb.at) / 0.25 : 0;
            if (k < 1 && y > A.y - 30 && y < A.y + A.h + 30) {
              ctx.globalAlpha = 1 - k;
              orbShape(ctx, V.X, y, ORB_R * U * (1 + 0.05 * Math.sin(PG.now * 5) + k * 0.8), PG.now * 1.5);
              ctx.globalAlpha = 1;
            }
          }
          if (o.star) {
            const k = o.star.at ? (clock - o.star.at) / 0.3 : 0, y = sy(o.star.y) - Math.sin(PG.now * 4 + o.y) * 2.5 - k * 24;
            if (k < 1 && y > A.y - 30 && y < A.y + A.h + 30) {
              ctx.globalAlpha = 1 - k;
              starShape(ctx, V.X, y, STAR_R * U * (1 + k * 0.4), Math.sin(PG.now * 2 + o.y) * 0.18);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
      // A chequered strip where the last obstacle counts as passed: the round's finish line.
      function finish(ctx, A) {
        const y = sy(finishY);
        if (y < A.y - 40 || y > A.y + A.h + 10) return;
        const s = Math.max(5, 0.026 * V.U), n = Math.ceil(A.w / s);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(A.x, y - s, A.w, 2 * s);
        ctx.fillStyle = 'rgba(39,48,63,0.55)';
        for (let i = 0; i < n; i++) ctx.fillRect(A.x + i * s, y - s + (i % 2) * s, s, s);
        txt('ФІНІШ', V.X, y - s - 15, 13, 'rgba(39,48,63,0.6)', { font: FD });
      }
      function pad(ctx, A) {
        const U = V.U, y = sy(-BR);
        if (y > A.y + A.h + 10) return;
        ctx.fillStyle = 'rgba(39,48,63,0.16)'; rrect(V.X - 0.12 * U, y + 2, 0.24 * U, Math.max(6, 0.026 * U), 6); ctx.fill();
        if (lv <= 2 && inst.progress === 0 && !inst.over) { // first rounds: the one rule, under the start pad
          const ty = y + 0.026 * U + 26;
          ctx.font = `900 14px ${FB}`;
          const tw = ctx.measureText('Тільки крізь свій колір').width;
          dot(V.X - tw / 2 - 6, ty, 7, PAL[b.col]);
          txt('Тільки крізь свій колір', V.X + 8, ty + 1, 14, 'rgba(39,48,63,0.72)', { font: FB, weight: 900 });
        }
      }
      function ball(ctx, A) {
        const U = V.U, r = BR * U, x = V.X;
        let y = sy(b.y);
        if (!started) y -= Math.abs(Math.sin(PG.now * 3.2)) * r * 0.9; // hops on the pad during the intro card
        const sk = (clock - b.swAt) / 0.35;
        if (sk >= 0 && sk < 1) { ctx.strokeStyle = PAL[b.col]; ctx.globalAlpha = 1 - sk; ctx.lineWidth = 3; circle(x, y, r * (1.2 + sk * 2.2)); ctx.stroke(); ctx.globalAlpha = 1; }
        const pk = (clock - passAt) / 0.35;
        if (pk >= 0 && pk < 1) { ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 1 - pk; ctx.lineWidth = 4 * (1 - pk) + 1; circle(x, y, r * (1.3 + pk * 3)); ctx.stroke(); ctx.globalAlpha = 1; }
        if (inst.over && !inst.over.won) return; // shattered
        ctx.fillStyle = '#FFFFFF'; circle(x, y, r + Math.max(2.5, r * 0.2)); ctx.fill();
        dot(x, y, r, PAL[b.col]);
      }
      inst.draw = (ctx, A) => {
        view(A);
        paint(ctx, A);
        finish(ctx, A);
        const next = obs[inst.progress], hl = lv <= 2 && inst.progress < 2;
        for (const o of obs) drawOb(ctx, A, o, hl && o === next && !inst.over);
        pickups(ctx, A);
        pad(ctx, A);
        ball(ctx, A);
        const fk = (clock - deadAt) / 0.25; // a white flash when the ball breaks
        if (fk >= 0 && fk < 1) { ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - fk)})`; ctx.fillRect(A.x, A.y, A.w, A.h); }
      };
      view(PG.arena);
      return inst;
    }
  });
})();

// Pull the Pin — the "hero rescue" ad parody: pull the right pins so the gold, not the lava, falls to the hero.
(function () {
  const PG = window.PG;
  const { PAL, INK, FD, FB, clamp, easeOutBack, circle, rrect, txt, randi } = PG;
  const GOLD = PAL[1], GOLD_RIM = '#DA9216', LAVA = '#F0562E', LAVA_HOT = '#FFA046', HERO = PAL[2], HANDLE = PAL[3];
  const GLASS = '#AEBDD3', SOLID = 'rgba(174,189,211,0.55)', STEEL = '#8C98AF', STEEL_HI = '#C9D1DE', BURNT = '#454A57';
  const WW = 100, WH = 132, FLOOR = 126; // the vessel lives in a 100×132 world box, fitted into the ad area every frame

  // Hand-made vessels in world units. outline: the glass silhouette; solids: filled dead corners; walls: [x1, y1, x2, y2];
  // pins: [y, wall x, inner x] (the handle sits outside the wall); gold / lava: the room [x0, y0, x1, floor y] each starts in;
  // hero: the hero's x on the floor; zone: everything below this y is the hero's chamber.
  const LAYOUTS = [
    { // tower: the lava rests right above the gold, so only the lower pin is safe
      outline: [26, 4, 74, 4, 74, 84, 86, 96, 86, FLOOR, 14, FLOOR, 14, 96, 26, 84],
      solids: [],
      walls: [[26, 4, 26, 84], [74, 4, 74, 84], [26, 84, 14, 96], [74, 84, 86, 96], [14, 96, 14, FLOOR], [86, 96, 86, FLOOR], [14, FLOOR, 86, FLOOR]],
      pins: [[44, 26, 74], [80, 74, 26]],
      gold: [26, 44, 74, 80], lava: [26, 4, 74, 44], hero: 50, zone: 86
    },
    { // two rooms over one shaft: open the gold room and the gate, never the lava room
      outline: [14, 4, 86, 4, 86, FLOOR, 14, FLOOR],
      solids: [[14, 58, 42, 80, 42, 92, 14, 92], [86, 58, 58, 80, 58, 92, 86, 92]],
      walls: [[14, 4, 14, FLOOR], [86, 4, 86, FLOOR], [14, FLOOR, 86, FLOOR], [50, 4, 50, 46], [14, 58, 42, 80], [86, 58, 58, 80], [42, 80, 42, 92], [58, 80, 58, 92]],
      pins: [[46, 14, 50], [46, 86, 50], [92, 14, 58]],
      gold: [14, 4, 50, 46], lava: [50, 4, 86, 46], hero: 50, zone: 97
    },
    { // trap: the pin right above the hero holds the lava; the gold comes down the other side in two steps
      outline: [14, 4, 86, 4, 86, FLOOR, 14, FLOOR],
      solids: [[86, 108, 86, FLOOR, 62, FLOOR]],
      walls: [[14, 4, 14, FLOOR], [86, 4, 86, FLOOR], [14, FLOOR, 86, FLOOR], [50, 4, 50, 78], [86, 108, 62, FLOOR]],
      pins: [[38, 86, 50], [68, 86, 50], [78, 14, 50]],
      gold: [50, 4, 86, 38], lava: [14, 40, 50, 78], hero: 30, zone: 84
    }
  ];

  // Rising pop-up text drawn by the game itself, so it stays clipped to the play rect and shakes with it.
  function popText(ctx, x, y, text, color, size, k) {
    const s = easeOutBack(clamp(k * 4, 0, 1)), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y - k * 34); ctx.scale(s, s);
    ctx.font = `800 ${size}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function poly(ctx, pts, v) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(v.ox + pts[i] * v.s, v.oy + pts[i + 1] * v.s);
    ctx.closePath();
  }
  function drawHero(ctx, x, y, s, mood, k) {
    // x, y: feet centre on screen; s: world scale; mood: idle | scared | happy | burnt; k: time in the mood
    const hop = mood === 'happy' ? -Math.abs(Math.sin(k * 9)) * 3.2 * s : Math.sin(PG.now * 3) * 0.35 * s;
    const w = 12 * s, h = 15 * s, top = y - h + hop, cx = x;
    const body = mood === 'burnt' ? BURNT : HERO;
    ctx.fillStyle = mood === 'burnt' ? '#2E323C' : INK;
    rrect(cx - w * 0.36, y - 1.6 * s + hop, w * 0.26, 1.8 * s, 0.9 * s); ctx.fill();
    rrect(cx + w * 0.1, y - 1.6 * s + hop, w * 0.26, 1.8 * s, 0.9 * s); ctx.fill();
    // arms: up when happy or scared
    ctx.strokeStyle = body; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    const up = mood === 'happy' || mood === 'scared', wave = mood === 'happy' ? Math.sin(k * 14) * 1.2 * s : 0;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * w * 0.42, top + h * 0.55);
      if (up) ctx.lineTo(cx + sd * w * 0.78, top + h * 0.12 + wave * sd); else ctx.lineTo(cx + sd * w * 0.62, top + h * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = body; rrect(cx - w / 2, top, w, h - 1.2 * s, w * 0.48); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; circle(cx - w * 0.18, top + h * 0.22, w * 0.14); ctx.fill();
    const ey = top + h * 0.36, ex = w * 0.2;
    if (mood === 'burnt') {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.7 * s;
      for (const sd of [-1, 1]) {
        const qx = cx + sd * ex, d = 1.1 * s;
        ctx.beginPath(); ctx.moveTo(qx - d, ey - d); ctx.lineTo(qx + d, ey + d); ctx.moveTo(qx + d, ey - d); ctx.lineTo(qx - d, ey + d); ctx.stroke();
      }
      // smoke
      for (let i = 0; i < 3; i++) {
        const q = (k * 0.8 + i / 3) % 1;
        ctx.fillStyle = `rgba(110,116,130,${0.45 * (1 - q)})`;
        circle(cx + Math.sin(q * 6 + i) * 2.5 * s, top - q * 14 * s, (1.6 + q * 2.4) * s); ctx.fill();
      }
      return;
    }
    if (mood === 'happy') {
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * s;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sd * ex, ey + 0.5 * s, 1.3 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, top + h * 0.56, 2 * s, 0, Math.PI); ctx.fill();
      return;
    }
    const er = mood === 'scared' ? 2.1 * s : 1.8 * s;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#FFFFFF'; circle(cx + sd * ex, ey, er); ctx.fill();
      ctx.fillStyle = INK; circle(cx + sd * ex, ey - 0.6 * s, er * 0.5); ctx.fill();
    }
    ctx.fillStyle = INK;
    if (mood === 'scared') { circle(cx, top + h * 0.6, 1.2 * s); ctx.fill(); }
    else { ctx.strokeStyle = INK; ctx.lineWidth = 0.7 * s; ctx.beginPath(); ctx.arc(cx, top + h * 0.52, 1.4 * s, 0.2, Math.PI - 0.2); ctx.stroke(); }
  }

  PG.ads.register({
    id: 'pin',
    title: 'Pull the Pin',
    hook: '99% не витягнуть правильну шпильку!',
    create() {
      // Difficulty (an ad has no levels): time limit, the share of gold that must reach the hero, how long the
      // gold must sit there with no lava before the win counts, and the ball counts.
      const TIME = 20, WIN_SHARE = 0.7, SETTLE = 0.6, GOLD_N = 14, LAVA_N = 12;
      // Physics in world units and seconds: ball radius, wall and pin half-thickness, gravity, bounce, fixed substep.
      const R = 3, WALL = 1.4, ROD = 1.6, GRAV = 260, BOUNCE = 0.12, SUB = 1 / 120, VMAX = 190, PULL_T = 0.32;
      const HERO_R = 6.5, HANDLE_R = 4.3, HANDLE_OUT = 7;

      const layout = randi(LAYOUTS.length), mirror = Math.random() < 0.5;
      const src = LAYOUTS[layout];
      const mx = x => mirror ? WW - x : x;
      const mpts = a => a.map((v, i) => i % 2 ? v : mx(v));
      const L = {
        outline: mpts(src.outline), solids: src.solids.map(mpts), walls: src.walls.map(mpts),
        hero: mx(src.hero), zone: src.zone
      };
      const pins = src.pins.map(([y, x0, x1]) => {
        const a = mx(x0), b = mx(x1), dir = b > a ? 1 : -1;
        return { y, x0: a, x1: b, dir, travel: Math.abs(b - a) + HANDLE_OUT + HANDLE_R * 2, pull: 0, pulled: false };
      });
      const balls = [];
      const room = (r, gold, n) => {
        let x0 = mx(r[0]), x1 = mx(r[2]);
        if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
        const m = ROD + R + 0.3, step = 2 * R + 0.3;
        for (let row = 0, placed = 0; placed < n && row < 20; row++) {
          const y = r[3] - m - row * step * 0.88;
          if (y < r[1] + R) break;
          for (let x = x0 + m + (row % 2 ? step / 2 : 0); x <= x1 - m + 0.01 && placed < n; x += step, placed++) {
            balls.push({ x: x + (Math.random() - 0.5) * 0.4, y, vx: 0, vy: 0, gold, y0: y, in: false });
          }
        }
      };
      room(src.gold, true, GOLD_N); room(src.lava, false, LAVA_N);
      const goldTotal = balls.filter(b => b.gold).length, need = Math.ceil(goldTotal * WIN_SHARE);
      const heroY = FLOOR - 7.5;

      let t = 0, acc = 0, got = 0, winAt = 0, endAt = 0, state = 'play', moodAt = 0, lastCoin = 0, scared = false, pulls = 0, shakeAt = -9;
      const pops = []; // { x, y (world), text, color, size, t0 }
      const V = { s: 1, ox: 0, oy: 0 };
      const inst = { over: null, hint: 'Тапни по шпильці, щоб її витягнути', layout, mirror, pins, balls };
      // world → screen fit, refreshed from A every call (also read by automated checks)
      inst.view = A => {
        const top = 34, bot = 26;
        V.s = Math.max(0.05, Math.min((A.w - 12) / WW, (A.h - top - bot) / WH));
        V.ox = A.x + (A.w - WW * V.s) / 2; V.oy = A.y + top + (A.h - top - bot - WH * V.s) / 2;
        return V;
      };

      const pinEnd = p => p.x1 - p.dir * p.travel * p.pull * p.pull;
      function seg(b, x1, y1, x2, y2, hw) {
        const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
        let k = l ? ((b.x - x1) * dx + (b.y - y1) * dy) / l : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        let nx = b.x - (x1 + dx * k), ny = b.y - (y1 + dy * k);
        const d2 = nx * nx + ny * ny, rr = R + hw;
        if (d2 >= rr * rr) return;
        const d = Math.sqrt(d2);
        if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + BOUNCE) * vn * nx; b.vy -= (1 + BOUNCE) * vn * ny;
          const vt = b.vx * -ny + b.vy * nx; // a little rolling friction along the surface
          b.vx -= vt * 0.015 * -ny; b.vy -= vt * 0.015 * nx;
        }
      }
      function pair(a, b) {
        let nx = b.x - a.x, ny = b.y - a.y;
        const d2 = nx * nx + ny * ny, md = 2 * R;
        if (d2 >= md * md) return;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { nx = 0.01; ny = 1; d = 1; } else { nx /= d; ny /= d; }
        const push = (md - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const j = -(1 + BOUNCE) * rv / 2; a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny; }
      }
      function step(h) {
        const n = balls.length;
        for (let i = 0; i < n; i++) {
          const b = balls[i];
          b.vy += GRAV * h; b.vx *= 0.998; b.vy *= 0.998;
          const v2 = b.vx * b.vx + b.vy * b.vy;
          if (v2 > VMAX * VMAX) { const k = VMAX / Math.sqrt(v2); b.vx *= k; b.vy *= k; }
          b.x += b.vx * h; b.y += b.vy * h;
        }
        for (let it = 0; it < 2; it++) {
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pair(balls[i], balls[j]);
          for (let i = 0; i < n; i++) {
            const b = balls[i];
            for (let w = 0; w < L.walls.length; w++) { const s = L.walls[w]; seg(b, s[0], s[1], s[2], s[3], WALL); }
            for (let p = 0; p < pins.length; p++) {
              const q = pins[p], e = pinEnd(q);
              if ((e - q.x0) * q.dir > 0.3) seg(b, q.x0, q.y, e, q.y, ROD);
            }
            seg(b, L.hero, heroY, L.hero, heroY, HERO_R);
            // safety net: nothing may leave the vessel box
            if (b.x < R || b.x > WW - R || b.y > FLOOR) { b.x = clamp(b.x, 15 + R, 85 - R); b.y = Math.min(b.y, FLOOR - R - WALL); b.vx = 0; b.vy = 0; }
          }
        }
      }
      // let the piles come to rest before the first frame
      for (let i = 0; i < 150; i++) step(SUB);
      for (const b of balls) { b.vx = 0; b.vy = 0; b.y0 = b.y; }

      function end(kind, at) {
        state = kind; moodAt = PG.now; endAt = PG.now + at;
      }
      function lose(b) {
        end('lava', 0.85);
        const v = V;
        PG.sfx.die(); shakeAt = PG.now;
        PG.burst(v.ox + L.hero * v.s, v.oy + heroY * v.s, LAVA, 18, 220);
        PG.burst(v.ox + b.x * v.s, v.oy + b.y * v.s, LAVA_HOT, 8, 140);
        pops.push({ x: L.hero, y: heroY - 18, text: 'Ой!', color: LAVA, size: 24, t0: PG.now });
      }
      function win() {
        end('won', 0.6);
        const v = V;
        PG.sfx.candy(); PG.buzz(PG.HAP.double);
        PG.burst(v.ox + L.hero * v.s, v.oy + (heroY - 6) * v.s, GOLD, 22, 220);
        pops.push({ x: L.hero, y: heroY - 18, text: 'УРА!', color: PAL[2], size: 24, t0: PG.now });
      }

      inst.down = (x, y, A) => {
        if (state !== 'play' || !A) return;
        const v = inst.view(A), wx = (x - v.ox) / v.s, wy = (y - v.oy) / v.s;
        let best = null, bd = Math.max(8, 22 / v.s); // slack around the rod and handle: 8 world units, at least 22 px
        for (const p of pins) {
          if (p.pulled) continue;
          const hx = p.x0 - p.dir * HANDLE_OUT, lo = Math.min(hx, p.x1), hi = Math.max(hx, p.x1);
          const dx = wx < lo ? lo - wx : wx > hi ? wx - hi : 0, d = Math.hypot(dx, wy - p.y);
          if (d < bd) { bd = d; best = p; }
        }
        if (!best) return;
        best.pulled = true; pulls++;
        PG.sfx.whoosh(); PG.sfx.pick(); PG.buzz(PG.HAP.light);
        PG.burst(v.ox + (best.x0 - best.dir * HANDLE_OUT) * v.s, v.oy + best.y * v.s, HANDLE, 7, 120);
      };
      inst.update = (dt, A) => {
        if (!(dt > 0)) return;
        if (A) inst.view(A);
        if (state === 'play') t += dt;
        for (const p of pins) if (p.pulled && p.pull < 1) p.pull = Math.min(1, p.pull + dt / PULL_T);
        acc += dt;
        for (let n = 0; acc >= SUB && n < 8; n++) { step(SUB); acc -= SUB; }
        if (acc > SUB) acc = 0;
        const v = V;
        for (const b of balls) {
          if (!b.gold && state === 'play' && b.y > b.y0 + 5) scared = true;
          if (b.y <= L.zone) continue;
          if (!b.gold) { if (state === 'play') lose(b); continue; }
          if (b.in) continue;
          b.in = true; got++;
          if (PG.now - lastCoin > 0.07) { lastCoin = PG.now; PG.sfx.coin(); PG.buzz(PG.HAP.tick); }
          PG.burst(v.ox + b.x * v.s, v.oy + b.y * v.s, GOLD, 3, 90);
        }
        if (state === 'play') {
          if (got >= need) { if (!winAt) winAt = PG.now + SETTLE; else if (PG.now >= winAt) win(); }
          if (state === 'play' && t >= TIME) { end('time', 0); PG.sfx.bad(); }
        }
        for (let i = pops.length - 1; i >= 0; i--) if (PG.now - pops[i].t0 > 1.1) pops.splice(i, 1);
        if (endAt && !inst.over && PG.now >= endAt) inst.over = { won: state === 'won' };
      };
      inst.draw = (ctx, A) => {
        const v = inst.view(A), s = v.s, X = v.ox, Y = v.oy;
        const gr = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
        gr.addColorStop(0, '#E6EFFA'); gr.addColorStop(1, '#F7EBDF');
        ctx.fillStyle = gr; ctx.fillRect(A.x, A.y, A.w, A.h);
        // timer
        const k = clamp(1 - t / TIME, 0, 1), bw = A.w - 74;
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; rrect(A.x + 18, A.y + 14, bw, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.3 ? PG.BAD : PAL[2]; rrect(A.x + 18, A.y + 14, Math.max(8, bw * k), 8, 4); ctx.fill();
        txt(String(Math.ceil(TIME - Math.min(t, TIME))), A.x + A.w - 32, A.y + 18, 15, k < 0.3 ? PG.BAD : INK, { font: FD });
        const sk = PG.REDUCED ? 0 : clamp(1 - (PG.now - shakeAt) / 0.45, 0, 1), roomy = Y - (A.y + 30) >= 44;
        ctx.save();
        if (sk > 0) ctx.translate(Math.sin(PG.now * 97) * 6 * sk, Math.cos(PG.now * 83) * 4 * sk);
        // glass, the big faint gold count, dead corners
        ctx.fillStyle = 'rgba(255,255,255,0.72)'; poly(ctx, L.outline, v); ctx.fill();
        if (roomy || state === 'play') txt(String(Math.min(got, need)), X + 50 * s, Y + 62 * s, 40 * s, 'rgba(39,48,63,0.07)', { font: FD });
        ctx.fillStyle = SOLID;
        for (const p of L.solids) { poly(ctx, p, v); ctx.fill(); }
        // balls
        const pulse = PG.now * 6;
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i], bx = X + b.x * s, by = Y + b.y * s;
          if (b.gold) {
            ctx.fillStyle = GOLD_RIM; circle(bx, by, R * s); ctx.fill();
            ctx.fillStyle = GOLD; circle(bx, by, R * s * 0.74); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.65)'; circle(bx - R * s * 0.3, by - R * s * 0.32, R * s * 0.24); ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(240,86,46,0.2)'; circle(bx, by, R * s * 1.3); ctx.fill();
            ctx.fillStyle = LAVA; circle(bx, by, R * s); ctx.fill();
            ctx.fillStyle = LAVA_HOT; circle(bx + Math.sin(pulse + i) * 0.5 * s, by - 0.4 * s, R * s * (0.42 + 0.08 * Math.sin(pulse * 0.7 + i * 1.7))); ctx.fill();
          }
        }
        // hero
        const mood = state === 'lava' ? 'burnt' : state === 'won' ? 'happy' : scared && state === 'play' ? 'scared' : 'idle';
        drawHero(ctx, X + L.hero * s, Y + FLOOR * s - WALL * s, s, mood, PG.now - moodAt);
        // walls
        ctx.strokeStyle = GLASS; ctx.lineWidth = WALL * 2 * s + 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const w of L.walls) { ctx.beginPath(); ctx.moveTo(X + w[0] * s, Y + w[1] * s); ctx.lineTo(X + w[2] * s, Y + w[3] * s); ctx.stroke(); }
        // pins: rod from the handle to the inner end, sliding out once pulled
        for (let i = 0; i < pins.length; i++) {
          const p = pins[i];
          if (p.pull >= 1) continue;
          const off = p.travel * p.pull * p.pull, hx = X + (p.x0 - p.dir * (HANDLE_OUT + off)) * s, ex = X + (p.x1 - p.dir * off) * s, py = Y + p.y * s;
          ctx.globalAlpha = 1 - p.pull * p.pull;
          ctx.strokeStyle = STEEL; ctx.lineWidth = ROD * 2 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(hx, py); ctx.lineTo(ex, py); ctx.stroke();
          ctx.strokeStyle = STEEL_HI; ctx.lineWidth = ROD * 0.6 * s;
          ctx.beginPath(); ctx.moveTo(hx + p.dir * HANDLE_R * s, py - ROD * 0.35 * s); ctx.lineTo(ex - p.dir * ROD * s, py - ROD * 0.35 * s); ctx.stroke();
          const hr = HANDLE_R * s * (pulls ? 1 : 1 + 0.07 * Math.sin(PG.now * 5 + i * 1.3));
          ctx.fillStyle = HANDLE; circle(hx, py, hr); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; circle(hx, py, hr * 0.45); ctx.fill();
          ctx.globalAlpha = 1;
        }
        for (const p of pops) {
          const k = (PG.now - p.t0) / 1.1;
          if (k >= 0 && k < 1) popText(ctx, X + p.x * s, Y + p.y * s, p.text, p.color, p.size, k);
        }
        ctx.restore();
        // gold counter
        const cy = A.y + A.h - 14, cx = A.x + A.w / 2;
        ctx.fillStyle = GOLD_RIM; circle(cx - 30, cy, 7); ctx.fill();
        ctx.fillStyle = GOLD; circle(cx - 30, cy, 5); ctx.fill();
        txt(`${Math.min(got, need)}/${need}`, cx + 6, cy + 1, 14, INK, { font: FB, weight: 900, align: 'center' });
        // end caption
        if (state !== 'play') {
          const msg = state === 'won' ? 'Врятовано!' : state === 'lava' ? 'Лава дісталась героя' : 'Час вийшов';
          const ka = clamp((PG.now - moodAt) / 0.25, 0, 1), w = Math.min(A.w - 40, 250);
          const py = roomy ? A.y + 34 : Y + 56 * s - 18; // above the vessel when there is room, else across its middle
          ctx.globalAlpha = ka;
          ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(cx - w / 2, py, w, 36, 18); ctx.fill();
          txt(msg, cx, py + 18, 16, state === 'won' ? PAL[2] : state === 'lava' ? LAVA : INK, { font: FD, max: w - 20 });
          ctx.globalAlpha = 1;
        }
      };
      return inst;
    }
  });
})();

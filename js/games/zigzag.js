// ZigZag — after Ketchapp's ZigZag. A ball rolls along a zigzag path; tap to switch its diagonal on the corners.
(function () {
  const PG = window.PG;
  const { PAL, INK, FD, clamp, rand, randi, rrect, txt, dot, rgba } = PG;
  const HUE0 = 168;      // teal, the accent's hue; the world shifts colour every 5 turns
  const KEY = 65536;     // tile map key: i * KEY + j
  const BALL_Y = 0.72;   // the camera keeps the ball at this fraction of the arena height
  const goalOf = lv => Math.min(8 + lv * 2, 30);
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

  // Grid (i, j) goes up-right (+i) and up-left (+j) on screen. A tile is a slab: a diamond top with
  // its bottom vertex at (x, y) and two visible side faces of depth D. part: 0 left face, 1 right face, 2 top.
  function slabPart(ctx, x, y, hw, hh, D, part) {
    if (part === 0) { ctx.moveTo(x - hw, y - hh); ctx.lineTo(x, y); ctx.lineTo(x, y + D); ctx.lineTo(x - hw, y - hh + D); }
    else if (part === 1) { ctx.moveTo(x, y); ctx.lineTo(x + hw, y - hh); ctx.lineTo(x + hw, y - hh + D); ctx.lineTo(x, y + D); }
    else { ctx.moveTo(x, y); ctx.lineTo(x + hw, y - hh); ctx.lineTo(x, y - 2 * hh); ctx.lineTo(x - hw, y - hh); }
    ctx.closePath();
  }
  function gem(ctx, x, y, s) {
    ctx.fillStyle = '#A79CF8';
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.55, y - s * 0.62); ctx.lineTo(x + s * 0.55, y - s * 0.62); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAL[3];
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.55); ctx.lineTo(x - s * 0.18, y - s * 0.55); ctx.lineTo(x - s * 0.42, y); ctx.lineTo(x - s * 0.78, y); ctx.closePath(); ctx.fill();
  }

  PG.arcade.register({
    id: 'zigzag',
    title: 'ZigZag',
    family: 'Ketchapp',
    accent: PAL[2],
    howto: ['Тапни, щоб кулька змінила напрямок', 'Повертай на кутах і не впади з доріжки'],
    goal: lv => ({ count: goalOf(lv), unit: 'поворотів' }),
    icon(ctx, x, y, r) {
      ctx.strokeStyle = PAL[2]; ctx.lineWidth = r * 0.38; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.72); ctx.lineTo(x + r * 0.32, y + r * 0.08); ctx.lineTo(x - r * 0.22, y - r * 0.36); ctx.lineTo(x + r * 0.3, y - r * 0.78); ctx.stroke();
      dot(x + r * 0.32, y - r * 0.16, r * 0.3, PAL[0]);
    },
    create(level) {
      // Difficulty, all in one place. Level 1: a 3-tile-wide path, a slow ball, long runs and generous timing.
      const w = level <= 2 ? 3 : level <= 5 ? 2 : 1;                                       // path width, tiles
      const speed = Math.min(2.2 + (level - 1) * 0.15 - (level >= 6 ? 0.25 : 0), 4.2);     // tiles per second (dips when the path narrows to 1)
      const dmax = level <= 2 ? 8 : level <= 4 ? 7 : level <= 7 ? 6 : level <= 12 ? 5 : 4; // longest run, corner to corner
      const dmin = w + 1;                                                                   // at least one straight tile between corners
      const early = clamp(0.45 - (level - 1) * 0.025, 0.15, 0.45); // a tap this many tiles before a corner waits for it
      const late = clamp(0.4 - (level - 1) * 0.025, 0.15, 0.4);    // the ball may overhang an edge this far and still be turned
      const perfTol = 0.1 + 0.08 * w;                              // "perfect": turn this close to the corner's centre
      const ramp = 0.01, rampCap = 20;                             // +1% speed per turn, up to +20%; runs shorten by 1 after half the goal
      const gemP = 0.35;                                           // chance of a gem on a run
      const Cmax = Math.max(3, Math.ceil(dmax / 2));               // corners stay within ±Cmax tiles of the centre line

      const goal = goalOf(level), P = w + 2; // P: the square start platform
      const tiles = [], map = new Map(), juncs = [], gems = [];
      // The first run is a little longer; the platform sits off-centre so that run fits on screen.
      const dir1 = randi(2), k0 = Math.max(0, Cmax - 2);
      const d1 = Math.min(Math.max(w + 2, dmin + 2), Cmax + k0);
      const cOff = (dir1 ? 1 : -1) * Math.min(k0, Math.round(d1 / 2));
      const b = { i: 1 + w / 2, j: 1 + w / 2, dir: dir1, z: 0, vz: 0, fv: 0, hang: 0, pending: false, last: null };
      const V = { hw: 20, hh: 16, D: 15, r: 10, ox: 0, oy: 0 };
      const C = { h: -1, top: '', left: '', right: '', num: '', grad: null, gy: 0, gh: 0 };
      let clock = 0, started = false, startAt = 0, skipTap = false, reached = 1, camS = b.i + b.j, hue = HUE0;
      let fallIdx = 0, perfStreak = 0, ringAt = -9, ringI = 0, ringJ = 0, numPop = -9, winAt = -1;
      const inst = { progress: 0, over: null, stats: { level, taps: 0, perfects: 0, gems: 0 } };

      /* ---- path: a P×P platform (junction 0), then w×w corner squares joined by straight runs ---- */
      function add(i, j, seg, jn) {
        const k = i * KEY + j;
        if (map.has(k)) return null;
        const t = { i, j, seg, jn, gem: 0, gemAt: 0, fall: -1, z: 0, vz: 0 };
        map.set(k, t); tiles.push(t);
        return t;
      }
      const tileAt = (gi, gj) => map.get(Math.floor(gi) * KEY + Math.floor(gj));
      for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) add(i, j, 0, 0);
      juncs.push({ i: 1, j: 1, dir: dir1 }); // dir: where the run leaving this corner goes
      // Runs strictly alternate direction and each one starts from the previous corner square, so it is always passable.
      function extend() {
        const k = juncs.length - 1, J = juncs[k], D = J.dir, c = J.i - J.j + cOff;
        let d = d1;
        if (k > 0) {
          const top = Math.max(dmin + 1, dmax - (inst.progress * 2 >= goal ? 1 : 0));
          const hi = Math.min(top, D === 0 ? Cmax - c : c + Cmax);
          d = hi > dmin ? dmin + randi(hi - dmin + 1) : dmin;
        }
        const gemStep = k > 0 && Math.random() < gemP ? w + randi(d - w) : -1, gemCol = w === 2 ? randi(2) : (w - 1) / 2;
        for (let s = w; s < d; s++) for (let q = 0; q < w; q++) {
          const t = add(D === 0 ? J.i + s : J.i + q, D === 0 ? J.j + q : J.j + s, k + 1, -1);
          if (t && s === gemStep && q === gemCol) { t.gem = 1; gems.push(t); }
        }
        const ni = D === 0 ? J.i + d : J.i, nj = D === 0 ? J.j : J.j + d;
        for (let a = 0; a < w; a++) for (let q = 0; q < w; q++) add(ni + a, nj + q, -1, k + 1);
        juncs.push({ i: ni, j: nj, dir: 1 - D });
      }
      function ensure(A) {
        const need = b.i + b.j + (A.h > 0 ? A.h : 600) * BALL_Y / V.hh + 8;
        for (let g = 0; g < 40; g++) { const J = juncs[juncs.length - 1]; if (J.i + J.j > need) break; extend(); }
      }

      /* ---- view: tile size from the arena, so a resize or rotation just rescales ---- */
      function view(A) {
        const hw = Math.max(2, Math.min(A.w * 0.47 / (Cmax + w + 0.45), A.h * 0.075)) || 20; // || 20: arena not laid out yet
        V.hw = hw; V.hh = hw * 0.8; V.D = V.hh * 0.95; V.r = hw * (0.38 + 0.07 * w);
        V.ox = A.x + A.w / 2 + cOff * hw;
        V.oy = A.y + A.h * BALL_Y + camS * V.hh;
      }
      const sx = (gi, gj) => V.ox + (gi - gj) * V.hw;
      const sy = (gi, gj) => V.oy - (gi + gj) * V.hh;
      function paint(ctx, A) {
        const h = Math.round(hue);
        if (h !== C.h) {
          C.h = h; C.grad = null;
          C.top = hsl(h, 70, 97); C.left = hsl(h, 36, 62); C.right = hsl(h, 42, 76);
          C.num = `hsla(${h},40%,30%,0.11)`;
        }
        if (!C.grad || C.gy !== A.y || C.gh !== A.h) {
          const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
          g.addColorStop(0, hsl(h + 18, 62, 91)); g.addColorStop(1, hsl(h - 8, 46, 80));
          C.grad = g; C.gy = A.y; C.gh = A.h;
        }
      }

      /* ---- play ---- */
      function turn() {
        const t = tileAt(b.i, b.j), arrive = b.dir;
        b.dir = 1 - b.dir; b.pending = false;
        const x = sx(b.i, b.j), y = sy(b.i, b.j);
        if (t && t.jn >= 1 && t.jn + 1 > reached && b.dir === juncs[t.jn].dir) {
          const J = juncs[t.jn], off = arrive === 0 ? b.i - J.i : b.j - J.j;
          const perfect = Math.abs(off - w / 2) <= perfTol;
          reached = t.jn + 1; inst.progress++;
          perfStreak = perfect ? perfStreak + 1 : 0;
          ringAt = clock; ringI = b.i; ringJ = b.j; numPop = clock;
          PG.reward({ score: perfect ? 15 : 10 });
          PG.sfx.note(inst.progress % 6); PG.buzz(perfect ? PG.HAP.light : PG.HAP.tick);
          PG.burst(x, y, C.left, 6, 90);
          if (perfect) {
            inst.stats.perfects++;
            PG.sfx.chain(Math.min(5 + perfStreak, 10));
            PG.floatText(x, y - V.r * 3, perfStreak > 1 ? 'ІДЕАЛЬНО ×' + perfStreak : 'ІДЕАЛЬНО!', PAL[1], 17);
            PG.burst(x, y - V.r, PAL[1], 8, 130);
          }
        } else { PG.sfx.pick(); PG.buzz(PG.HAP.tick); }
      }
      function fall() {
        const t = b.last;
        inst.over = { won: false, cause: t && t.jn >= 1 && t.jn + 1 > reached ? 'late' : 'early' }; // late: ran past the corner
        b.fv = speed * 0.8; b.vz = 0; perfStreak = 0;
        PG.sfx.die(); PG.shake(6);
        PG.burst(sx(b.i, b.j), sy(b.i, b.j) - V.r, PAL[0], 12, 160);
      }
      function takeGem(t) {
        t.gem = 2; t.gemAt = clock; inst.stats.gems++;
        const x = sx(t.i + 0.5, t.j + 0.5), y = sy(t.i + 0.5, t.j + 0.5) - V.hw * 0.9;
        PG.reward({ energy: 1, score: 20, x, y: y - 18 });
        PG.sfx.candy(); PG.buzz(PG.HAP.double);
        PG.burst(x, y, PAL[3], 12, 150);
      }
      // Tiles well behind the ball (out of its reach: it only ever moves forward) drop away.
      function dropTiles(dt) {
        const sB = b.i + b.j, end = Math.min(tiles.length, fallIdx + 80);
        for (let n = fallIdx; n < end; n++) {
          const t = tiles[n];
          if (t.fall < 0 && t.i + t.j + 2 < sB - 2.5) { t.fall = rand(0, 0.25); map.delete(t.i * KEY + t.j); }
        }
        while (fallIdx < tiles.length && tiles[fallIdx].fall >= 0) fallIdx++;
        for (let n = 0; n < end; n++) {
          const t = tiles[n];
          if (t.fall < 0) continue;
          if (t.fall > 0) { t.fall = Math.max(0, t.fall - dt); continue; }
          t.vz += 26 * dt; t.z += t.vz * dt;
        }
        let gone = 0;
        while (gone < fallIdx && tiles[gone].z > 12) gone++;
        if (gone > 30) { tiles.splice(0, gone); fallIdx -= gone; }
        for (let n = gems.length - 1; n >= 0; n--) {
          const t = gems[n];
          if ((t.gem === 1 && t.fall >= 0) || (t.gem === 2 && clock - t.gemAt > 0.35)) gems.splice(n, 1);
        }
      }

      inst.peek = () => ({ i: b.i, j: b.j, dir: b.dir, reached, hang: b.hang, pending: b.pending, next: juncs[reached], w, speed, dmin, dmax, early, late, Cmax, tiles: tiles.length }); // for automated checks
      inst.idle = (dt, A) => {
        view(A); ensure(A);
        if (!started) b.z = -Math.abs(Math.sin(PG.now * 3.2)) * 0.25;
      };
      inst.start = () => { started = true; startAt = clock; skipTap = true; b.z = 0; PG.sfx.whoosh(); };
      inst.tap = () => {
        if (inst.over || !started) return;
        if (skipTap) { skipTap = false; return; } // the tap that started the round only sets the ball rolling
        if (clock - startAt < 0.25) return;      // and a quick double tap must not throw it off the platform
        inst.stats.taps++;
        if (b.pending) { b.pending = false; PG.sfx.pick(); return; }
        let t = tileAt(b.i, b.j);
        if (!t && b.hang > 0) { // just rolled over an edge: pull back onto it and turn
          if (b.dir === 0) b.i -= b.hang + 0.02; else b.j -= b.hang + 0.02;
          b.hang = 0; t = tileAt(b.i, b.j);
        }
        if (t && t.jn < 1) { // still on a straight: a corner just ahead takes the tap when the ball gets there
          const a = b.dir === 0 ? tileAt(b.i + early, b.j) : tileAt(b.i, b.j + early);
          if (a && a.jn >= 1 && a.jn + 1 > reached) { b.pending = true; PG.sfx.tick(); PG.buzz(PG.HAP.tick); return; }
        }
        turn();
      };
      inst.win = () => { winAt = clock; b.pending = false; };
      inst.update = (dt, A) => {
        clock += dt;
        view(A); ensure(A);
        hue += (HUE0 + Math.floor(inst.progress / 5) * 40 - hue) * Math.min(1, dt * 3);
        dropTiles(dt);
        if (!started) return;
        const won = !!(inst.over && inst.over.won);
        if (inst.over && !won) { // falling: keep rolling a little, then drop behind the path
          b.fv *= Math.pow(0.25, dt);
          if (b.dir === 0) b.i += b.fv * dt; else b.j += b.fv * dt;
          b.vz += 28 * dt; b.z += b.vz * dt;
          camS += (b.i + b.j - camS) * Math.min(1, dt * 3);
          return;
        }
        let v = speed * (1 + Math.min(inst.progress, rampCap) * ramp);
        if (won) { // roll to a stop and hop
          const e = clock - winAt;
          v *= 1 - clamp(e / 0.4, 0, 1);
          b.z = -Math.abs(Math.sin(e * 8)) * 0.6 * Math.max(0, 1 - e / 1.2);
        }
        const step = v * dt;
        if (b.dir === 0) b.i += step; else b.j += step;
        // keep the ball half a tile in from the edges of its run, so late turns still look tidy
        const J = juncs[reached - 1];
        if (J && b.dir === J.dir) {
          const lo = (b.dir === 0 ? J.j : J.i) + 0.5, k = Math.min(1, dt * 8);
          if (b.dir === 0) b.j += (clamp(b.j, lo, lo + w - 1) - b.j) * k; else b.i += (clamp(b.i, lo, lo + w - 1) - b.i) * k;
        }
        camS += (b.i + b.j - camS) * Math.min(1, dt * 10);
        const t = tileAt(b.i, b.j);
        if (t) {
          b.hang = 0; b.last = t;
          if (b.pending && t.jn >= 1 && t.jn + 1 > reached) turn();
          if (t.gem === 1) takeGem(t);
        } else if (!won) {
          b.hang += step;
          if (b.hang > late) fall();
        }
      };

      /* ---- drawing ---- */
      // Live tiles in three batched passes (left faces, right faces, tops). Only faces with no live tile in front
      // of them are drawn, and every top goes over every face, which gets the overlaps right.
      // mode 1/2: only tiles behind / in front of depth sB (the falling ball sits between the two).
      function slabs(ctx, A, mode, sB) {
        const { hw, hh, D, ox, oy } = V, y0 = A.y - D, y1 = A.y + A.h + 2 * hh;
        for (let part = 0; part < 3; part++) {
          ctx.beginPath();
          for (let n = fallIdx; n < tiles.length; n++) {
            const t = tiles[n];
            if (t.fall >= 0) continue;
            const sc = t.i + t.j + 1;
            if ((mode === 1 && sc < sB) || (mode === 2 && sc >= sB)) continue;
            if ((part === 0 && map.has((t.i - 1) * KEY + t.j)) || (part === 1 && map.has(t.i * KEY + t.j - 1))) continue;
            const x = ox + (t.i - t.j) * hw, y = oy - (t.i + t.j) * hh;
            if (y < y0 || y > y1) continue;
            slabPart(ctx, x, y, hw, hh, D, part);
          }
          ctx.fillStyle = ctx.strokeStyle = part === 0 ? C.left : part === 1 ? C.right : C.top;
          ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); // the stroke hides hairline seams between tiles
        }
      }
      function fallen(ctx, A) {
        const { hw, hh, D, ox, oy } = V;
        for (let n = Math.min(tiles.length, fallIdx + 80) - 1; n >= 0; n--) {
          const t = tiles[n];
          if (t.fall < 0) continue;
          const x = ox + (t.i - t.j) * hw, y = oy - (t.i + t.j) * hh + t.z * hh;
          if (y - 2 * hh > A.y + A.h || y + D < A.y) continue;
          ctx.globalAlpha = clamp(1 - t.z / 9, 0, 1);
          ctx.lineWidth = 1;
          for (let part = 0; part < 3; part++) {
            ctx.fillStyle = ctx.strokeStyle = part === 0 ? C.left : part === 1 ? C.right : C.top;
            ctx.beginPath(); slabPart(ctx, x, y, hw, hh, D, part); ctx.fill(); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      function drawGems(ctx, A) {
        const s = V.hw * 0.36;
        for (const t of gems) {
          if (t.fall >= 0 && t.gem === 1) continue;
          const x = sx(t.i + 0.5, t.j + 0.5), y = sy(t.i + 0.5, t.j + 0.5);
          if (y < A.y - 40 || y > A.y + A.h + 40) continue;
          if (t.gem === 2) {
            const k = clamp((clock - t.gemAt) / 0.35, 0, 1);
            ctx.globalAlpha = 1 - k; gem(ctx, x, y - V.hw * (0.9 + k * 1.6), s * (1 + k * 0.6)); ctx.globalAlpha = 1;
            continue;
          }
          ctx.fillStyle = 'rgba(39,48,63,0.13)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.9, s * 0.72, 0, 0, Math.PI * 2); ctx.fill();
          gem(ctx, x, y - V.hw * 0.9 + Math.sin(PG.now * 4 + t.i) * V.hw * 0.12, s);
        }
      }
      function drawBall(ctx, lost) {
        const x = sx(b.i, b.j), y = sy(b.i, b.j), r = V.r;
        if (!lost) { ctx.fillStyle = 'rgba(39,48,63,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
        if (lost) ctx.globalAlpha = clamp(1 - b.z / 7, 0, 1); // drops away into the void
        dot(x, y - r * 0.92 + b.z * V.hh, r * (lost ? clamp(1 - b.z * 0.07, 0.3, 1) : 1), PAL[0]);
        ctx.globalAlpha = 1;
      }
      function drawRing(ctx) {
        const k = (clock - ringAt) / 0.4;
        if (k < 0 || k >= 1) return;
        const R = V.r * (1 + k * 1.8);
        ctx.strokeStyle = rgba('#FFFFFF', 1 - k); ctx.lineWidth = 1 + 3 * (1 - k);
        ctx.beginPath(); ctx.ellipse(sx(ringI, ringJ), sy(ringI, ringJ), R, R * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // First-time help on levels 1–2: the first two corners pulse, and "ТАП!" shows while the ball is inside.
      function drawHint(ctx) {
        if (level > 2 || reached > 2 || !started) return;
        const J = juncs[reached];
        if (!J || b.dir === J.dir) return;
        const dist = b.dir === 0 ? J.i - b.i : J.j - b.j;
        if (dist > 3) return;
        const pulse = 0.5 + 0.5 * Math.sin(PG.now * 10);
        ctx.strokeStyle = rgba('#FFFFFF', 0.5 + 0.5 * pulse); ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(sx(J.i, J.j), sy(J.i, J.j)); ctx.lineTo(sx(J.i + w, J.j), sy(J.i + w, J.j));
        ctx.lineTo(sx(J.i + w, J.j + w), sy(J.i + w, J.j + w)); ctx.lineTo(sx(J.i, J.j + w), sy(J.i, J.j + w)); ctx.closePath(); ctx.stroke();
        if (dist > 0.15) return;
        const x = sx(J.i + w / 2, J.j + w / 2), y = sy(J.i + w, J.j + w) - 22, s = 1 + 0.08 * pulse;
        ctx.fillStyle = INK; rrect(x - 34 * s, y - 15 * s, 68 * s, 30 * s, 15 * s); ctx.fill();
        txt('ТАП!', x, y + 1, 16 * s, '#FFFFFF', { font: FD });
      }
      inst.draw = (ctx, A) => {
        view(A); ensure(A); paint(ctx, A);
        ctx.fillStyle = C.grad; ctx.fillRect(A.x, A.y, A.w, A.h);
        const lost = !!(inst.over && !inst.over.won), sB = b.i + b.j;
        if (lost) slabs(ctx, A, 1, sB); else slabs(ctx, A, 0, 0);
        // the turn count, big and faint, washed over the path like a watermark
        const pk = clamp(1 - (clock - numPop) / 0.3, 0, 1);
        txt(String(inst.progress), A.x + A.w / 2, A.y + A.h * 0.2, Math.min(A.w * 0.34, A.h * 0.22) * (1 + 0.12 * pk), C.num, { font: FD });
        if (lost) { drawGems(ctx, A); drawBall(ctx, true); slabs(ctx, A, 2, sB); }
        else { drawHint(ctx); drawGems(ctx, A); drawRing(ctx); drawBall(ctx, false); }
        fallen(ctx, A);
      };
      view(PG.arena); ensure(PG.arena);
      return inst;
    }
  });
})();

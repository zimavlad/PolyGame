// Timberman — after the classic. Chop the trunk from the left or the right; never let a branch hang at your head.
(function () {
  const PG = window.PG;
  const { PAL, INK, BAD, FD, FB, clamp, rand, randi, easeOutCubic, easeInOut, circle, rrect, txt, rgba } = PG;
  const tone = typeof PG.tone === 'function' ? PG.tone : () => {};
  const WOOD = { body: '#C9884F', light: '#DCA068', dark: '#A86B3B', mark: '#92582E', face: '#F0C083' };
  const LEAF = [PAL[2], '#5BD0B6', '#179A83'];
  const MAN = { plaid: '#C94441', pants: '#4B5B8C', skin: '#F6C7A1', beard: '#8C5230', steel: '#C3CCD8', edge: '#F4F6FA', handle: '#8C5230' };
  const BG = ['#E3F3EC', '#E8E5F6', '#F5EDDA', '#DEEAF5', '#F4E4E2', '#EAF1DC'];
  const REST = -2.2, STRIKE = 0.2; // axe angle (rad) in the lumberjack's own frame, where he faces +x
  const goalOf = lv => Math.min(15 + lv * 5, 60);

  function chopSound(i) {
    const p = 1 + (i % 3) * 0.05;
    tone(175 * p, .09, 'triangle', .17, 0, .45); // the thock
    tone(95, .13, 'sine', .15, 0, .65);          // body
    tone(2100 * p, .02, 'square', .018);         // woody click
  }
  function bonk() { tone(250, .16, 'square', .045, 0, .5); tone(120, .26, 'triangle', .15, .02, .55); }

  // One trunk piece with its top-left at (x, y). v picks the bark marks so the trunk reads as it moves.
  function drawLog(ctx, x, y, w, h, v) {
    ctx.fillStyle = WOOD.body; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = WOOD.light; ctx.fillRect(x + w * 0.1, y, w * 0.15, h);
    ctx.fillStyle = WOOD.dark; ctx.fillRect(x + w * 0.84, y, w * 0.16, h);
    ctx.fillStyle = WOOD.mark;
    if (v === 0) { rrect(x + w * 0.44, y + h * 0.2, w * 0.08, h * 0.42, w * 0.04); ctx.fill(); }
    else if (v === 1) { ctx.beginPath(); ctx.ellipse(x + w * 0.6, y + h * 0.52, w * 0.1, h * 0.13, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (v === 2) { rrect(x + w * 0.34, y + h * 0.5, w * 0.07, h * 0.36, w * 0.035); ctx.fill(); rrect(x + w * 0.62, y + h * 0.14, w * 0.07, h * 0.3, w * 0.035); ctx.fill(); }
    ctx.fillStyle = 'rgba(90,45,15,0.2)'; ctx.fillRect(x, y + h - Math.max(1.5, h * 0.04), w, Math.max(1.5, h * 0.04));
  }
  // A branch growing toward +x from x0 at y = 0 (mirror with scale(-1, 1)); u is the piece height.
  function drawBranch(ctx, x0, len, u) {
    const th = u * 0.2, r = u * 0.3, lx = x0 + len;
    ctx.save(); ctx.rotate(-0.1);
    ctx.fillStyle = WOOD.dark; rrect(x0 - th, -th / 2, len + th, th, th / 2); ctx.fill();
    ctx.fillStyle = LEAF[2]; circle(lx - r * 0.9, -r * 0.1, r * 0.72); ctx.fill();
    ctx.fillStyle = LEAF[0]; circle(lx, -r * 0.3, r); ctx.fill(); circle(lx - len * 0.5, -th * 0.9, r * 0.5); ctx.fill();
    ctx.fillStyle = LEAF[1]; circle(lx - r * 0.3, -r * 0.62, r * 0.42); ctx.fill();
    ctx.restore();
  }
  function drawStump(ctx, cx, top, bottom, tw) {
    const w = tw * 1.16, h = bottom - top;
    ctx.fillStyle = WOOD.dark;
    ctx.beginPath(); // roots flare out at the ground
    ctx.moveTo(cx - w / 2, top); ctx.lineTo(cx + w / 2, top);
    ctx.lineTo(cx + w / 2 + h * 0.7, bottom); ctx.lineTo(cx - w / 2 - h * 0.7, bottom); ctx.closePath(); ctx.fill();
    ctx.fillStyle = WOOD.mark; ctx.fillRect(cx + w * 0.3, top, w * 0.2, h);
  }
  // The lumberjack, feet at (0, 0), facing +x. swing: 0 at rest .. 1 axe in the trunk.
  function drawMan(ctx, H, swing, dead) {
    const s = H;
    ctx.fillStyle = MAN.pants;
    rrect(-s * 0.15, -s * 0.36, s * 0.13, s * 0.34, s * 0.05); ctx.fill();
    rrect(s * 0.02, -s * 0.36, s * 0.13, s * 0.34, s * 0.05); ctx.fill();
    ctx.fillStyle = INK;
    rrect(-s * 0.17, -s * 0.07, s * 0.17, s * 0.07, s * 0.03); ctx.fill();
    rrect(s * 0.01, -s * 0.07, s * 0.2, s * 0.07, s * 0.03); ctx.fill();
    ctx.fillStyle = PAL[0]; rrect(-s * 0.2, -s * 0.73, s * 0.4, s * 0.42, s * 0.11); ctx.fill();
    ctx.fillStyle = MAN.plaid;
    ctx.fillRect(-s * 0.19, -s * 0.6, s * 0.38, s * 0.035); ctx.fillRect(-s * 0.19, -s * 0.48, s * 0.38, s * 0.035);
    ctx.fillRect(-s * 0.08, -s * 0.7, s * 0.035, s * 0.36);
    ctx.fillStyle = INK; ctx.fillRect(-s * 0.2, -s * 0.37, s * 0.4, s * 0.045);
    const hx = s * 0.03, hy = -s * 0.85, hr = s * 0.15;
    ctx.fillStyle = MAN.skin; circle(hx, hy, hr); ctx.fill();
    ctx.fillStyle = MAN.beard; ctx.beginPath(); ctx.arc(hx, hy + hr * 0.05, hr * 1.02, -0.15, Math.PI + 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = MAN.skin; circle(hx + hr * 0.62, hy + hr * 0.12, hr * 0.2); ctx.fill(); // nose
    if (dead) {
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.022); ctx.lineCap = 'round';
      const ex = hx + hr * 0.38, ey = hy - hr * 0.25, e = hr * 0.16;
      ctx.beginPath(); ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e); ctx.moveTo(ex + e, ey - e); ctx.lineTo(ex - e, ey + e); ctx.stroke();
    } else { ctx.fillStyle = INK; circle(hx + hr * 0.38, hy - hr * 0.25, hr * 0.15); ctx.fill(); }
    ctx.fillStyle = PAL[1]; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.3, hr * 1.04, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E09A1E'; rrect(hx - hr * 1.1, hy - hr * 0.45, hr * 2.2, hr * 0.36, hr * 0.18); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; circle(hx - hr * 0.2, hy - hr * 1.38, hr * 0.32); ctx.fill();
    // arm and axe swing around the shoulder
    ctx.save(); ctx.translate(s * 0.04, -s * 0.64); ctx.rotate(REST + (STRIKE - REST) * swing);
    const L = s * 0.54;
    ctx.fillStyle = MAN.handle; rrect(0, -s * 0.028, L + s * 0.04, s * 0.056, s * 0.028); ctx.fill();
    ctx.fillStyle = MAN.steel;
    ctx.beginPath(); ctx.moveTo(L - s * 0.09, -s * 0.05); ctx.lineTo(L + s * 0.03, -s * 0.05);
    ctx.lineTo(L + s * 0.08, s * 0.17); ctx.lineTo(L - s * 0.15, s * 0.17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = MAN.edge; ctx.fillRect(L - s * 0.14, s * 0.13, s * 0.21, s * 0.04);
    ctx.fillStyle = PAL[0]; rrect(-s * 0.06, -s * 0.065, s * 0.27, s * 0.13, s * 0.065); ctx.fill();
    ctx.fillStyle = MAN.skin; circle(s * 0.24, 0, s * 0.055); ctx.fill();
    ctx.restore();
  }
  function cloud(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    circle(x, y, r); ctx.fill(); circle(x - r * 0.95, y + r * 0.3, r * 0.65); ctx.fill(); circle(x + r * 0.95, y + r * 0.25, r * 0.72); ctx.fill();
    rrect(x - r * 1.6, y + r * 0.2, r * 3.3, r * 0.75, r * 0.37); ctx.fill();
  }
  function chevron(ctx, x, y, s, dir) {
    ctx.beginPath(); ctx.moveTo(x - dir * s * 0.35, y - s * 0.5); ctx.lineTo(x + dir * s * 0.25, y); ctx.lineTo(x - dir * s * 0.35, y + s * 0.5); ctx.stroke();
  }

  PG.arcade.register({
    id: 'timber',
    title: 'Timberman',
    family: 'Класика',
    accent: PAL[2],
    howto: ['Тапай ліворуч або праворуч від дерева', 'Не стій під гілкою, рубай швидко'],
    goal: lv => ({ count: goalOf(lv), unit: 'ударів' }),
    icon(ctx, x, y, r) {
      const w = r * 0.52, top = y - r * 0.82, bot = y + r * 0.62;
      ctx.fillStyle = WOOD.body; ctx.fillRect(x - w / 2, top, w, bot - top);
      ctx.fillStyle = WOOD.light; ctx.fillRect(x - w * 0.4, top, w * 0.2, bot - top);
      ctx.fillStyle = WOOD.dark; ctx.fillRect(x - w * 0.62, bot - r * 0.05, w * 1.24, r * 0.26);
      rrect(x + w / 2 - r * 0.05, y - r * 0.38, r * 0.5, r * 0.15, r * 0.07); ctx.fill();
      ctx.fillStyle = PAL[2]; circle(x + w / 2 + r * 0.5, y - r * 0.4, r * 0.26); ctx.fill();
      ctx.fillStyle = WOOD.dark; rrect(x - w / 2 - r * 0.5, y + r * 0.12, r * 0.55, r * 0.15, r * 0.07); ctx.fill();
      ctx.fillStyle = PAL[2]; circle(x - w / 2 - r * 0.5, y + r * 0.1, r * 0.22); ctx.fill();
    },
    create(level, api) {
      // Difficulty, all in one place. Level 1: a slow time bar (sustained by ~0.75 chops/s) and long
      // branch-free stretches (two empty pieces at least between branches). Each level drains faster and
      // grows more branches that switch sides more often. gap is never 0, so two branches never sit on
      // neighbouring pieces and there is always a safe side.
      const lv = Math.max(1, level | 0), goal = goalOf(lv);
      const crowd = (api && api.fill) || 0; // a crowded puzzle board drains the bar a little faster
      const D = {
        drain: Math.min(0.075 + (lv - 1) * 0.0125, 0.17) * (1 + crowd * 0.15), // bar lost per second
        ramp: Math.min(0.2 + (lv - 1) * 0.02, 0.35),       // the drain grows by this fraction on the way to the goal
        refill: Math.max(0.1 - (lv - 1) * 0.003, 0.075),  // bar won back by each chop
        start: 0.75,                                        // bar at the start of the round
        warm: lv <= 1 ? 5 : lv <= 3 ? 4 : 3,                // branch-free pieces at the bottom of a fresh tree
        gap: lv <= 1 ? 2 : 1,                               // empty pieces at least after each branch
        branch: Math.min(0.32 + (lv - 1) * 0.045, 0.72),  // chance of a branch once the gap allows one
        branchRamp: 0.1,                                    // extra branch chance by the time the goal is near
        flip: Math.min(0.45 + (lv - 1) * 0.035, 0.75)      // chance the next branch is on the other side (a forced move)
      };
      const g = {
        segs: [], made: 0, since: 99, last: 0, side: -1, bar: D.start, fall: 0,
        started: false, swingAt: -9, swingFrom: 0, hitAt: -9, tapAt: -9, tapSide: 0, logs: [], deadAt: 0, wonAt: 0,
        bgFrom: 0, bgAt: -9, low: false, lowAt: 0
      };
      // g and cfg are exposed read-only for automated checks
      const inst = { progress: 0, over: null, stats: { level: lv, switches: 0, minBar: 1, low: 0 }, cfg: D, g };

      function addSeg() {
        const k = inst.progress / goal, prev = g.segs.length ? g.segs[g.segs.length - 1].b : 0;
        let b = 0;
        if (g.made >= D.warm && g.since >= D.gap && Math.random() < Math.min(D.branch + D.branchRamp * k, 0.85)) {
          b = g.last ? (Math.random() < D.flip ? -g.last : g.last) : (Math.random() < 0.5 ? -1 : 1);
          if (prev && prev !== b) b = 0; // opposite branches on neighbouring pieces would leave no safe side
        }
        g.made++;
        if (b) { g.since = 0; g.last = b; } else g.since++;
        g.segs.push({ b, v: randi(4) });
      }
      while (g.segs.length < 16) addSeg();

      const c = { u: 0, tw: 0, cx: 0, ground: 0, base: 0, off: 0, H: 0, bl: 0 };
      // Everything scales with u, the height of one trunk piece, which follows the arena.
      function geo(A) {
        c.u = Math.max(10, Math.min(A.h * 0.105, A.w * 0.19));
        c.tw = c.u * 1.3; c.cx = A.x + A.w / 2;
        c.ground = A.y + A.h * 0.87; c.base = c.ground - c.u * 0.42; // base: bottom of the lowest piece
        c.off = c.tw / 2 + c.u * 0.56; c.H = c.u * 1.3; c.bl = c.u * 1.75;
        while (g.segs.length < (c.base - A.y) / c.u + 2) addSeg();
        return c;
      }
      function die(cause) {
        if (inst.over) return;
        inst.over = { won: false, cause };
        g.deadAt = PG.now;
        const A = PG.arena, cc = geo(A), mx = cc.cx + g.side * cc.off, hy = cc.ground - cc.H * 0.85;
        if (cause === 'branch') {
          bonk();
          PG.burst(mx, hy, '#FFFFFF', 10, 200); PG.burst(mx, hy, LEAF[0], 8, 170);
          PG.floatText(mx, hy - cc.u * 0.7, 'Ой!', PAL[0], 26);
        } else PG.floatText(cc.cx, A.y + A.h * 0.13, 'Час вийшов!', BAD, 24);
        PG.sfx.die(); PG.shake(7);
      }
      function chop(cc, side) {
        const s = g.segs.shift();
        addSeg();
        // the piece flies off away from the axe, in arena units (u) above the base
        g.logs.push({ x: 0, y: 0.5, vx: -side * rand(7, 8.5), vy: rand(2.6, 3.6), rot: 0, vr: -side * rand(7, 10), b: s.b, v: s.v });
        if (g.logs.length > 8) g.logs.shift();
        g.fall = 1; g.hitAt = PG.now; g.swingFrom = swingNow(); g.swingAt = PG.now;
        const hx = cc.cx + side * cc.tw * 0.5, hy = cc.base - cc.u * 0.5;
        chopSound(inst.progress); PG.buzz(PG.HAP.tick);
        PG.burst(hx, hy, WOOD.face, 7, 170); PG.burst(hx, hy, '#FFFFFF', 3, 120);
        if (g.segs[0].b === side) { die('branch'); return; } // the next piece brought its branch down on him
        inst.progress++;
        g.bar = Math.min(1, g.bar + D.refill);
        if (inst.progress % 10 === 0) {
          g.bgFrom = Math.floor((inst.progress - 1) / 10) % BG.length; g.bgAt = PG.now;
          if (inst.progress < goal) { PG.reward({ score: 20, x: cc.cx, y: hy - cc.u * 2.6 }); PG.sfx.chain(Math.min(2 + inst.progress / 10, 9)); PG.buzz(PG.HAP.double); }
        } else PG.reward({ score: 5 });
      }
      // Axe pose 0 (raised) .. 1 (in the trunk): a fast strike, a short hold, then back up.
      // A new chop starts from wherever the axe is, so fast tapping never snaps it.
      function swingNow() {
        const k = (PG.now - g.swingAt) / 0.2;
        if (k < 0 || k >= 1) return 0;
        if (k < 0.25) return g.swingFrom + (1 - g.swingFrom) * easeOutCubic(k / 0.25);
        return k < 0.5 ? 1 : 1 - easeInOut((k - 0.5) / 0.5);
      }
      function animate(dt, A) {
        g.fall = Math.max(0, g.fall - dt / 0.08);
        const lim = A.w / (2 * c.u) + 2;
        for (let i = g.logs.length - 1; i >= 0; i--) {
          const l = g.logs[i];
          l.vy -= 24 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.rot += l.vr * dt;
          if (l.y < -6 || Math.abs(l.x) > lim) g.logs.splice(i, 1);
        }
      }

      inst.start = () => { g.started = true; };
      inst.tap = x => {
        if (inst.over || g.wonAt) return;
        const cc = geo(PG.arena), side = x < cc.cx ? -1 : 1; // Space sends the centre: that chops from the right
        g.tapAt = PG.now; g.tapSide = side; g.started = true;
        if (side !== g.side) { g.side = side; inst.stats.switches++; }
        if (g.segs[0].b === side) { die('branch'); return; } // walked into a branch at head height
        chop(cc, side);
      };
      inst.win = () => {
        g.wonAt = PG.now;
        const A = PG.arena, cc = geo(A);
        PG.burst(cc.cx, cc.base - cc.u * 3, LEAF[0], 16, 220); PG.burst(cc.cx, cc.base - cc.u * 3, LEAF[1], 10, 180);
        PG.floatText(cc.cx, A.y + A.h * 0.16, 'Готово!', PAL[2], 26);
      };
      inst.idle = (dt, A) => { geo(A); animate(dt, A); };
      inst.update = (dt, A) => {
        geo(A); animate(dt, A);
        if (inst.over || g.wonAt || inst.progress >= goal) return;
        g.bar -= D.drain * (1 + D.ramp * inst.progress / goal) * dt;
        inst.stats.minBar = Math.min(inst.stats.minBar, Math.max(0, Math.round(g.bar * 100) / 100));
        if (g.bar < 0.22) {
          if (!g.low) { g.low = true; inst.stats.low++; PG.buzz(PG.HAP.light); g.lowAt = PG.now - 1; }
          if (PG.now - g.lowAt > 0.4) { g.lowAt = PG.now; PG.sfx.tick(); }
        } else g.low = false;
        if (g.bar <= 0) { g.bar = 0; die('time'); }
      };
      inst.draw = (ctx, A) => {
        const cc = geo(A), u = cc.u, hw = cc.tw / 2, now = PG.now;
        // sky: a soft pastel that changes every 10 chops
        const bi = Math.floor(inst.progress / 10) % BG.length, bk = clamp((now - g.bgAt) / 0.5, 0, 1);
        ctx.fillStyle = bk < 1 ? BG[g.bgFrom] : BG[bi]; ctx.fillRect(A.x, A.y, A.w, A.h);
        if (bk < 1) { ctx.globalAlpha = bk; ctx.fillStyle = BG[bi]; ctx.fillRect(A.x, A.y, A.w, A.h); ctx.globalAlpha = 1; }
        const fk = (now - g.tapAt) / 0.18; // the tapped half lights up for a moment
        if (fk >= 0 && fk < 1) { ctx.fillStyle = rgba('#FFFFFF', 0.3 * (1 - fk)); ctx.fillRect(g.tapSide < 0 ? A.x : cc.cx, A.y, A.w / 2, A.h); }
        for (let i = 0; i < 3; i++) {
          const x = A.x + (((i * 0.41 + now * (0.012 + i * 0.005)) % 1.4) - 0.2) * A.w;
          cloud(ctx, x, A.y + A.h * (0.2 + i * 0.16), u * (0.42 + i * 0.1));
        }
        ctx.fillStyle = rgba(PAL[2], 0.12); // two soft hills, upper halves only so the ground stays even
        ctx.beginPath(); ctx.arc(A.x + A.w * 0.1, cc.ground, A.w * 0.3, Math.PI, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(A.x + A.w * 0.96, cc.ground, A.w * 0.36, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(PAL[2], 0.3); ctx.fillRect(A.x, cc.ground, A.w, A.y + A.h - cc.ground);
        ctx.fillStyle = rgba(PAL[2], 0.45); ctx.fillRect(A.x, cc.ground, A.w, Math.max(2, u * 0.05));
        // trunk: piece i rests with its bottom at base - i*u; after a chop everything drops one piece (fall 1 -> 0)
        const hk = clamp((now - g.hitAt) / 0.16, 0, 1), wob = (1 - hk) * Math.sin(hk * 12) * u * 0.06 * -g.side;
        const tx = cc.cx - hw + wob;
        for (let i = 0; i < g.segs.length; i++) {
          const yb = cc.base - (i + g.fall) * u;
          if (yb < A.y) break;
          drawLog(ctx, tx, yb - u, cc.tw, u, g.segs[i].v);
        }
        // the big faint chop count, one translucent layer over sky and trunk alike
        txt(String(inst.progress), cc.cx, A.y + A.h * 0.31, Math.min(A.w * 0.34, A.h * 0.22), rgba(INK, 0.12), { font: FD });
        for (let i = 0; i < g.segs.length; i++) {
          const s = g.segs[i], yc = cc.base - (i + g.fall + 0.5) * u;
          if (yc < A.y - u) break;
          if (!s.b) continue;
          ctx.save(); ctx.translate(cc.cx + wob, yc); ctx.scale(s.b, 1); drawBranch(ctx, hw * 0.85, cc.bl + hw * 0.15, u); ctx.restore();
        }
        drawStump(ctx, cc.cx, cc.base, cc.ground + 1, cc.tw);
        // the lumberjack faces the trunk; he tips over backwards when he loses and hops when he wins
        let rot = 0, dy = 0;
        if (g.deadAt) { const dk = clamp((now - g.deadAt) / 0.35, 0, 1); rot = -Math.PI / 2 * dk * dk; dy = -cc.H * 0.2 * dk * dk; } // lands lying on the grass
        else if (g.wonAt && now - g.wonAt < 1.05) dy = -Math.abs(Math.sin((now - g.wonAt) * 9)) * u * 0.3; // three happy hops
        ctx.save(); ctx.translate(cc.cx + g.side * cc.off, cc.ground + dy); ctx.scale(-g.side, 1);
        if (rot) ctx.rotate(rot);
        else if (!g.wonAt) ctx.scale(1, 1 + Math.sin(now * 3) * 0.012);
        drawMan(ctx, cc.H, g.deadAt ? 0 : swingNow(), !!g.deadAt);
        ctx.restore();
        for (const l of g.logs) {
          ctx.save(); ctx.translate(cc.cx + l.x * u, cc.base - l.y * u); ctx.rotate(l.rot);
          drawLog(ctx, -hw, -u / 2, cc.tw, u, l.v);
          if (l.b) { ctx.scale(l.b, 1); drawBranch(ctx, hw * 0.85, cc.bl + hw * 0.15, u); }
          ctx.restore();
        }
        // time bar (hidden under the intro card until the first tap)
        if (g.started) {
          const bw = Math.min(A.w * 0.56, 240), bh = clamp(A.h * 0.024, 9, 14), bx = cc.cx - bw / 2, by = A.y + Math.max(14, A.h * 0.045);
          const v = clamp(g.bar, 0, 1), pk = clamp(1 - (now - g.hitAt) / 0.2, 0, 1);
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; rrect(bx - 4, by - 4 - pk * 1.5, bw + 8, bh + 8 + pk * 3, (bh + 8) / 2); ctx.fill();
          ctx.fillStyle = rgba(INK, 0.08); rrect(bx, by, bw, bh, bh / 2); ctx.fill();
          const blink = v < 0.22 && !inst.over && Math.sin(now * 18) > 0;
          ctx.fillStyle = blink ? rgba(BAD, 0.5) : v < 0.22 ? BAD : v < 0.45 ? PAL[1] : PAL[2];
          if (v > 0) { rrect(bx, by, Math.max(2, bw * v), bh, bh / 2); ctx.fill(); }
        }
        // first-round hint: which half chops from which side
        if (lv <= 2 && inst.progress < 3 && !inst.over) {
          const hy = (cc.ground + A.y + A.h - 20) / 2, a = 0.5 + 0.25 * Math.sin(now * 5), sz = clamp(u * 0.24, 11, 15);
          ctx.strokeStyle = rgba(INK, a); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let sd = -1; sd <= 1; sd += 2) {
            const x = cc.cx + sd * (A.w / 2 - 22);
            chevron(ctx, x, hy, sz, sd);
            txt(sd < 0 ? 'тап зліва' : 'тап справа', x - sd * sz * 0.9, hy + 1, sz, rgba(INK, a), { font: FB, weight: 900, align: sd < 0 ? 'left' : 'right' });
          }
        }
      };
      return inst;
    }
  });
})();

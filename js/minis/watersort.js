// Water Sort — the colour-sorting puzzle as a fake playable ad: pour between tubes until each holds one colour.
(function () {
  const PG = window.PG;
  const { PAL, INK, FD, FB, clamp, easeInOut, easeOutBack, rgba, circle, rrect, txt, shuffle } = PG;
  const CAP = 4;
  const GLASS = '#B9C4D6', GLASS_FILL = 'rgba(255,255,255,0.72)';

  function topRun(t) {
    let n = 0;
    for (let i = t.length - 1; i >= 0 && t[i] === t[t.length - 1]; i--) n++;
    return n;
  }
  // Units a pour from a to b moves: the top run of one colour, while b matches (or is empty) and has room.
  function pourAmount(a, b) {
    if (a === b || !a.length || b.length >= CAP) return 0;
    if (b.length && b[b.length - 1] !== a[a.length - 1]) return 0;
    return Math.min(topRun(a), CAP - b.length);
  }
  const full = t => t.length === CAP && topRun(t) === CAP;
  const solved = ts => ts.every(t => !t.length || full(t));
  const anyMove = ts => ts.some((a, i) => ts.some((b, j) => i !== j && pourAmount(a, b) > 0));
  // Fewest pours that solve the tubes (breadth-first, tube order ignored); -1 when it takes more than max.
  function minMoves(start, max) {
    const key = ts => ts.map(t => t.join('')).sort().join('|');
    const seen = new Set([key(start)]);
    let layer = [start];
    for (let d = 0; d <= max && layer.length; d++) {
      const next = [];
      for (const ts of layer) {
        if (solved(ts)) return d;
        for (let i = 0; i < ts.length; i++) for (let j = 0; j < ts.length; j++) {
          const k = i === j ? 0 : pourAmount(ts[i], ts[j]);
          if (!k) continue;
          const n = ts.map(t => t.slice());
          for (let m = 0; m < k; m++) n[j].push(n[i].pop());
          const id = key(n);
          if (!seen.has(id)) { seen.add(id); next.push(n); }
        }
      }
      if (seen.size > 60000) return -1;
      layer = next;
    }
    return -1;
  }
  // Random full tubes plus empty ones, kept only when a breadth-first search solves them in lo..hi pours.
  function makePuzzle(colors, empty, lo, hi) {
    for (let tries = 0; tries < 300; tries++) {
      const units = [];
      for (let c = 0; c < colors; c++) for (let k = 0; k < CAP; k++) units.push(c);
      shuffle(units);
      const tubes = [];
      for (let c = 0; c < colors; c++) tubes.push(units.slice(c * CAP, c * CAP + CAP));
      if (tubes.some(t => topRun(t) >= 3)) continue; // nothing may start (nearly) sorted
      for (let e = 0; e < empty; e++) tubes.push([]);
      const m = minMoves(tubes, hi);
      if (m >= lo) return { tubes, best: m };
    }
    const tubes = [[1, 1, 0, 0], [0, 2, 2, 1], [0, 1, 2, 2]]; // known-good fallback: 6 pours with one or two spare tubes
    for (let e = 0; e < empty; e++) tubes.push([]);
    return { tubes, best: minMoves(tubes, 12) };
  }
  // A band of liquid between two world-level lines through the tube axis at local heights yHi < yLo; t = tan(tilt).
  // In a straight tube a level line through the axis cuts off the same volume as a square one, so tilted tubes keep their amounts.
  function band(ctx, col, w, yHi, yLo, t) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(-w, yHi + w * t); ctx.lineTo(w, yHi - w * t); ctx.lineTo(w, yLo - w * t); ctx.lineTo(-w, yLo + w * t);
    ctx.closePath(); ctx.fill();
  }
  // Area of a straight w×H tube (mouth at the top) that lies below the level line through its pouring lip when tilted by th.
  const RECT = [-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], CLIP = new Float64Array(16);
  function wetArea(w, H, th) {
    const sn = Math.sin(th), cs = Math.cos(th), c = w / 2 * sn;
    let n = 0;
    for (let i = 0; i < 4; i++) { // clip the rectangle by x·sin + y·cos >= c (the lip at +x, the mouth at y = 0)
      const j = (i + 1) % 4, ax = RECT[i * 2] * w, ay = RECT[i * 2 + 1] * H, bx = RECT[j * 2] * w, by = RECT[j * 2 + 1] * H;
      const fa = ax * sn + ay * cs - c, fb = bx * sn + by * cs - c;
      if (fa >= 0) { CLIP[n++] = ax; CLIP[n++] = ay; }
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); CLIP[n++] = ax + (bx - ax) * k; CLIP[n++] = ay + (by - ay) * k; }
    }
    let a = 0;
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += CLIP[i] * CLIP[j + 1] - CLIP[j] * CLIP[i + 1]; }
    return Math.abs(a) / 2;
  }
  // The tilt at which `vol` of liquid just reaches the lip: tilting past it pours, so a pour follows this as the tube empties.
  function tiltFor(w, H, vol) {
    let lo = 0.02, hi = Math.PI / 2;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (wetArea(w, H, m) > vol) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  // Rising pop-up text (PG.floatText is drawn under the ad frame, so mini-games draw their own).
  function popText(ctx, x, y, text, color, size, k) {
    const s = easeOutBack(clamp(k * 4, 0, 1)), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y - k * 34); ctx.scale(s, s);
    ctx.font = `800 ${size}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  // A tube outline hanging from its mouth at (x, y): straight sides, round bottom.
  function tubePath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h - r);
    ctx.arc(x + r, y + h - r, r, Math.PI, 0, true);
    ctx.lineTo(x + w, y); ctx.closePath();
  }

  PG.ads.register({
    id: 'watersort',
    title: 'Water Sort',
    hook: 'Розсортуй кольори — це легше, ніж здається!',
    create() {
      // Difficulty (an ad has no levels): colours, spare empty tubes, the shortest-solution window and the time limit.
      const COLORS = 3, EMPTY = 2, MIN_POURS = 4, MAX_POURS = 6, TIME = 40;
      // Pour animation, seconds: fly over the target, pour (per unit), fly back.
      const T_MOVE = 0.17, T_UNIT = 0.09, T_BASE = 0.14, T_BACK = 0.17;

      const cols = shuffle(PAL.slice()).slice(0, COLORS);
      const puzzle = makePuzzle(COLORS, EMPTY, MIN_POURS, MAX_POURS);
      const tubes = puzzle.tubes, n = tubes.length;
      const lift = new Array(n).fill(0), wig = new Array(n).fill(-9), doneAt = new Array(n).fill(-9);
      let sel = -1, anim = null, t = 0, state = 'play', endAt = 0, stateAt = 0, pours = 0;
      const pops = []; // { i: tube index or -1 for the whole row, text, color, size, t0 }
      const inst = { over: null, hint: 'Тапни пробірку, а потім ту, куди переливати', tubes, best: puzzle.best };
      const G = { tw: 30, uh: 30, H: 150, top: 0, slot: 50, x0: 0 };

      // Tube size and row placement from the play rect (also read by automated checks).
      inst.geo = A => {
        const top = 34, bot = 26, availH = Math.max(40, A.h - top - bot), HEAD = 1.6; // HEAD: unit heights kept free above for lift and pour
        G.slot = (A.w - 20) / n;
        G.tw = Math.min(G.slot * 0.64, 56);
        G.uh = Math.min(G.tw * 1.2, availH / (CAP + 0.6 + HEAD));
        G.tw = Math.min(G.tw, G.uh * 1.05);
        G.H = G.uh * (CAP + 0.6);
        G.top = A.y + top + G.uh * HEAD + Math.max(0, availH - G.H - G.uh * HEAD) * 0.5;
        G.x0 = A.x + 10;
        return G;
      };
      const cxOf = i => G.x0 + (i + 0.5) * G.slot;
      const doneCount = () => tubes.reduce((s, tb) => s + (full(tb) ? 1 : 0), 0);

      function pourTime(a) { return T_MOVE + T_BASE + T_UNIT * a.k + T_BACK; }
      function finishPour() {
        const a = anim; anim = null;
        if (!a) return;
        if (full(tubes[a.to]) && doneAt[a.to] < 0) {
          doneAt[a.to] = PG.now;
          PG.sfx.candy(); PG.buzz(PG.HAP.double);
          PG.burst(cxOf(a.to), G.top, cols[a.c], 12, 170);
          pops.push({ i: a.to, text: 'Готово!', color: cols[a.c], size: 17, t0: PG.now });
        }
        if (solved(tubes)) {
          state = 'won'; stateAt = PG.now; endAt = PG.now + 0.75;
          pops.push({ i: -1, text: 'Ідеально!', color: PAL[2], size: 30, t0: PG.now + 0.15 });
        } else if (!anyMove(tubes)) {
          state = 'stuck'; stateAt = PG.now; endAt = PG.now + 0.8; PG.sfx.bad();
        }
      }
      function pour(from, to, k) {
        const tf = tubes[from], tt = tubes[to], c = tf[tf.length - 1];
        for (let m = 0; m < k; m++) tt.push(tf.pop());
        // the source flies to the roomier side of the target and tilts toward it
        const A = inst.lastA, tx = cxOf(to);
        const dir = A && tx - A.x < A.x + A.w - tx ? -1 : 1;
        anim = { from, to, c, k, t: 0, dir, lift0: lift[from], notes: 0 };
        lift[from] = 0; doneAt[from] = -9; sel = -1; pours++; // a finished tube poured out can be finished (and corked) again
        PG.sfx.pick();
      }
      function badPour(i) {
        wig[i] = PG.now; sel = -1;
        PG.sfx.bad(); PG.buzz(PG.HAP.tick);
      }

      inst.down = (x, y, A) => {
        if (state !== 'play' || !A) return;
        inst.lastA = A;
        if (anim) finishPour();
        if (state !== 'play') return;
        inst.geo(A);
        const i = Math.floor((x - G.x0) / G.slot);
        const hit = i >= 0 && i < n && y > G.top - G.uh * 2.2 && y < G.top + G.H + G.uh * 0.8;
        if (!hit) { if (sel >= 0) { sel = -1; PG.sfx.back(); } return; }
        if (sel < 0) {
          if (!tubes[i].length) { badPour(i); return; }
          sel = i; PG.sfx.pick(); PG.buzz(PG.HAP.tick);
          return;
        }
        if (sel === i) { sel = -1; PG.sfx.back(); return; }
        const k = pourAmount(tubes[sel], tubes[i]);
        if (!k) { badPour(i); return; }
        pour(sel, i, k);
      };
      inst.update = (dt, A) => {
        if (A) { inst.lastA = A; inst.geo(A); }
        if (state === 'play') {
          t += dt;
          if (t >= TIME) { if (anim) finishPour(); if (state === 'play') { state = 'time'; stateAt = PG.now; inst.over = { won: false }; } }
        }
        for (let i = 0; i < n; i++) lift[i] += ((sel === i ? 1 : 0) - lift[i]) * Math.min(1, dt * 14);
        if (anim) {
          const a = anim;
          a.t += dt;
          // one note per unit as it lands, rising with the target's level
          const p = clamp((a.t - T_MOVE) / (T_BASE + T_UNIT * a.k), 0, 1);
          while (a.notes < a.k && p >= (a.notes + 0.6) / a.k) {
            PG.sfx.note(tubes[a.to].length - a.k + a.notes + 2); a.notes++;
            if (a.notes === 1) PG.buzz(PG.HAP.light);
          }
          if (a.t >= pourTime(a)) finishPour();
        }
        for (let i = pops.length - 1; i >= 0; i--) if (PG.now - pops[i].t0 > 1.1) pops.splice(i, 1);
        if (endAt && !inst.over && PG.now >= endAt) inst.over = { won: state === 'won' };
      };

      // Liquid in a tube hanging from its mouth at local (0, 0): cnt units of list plus `ea` units of colour ec on top,
      // with level surfaces when the tube is tilted by ang.
      function liquid(ctx, w, list, cnt, ec, ea, ang) {
        const { uh, H } = G, t = Math.tan(ang), deep = H + w * Math.abs(t) + uh * 2;
        const lo = u => u ? H - u * uh + 0.6 : deep; // lower edge of a band starting at unit u (overlaps a hair to hide seams)
        let i = 0;
        while (i < cnt) {
          const c = list[i];
          let j = i;
          while (j < cnt && list[j] === c) j++;
          const hiU = j + (j === cnt && ea > 0 && ec === c ? ea : 0);
          band(ctx, cols[c], w, H - hiU * uh, lo(i), t);
          i = j;
        }
        let topU = cnt;
        if (ea > 0) {
          if (!(cnt && list[cnt - 1] === ec)) band(ctx, cols[ec], w, H - (cnt + ea) * uh, lo(cnt), t);
          topU += ea;
        }
        if (topU > 0.05) band(ctx, 'rgba(255,255,255,0.28)', w, H - topU * uh, H - topU * uh + Math.min(uh * 0.14, topU * uh), t);
      }
      function drawTube(ctx, i, mx, my, ang, list, cnt, ec, ea) {
        const { tw: w, uh, H } = G, x = -w / 2;
        ctx.save(); ctx.translate(mx, my); if (ang) ctx.rotate(ang);
        tubePath(ctx, x, 0, w, H); ctx.fillStyle = GLASS_FILL; ctx.fill();
        ctx.save(); tubePath(ctx, x, 0, w, H); ctx.clip();
        liquid(ctx, w, list, cnt, ec, ea, ang);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; rrect(x + w * 0.16, uh * 0.55, w * 0.13, H - uh * 1.3, w * 0.065); ctx.fill();
        const on = sel === i;
        ctx.strokeStyle = on ? INK : GLASS; ctx.lineWidth = Math.max(2, w * 0.07);
        tubePath(ctx, x, 0, w, H); ctx.stroke();
        ctx.fillStyle = on ? INK : GLASS; rrect(x - w * 0.12, -w * 0.07, w * 1.24, w * 0.15, w * 0.075); ctx.fill();
        if (doneAt[i] > 0 && full(tubes[i]) && !(anim && anim.from === i)) { // a cork on finished tubes
          const k = easeOutBack(clamp((PG.now - doneAt[i]) / 0.35, 0, 1));
          ctx.fillStyle = '#C79A6B'; rrect(-w * 0.32, -w * 0.42 * k - w * 0.05, w * 0.64, w * 0.42 * k + w * 0.12, w * 0.12); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-w * 0.32, -w * 0.42 * k - w * 0.02, w * 0.64, w * 0.07);
        }
        ctx.restore();
      }

      inst.draw = (ctx, A) => {
        inst.geo(A);
        const { tw, uh, H } = G, cx = A.x + A.w / 2;
        const gr = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
        gr.addColorStop(0, '#EDEBFA'); gr.addColorStop(1, '#E2F3EE');
        ctx.fillStyle = gr; ctx.fillRect(A.x, A.y, A.w, A.h);
        // timer
        const k = clamp(1 - t / TIME, 0, 1), bw = A.w - 74;
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; rrect(A.x + 18, A.y + 14, bw, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.25 ? PG.BAD : PAL[3]; rrect(A.x + 18, A.y + 14, Math.max(8, bw * k), 8, 4); ctx.fill();
        txt(String(Math.ceil(TIME - Math.min(t, TIME))), A.x + A.w - 32, A.y + 18, 15, k < 0.25 ? PG.BAD : INK, { font: FD });
        // the big faint progress number: sorted colours
        const done = doneCount(), room = G.top - uh * 0.9 - (A.y + 34), caption = state === 'time' || state === 'stuck';
        if (room > 36 && !caption) txt(`${done}/${COLORS}`, cx, A.y + 34 + room / 2, Math.min(A.w * 0.26, 96, room * 0.8), 'rgba(39,48,63,0.08)', { font: FD });
        else if (room <= 36) txt(`${done}/${COLORS}`, cx, G.top + H / 2, Math.min(A.w * 0.26, H * 0.5), 'rgba(39,48,63,0.06)', { font: FD });
        // a soft shelf under the tubes
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; rrect(G.x0 + G.slot * 0.15, G.top + H + uh * 0.18, G.slot * (n - 0.3), Math.max(6, uh * 0.22), uh * 0.11); ctx.fill();
        const won = state === 'won';
        for (let i = 0; i < n; i++) {
          if (anim && anim.from === i) continue;
          let dy = -lift[i] * uh * 0.75, dx = 0;
          if (PG.now - wig[i] < 0.35) dx = Math.sin((PG.now - wig[i]) * 50) * tw * 0.12 * (1 - (PG.now - wig[i]) / 0.35);
          if (won) { const q = PG.now - stateAt - i * 0.07; if (q > 0 && q < 0.4) dy -= Math.sin(q / 0.4 * Math.PI) * uh * 0.6; }
          const tb = tubes[i];
          if (anim && anim.to === i) {
            const p = clamp((anim.t - T_MOVE) / (T_BASE + T_UNIT * anim.k), 0, 1);
            drawTube(ctx, i, cxOf(i) + dx, G.top + dy, 0, tb, tb.length - anim.k, anim.c, anim.k * p);
          } else drawTube(ctx, i, cxOf(i) + dx, G.top + dy, 0, tb, tb.length, 0, 0);
        }
        if (anim) {
          // fly over the target, tilt until the liquid meets the lip, keep tilting as it empties, fly back
          const a = anim, tx = cxOf(a.to), pT = T_BASE + T_UNIT * a.k, src = tubes[a.from];
          const p = clamp((a.t - T_MOVE) / pT, 0, 1);
          // the tube body swings away from the target: never further than the play rect allows
          const room = (a.dir < 0 ? A.x + A.w - tx : tx - A.x) - 6;
          let lo = 0, hi = Math.PI / 2;
          for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (tw * Math.cos(m) + H * Math.sin(m) <= room) lo = m; else hi = m; }
          const tilt = v => Math.max(0.45, Math.min(lo, tiltFor(tw, H, v * uh * tw)));
          const th0 = tilt(src.length + a.k), th1 = tilt(src.length);
          const lx = tx, ly = G.top - tw * 0.5; // the lip stays over the target's mouth while pouring
          const rx = cxOf(a.from), ry0 = G.top - a.lift0 * uh * 0.75;
          let th, mx, my;
          if (a.t < T_MOVE) { // fly in from the rest spot, tilting up to where the liquid meets the lip
            const q = easeInOut(a.t / T_MOVE);
            th = th0 * q;
            mx = rx + (lx - a.dir * (tw / 2) * Math.cos(th0) - rx) * q; my = ry0 + (ly - (tw / 2) * Math.sin(th0) - ry0) * q;
          } else if (a.t < T_MOVE + pT) { // pour: the tilt follows the emptying tube, pivoting on the lip
            th = tilt(src.length + a.k * (1 - p));
            mx = lx - a.dir * (tw / 2) * Math.cos(th); my = ly - (tw / 2) * Math.sin(th);
          } else { // fly back upright
            const q = easeInOut(clamp((a.t - T_MOVE - pT) / T_BACK, 0, 1));
            th = th1 * (1 - q);
            const px = lx - a.dir * (tw / 2) * Math.cos(th1), py = ly - (tw / 2) * Math.sin(th1);
            mx = px + (rx - px) * q; my = py + (G.top - py) * q;
          }
          if (p > 0 && p < 1) { // the stream from the lip down to the target's surface
            const surf = G.top + H - (tubes[a.to].length - a.k + a.k * p) * uh;
            const sw = tw * 0.2 * Math.min(1, p * 6, (1 - p) * 6);
            ctx.strokeStyle = cols[a.c]; ctx.lineWidth = Math.max(1, sw); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx + Math.sin(PG.now * 30) * 0.8, surf); ctx.stroke();
          }
          drawTube(ctx, a.from, mx, my, a.dir * th, src, src.length, a.c, a.k * (1 - p));
        }
        if (state !== 'play' && state !== 'won') {
          const w = Math.min(A.w - 40, 240), ka = clamp((PG.now - stateAt) / 0.25, 0, 1);
          ctx.globalAlpha = ka;
          ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(cx - w / 2, A.y + 36, w, 36, 18); ctx.fill();
          txt(state === 'time' ? 'Час вийшов' : 'Ходів немає', cx, A.y + 54, 16, INK, { font: FD, max: w - 20 });
          ctx.globalAlpha = 1;
        }
        if (G.top + H + uh * 0.5 < A.y + A.h - 24) txt(`Ходів: ${pours}`, cx, A.y + A.h - 14, 13, rgba(INK, 0.55), { font: FB, weight: 900 });
        for (const p of pops) {
          const k = (PG.now - p.t0) / 1.1;
          if (k < 0 || k >= 1) continue;
          const px = p.i < 0 ? cx : cxOf(p.i), py = p.i < 0 ? G.top - uh * 1.1 : G.top - uh * 0.55;
          popText(ctx, clamp(px, A.x + 40, A.x + A.w - 40), py, p.text, p.color, p.size, k);
        }
      };
      return inst;
    }
  });
})();

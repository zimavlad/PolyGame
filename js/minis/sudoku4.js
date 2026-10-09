// Судоку 4×4 — a pocket sudoku as a fake playable ad: fill the blanks with 1–4 before the timer runs out.
(function () {
  const PG = window.PG;
  const { FD, FB, INK, clamp, circle, rrect, txt } = PG;
  const TIME = 40;

  // A random valid 4×4 grid: a base solution shuffled by moves that keep the rules intact.
  function solution() {
    let g = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
    const map = [0, ...PG.shuffle([1, 2, 3, 4])];
    g = g.map(r => r.map(d => map[d]));
    const swap = (a, i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
    if (Math.random() < 0.5) swap(g, 0, 1);
    if (Math.random() < 0.5) swap(g, 2, 3);
    if (Math.random() < 0.5) { swap(g, 0, 2); swap(g, 1, 3); }
    const T = () => { g = g[0].map((_, c) => g.map(r => r[c])); };
    T();
    if (Math.random() < 0.5) swap(g, 0, 1);
    if (Math.random() < 0.5) swap(g, 2, 3);
    if (Math.random() < 0.5) { swap(g, 0, 2); swap(g, 1, 3); }
    if (Math.random() < 0.5) T();
    return g;
  }

  PG.ads.register({
    id: 'sudoku4',
    title: 'Судоку 4×4',
    hook: 'IQ-тест: розв\'яжи міні-судоку за 40 секунд!',
    create() {
      const sol = solution();
      const blanks = new Set(PG.shuffle([...Array(16).keys()]).slice(0, 6 + PG.randi(3)));
      // v: digit or 0; given: part of the puzzle; at: when the digit was set (for the pop animation)
      const cells = sol.flat().map((d, i) => ({ v: blanks.has(i) ? 0 : d, given: !blanks.has(i), at: -9 }));
      let t = 0, sel = [...blanks].sort((a, b) => a - b)[0], bad = new Set(), wonAt = 0;
      const inst = { over: null, hint: 'Без повторів у рядку, стовпці й квадраті' };

      function layout(A) {
        const pad = 18, top = 34, padH = 64, gapPad = 30;
        const size = Math.min(A.w - pad * 2, A.h - top - padH - gapPad - 24);
        const cell = size / 4, gx = A.x + (A.w - size) / 2;
        const gy = A.y + top + Math.max(0, (A.h - top - padH - gapPad - 24 - size) / 2);
        const bw = Math.min(64, (A.w - pad * 2 - 3 * 12) / 4);
        const py = gy + size + gapPad, px = A.x + (A.w - (bw * 4 + 36)) / 2;
        return { gx, gy, size, cell, pad: [1, 2, 3, 4].map(d => ({ d, x: px + (d - 1) * (bw + 12), y: py, w: bw, h: Math.min(padH, bw) })) };
      }
      function conflicts() {
        const out = new Set();
        for (let i = 0; i < 16; i++) {
          const a = cells[i]; if (!a.v) continue;
          const r = i >> 2, c = i & 3;
          for (let j = i + 1; j < 16; j++) {
            const b = cells[j]; if (b.v !== a.v) continue;
            const r2 = j >> 2, c2 = j & 3;
            if (r === r2 || c === c2 || ((r >> 1) === (r2 >> 1) && (c >> 1) === (c2 >> 1))) { out.add(i); out.add(j); }
          }
        }
        return out;
      }
      function nextEmpty(from) {
        for (let k = 1; k <= 16; k++) { const i = (from + k) % 16; if (!cells[i].given && !cells[i].v) return i; }
        return -1;
      }
      function put(d) {
        if (sel < 0 || cells[sel].given) return;
        const cell = cells[sel];
        cell.v = d; cell.at = PG.now;
        bad = conflicts();
        if (bad.has(sel)) { PG.sfx.bad(); PG.buzz(PG.HAP.double); }
        else { PG.sfx.note(d + 1); PG.buzz(PG.HAP.tick); }
        if (cells.every(c => c.v) && !bad.size) { wonAt = PG.now; sel = -1; inst.over = { won: true }; return; }
        if (!bad.has(sel)) { const n = nextEmpty(sel); if (n >= 0) sel = n; }
      }

      inst.down = (x, y, A) => {
        if (inst.over) return;
        const Lr = layout(A);
        const c = Math.floor((x - Lr.gx) / Lr.cell), r = Math.floor((y - Lr.gy) / Lr.cell);
        if (r >= 0 && r < 4 && c >= 0 && c < 4) {
          const i = r * 4 + c;
          if (cells[i].given) { PG.sfx.tick(); return; }
          sel = i; PG.sfx.pick(); PG.buzz(PG.HAP.tick);
          return;
        }
        for (const b of Lr.pad) if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 6 && y <= b.y + b.h + 6) { put(b.d); return; }
      };
      inst.update = dt => {
        if (inst.over) return;
        t += dt;
        if (t >= TIME) inst.over = { won: false };
      };
      inst.draw = (ctx, A) => {
        const Lr = layout(A), { gx, gy, size, cell } = Lr;
        const k = clamp(1 - t / TIME, 0, 1);
        ctx.fillStyle = '#E3E8F0'; rrect(A.x + 18, A.y + 14, A.w - 36, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.25 ? PG.BAD : PG.PAL[1]; rrect(A.x + 18, A.y + 14, Math.max(8, (A.w - 36) * k), 8, 4); ctx.fill();
        // board
        ctx.fillStyle = 'rgba(0,0,0,0.06)'; rrect(gx - 8, gy - 5, size + 16, size + 16, 18); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; rrect(gx - 8, gy - 8, size + 16, size + 16, 18); ctx.fill();
        for (let i = 0; i < 16; i++) {
          const r = i >> 2, c = i & 3, x = gx + c * cell, y = gy + r * cell, C = cells[i];
          const tint = bad.has(i) ? PG.rgba(PG.BAD, 0.16) : i === sel ? PG.rgba(PG.PAL[1], 0.22) : ((r >> 1) + (c >> 1)) % 2 ? '#F4F6FA' : '#FFFFFF';
          ctx.fillStyle = tint; rrect(x + 2, y + 2, cell - 4, cell - 4, 10); ctx.fill();
          if (i === sel) { ctx.strokeStyle = PG.PAL[1]; ctx.lineWidth = 2.5 + Math.sin(PG.now * 6) * 0.8; rrect(x + 3, y + 3, cell - 6, cell - 6, 10); ctx.stroke(); }
          if (!C.v) continue;
          const pop = 1 + 0.18 * Math.sin(clamp((PG.now - C.at) / 0.2, 0, 1) * Math.PI);
          const won = wonAt ? 1 + 0.12 * Math.sin(clamp((PG.now - wonAt - (r + c) * 0.05) / 0.25, 0, 1) * Math.PI) : 1;
          const R = cell * 0.33 * pop * won, cx = x + cell / 2, cy = y + cell / 2;
          if (C.given) { PG.dot(cx, cy, R, PG.PAL[C.v - 1]); PG.digit(cx, cy, R, C.v); }
          else {
            ctx.fillStyle = PG.rgba(PG.PAL[C.v - 1], 0.16); circle(cx, cy, R); ctx.fill();
            ctx.strokeStyle = bad.has(i) ? PG.BAD : PG.PAL[C.v - 1]; ctx.lineWidth = 3; circle(cx, cy, R - 1.5); ctx.stroke();
            txt(String(C.v), cx, cy + 1, R * 1.15, bad.has(i) ? PG.BAD : PG.PAL[C.v - 1], { font: FD });
          }
        }
        // box lines
        ctx.strokeStyle = PG.INK; ctx.globalAlpha = 0.18; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(gx + size / 2, gy + 4); ctx.lineTo(gx + size / 2, gy + size - 4);
        ctx.moveTo(gx + 4, gy + size / 2); ctx.lineTo(gx + size - 4, gy + size / 2); ctx.stroke(); ctx.globalAlpha = 1;
        // digit pad
        for (const b of Lr.pad) {
          const cx = b.x + b.w / 2, cy = b.y + b.h / 2, used = cells.filter(c => c.v === b.d).length;
          ctx.fillStyle = 'rgba(0,0,0,0.08)'; rrect(b.x, b.y + 3, b.w, b.h, 16); ctx.fill();
          ctx.fillStyle = used >= 4 ? '#EEF1F6' : PG.PAL[b.d - 1]; rrect(b.x, b.y, b.w, b.h, 16); ctx.fill();
          txt(String(b.d), cx, cy + 1, b.h * 0.5, used >= 4 ? PG.SOFT : '#FFFFFF', { font: FD });
        }
        if (inst.over && !inst.over.won) {
          ctx.fillStyle = 'rgba(244,246,250,0.8)'; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt('Час вийшов', A.x + A.w / 2, A.y + A.h / 2, 26, INK, { font: FD });
        }
        if (bad.size && !inst.over) txt('Цифра повторюється', A.x + A.w / 2, (gy + size + 8 + Lr.pad[0].y) / 2, 12, PG.BAD, { font: FB, weight: 900 });
      };
      return inst;
    }
  });
})();

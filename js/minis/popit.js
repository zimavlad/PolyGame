// Pop It — the fidget toy as a fake playable ad: pop every bubble before the timer runs out.
(function () {
  const PG = window.PG;
  const { FD, FB, INK, clamp, circle, rrect, txt } = PG;
  const ROWS = ['#F2615E', '#F59E2E', '#F5C92E', '#22B59B', '#3E9BF0', '#7765EE'];

  PG.ads.register({
    id: 'popit',
    title: 'Pop It',
    hook: 'Лише 1% лопне всі бульбашки за 12 секунд!',
    create() {
      const COLS = 6, TIME = 12;
      const popped = Array.from({ length: ROWS.length }, () => Array(COLS).fill(0));
      let left = ROWS.length * COLS, t = 0, down = false;
      const inst = { over: null, hint: 'Тапай або веди пальцем по бульбашках' };
      function grid(A) {
        const pad = 18, top = 34;
        const cell = Math.min((A.w - pad * 2) / COLS, (A.h - top - pad) / ROWS.length);
        const gw = cell * COLS, gh = cell * ROWS.length;
        return { x: A.x + (A.w - gw) / 2, y: A.y + top + (A.h - top - gh) / 2, cell };
      }
      function popAt(x, y, A) {
        if (inst.over || !A) return;
        const g = grid(A);
        const c = Math.floor((x - g.x) / g.cell), r = Math.floor((y - g.y) / g.cell);
        if (r < 0 || r >= ROWS.length || c < 0 || c >= COLS || popped[r][c]) return;
        const cx = g.x + (c + 0.5) * g.cell, cy = g.y + (r + 0.5) * g.cell;
        if (Math.hypot(x - cx, y - cy) > g.cell * 0.46) return;
        popped[r][c] = PG.now; left--;
        PG.sfx.note(r + (c % 3)); PG.buzz(PG.HAP.tick);
        if (!left) inst.over = { won: true };
      }
      inst.down = (x, y, A) => { down = true; popAt(x, y, A); };
      inst.move = (x, y, A) => { if (down) popAt(x, y, A); };
      inst.up = () => { down = false; };
      inst.update = dt => {
        if (inst.over) return;
        t += dt;
        if (t >= TIME) inst.over = { won: false };
      };
      inst.draw = (ctx, A) => {
        const g = grid(A), R = g.cell * 0.4;
        // timer
        const k = clamp(1 - t / TIME, 0, 1);
        ctx.fillStyle = '#E3E8F0'; rrect(A.x + 18, A.y + 14, A.w - 36, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.3 ? PG.BAD : PG.PAL[2]; rrect(A.x + 18, A.y + 14, Math.max(8, (A.w - 36) * k), 8, 4); ctx.fill();
        // the toy
        ctx.fillStyle = '#FFFFFF'; rrect(g.x - 10, g.y - 10, g.cell * COLS + 20, g.cell * ROWS.length + 20, g.cell * 0.6); ctx.fill();
        for (let r = 0; r < ROWS.length; r++) for (let c = 0; c < COLS; c++) {
          const x = g.x + (c + 0.5) * g.cell, y = g.y + (r + 0.5) * g.cell, col = ROWS[r];
          ctx.fillStyle = col; circle(x, y, R + 3); ctx.fill();
          if (popped[r][c]) {
            const pk = clamp((PG.now - popped[r][c]) / 0.15, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; circle(x, y, R * (0.7 + 0.2 * pk)); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; circle(x + R * 0.25, y + R * 0.25, R * 0.35); ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(x - R * 0.3, y - R * 0.3, R * 0.35); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; circle(x, y, R); ctx.stroke();
          }
        }
        txt(`${ROWS.length * COLS - left}/${ROWS.length * COLS}`, A.x + A.w / 2, A.y + A.h - 14, 13, INK, { font: FB, weight: 900 });
        if (inst.over && !inst.over.won) {
          ctx.fillStyle = 'rgba(244,246,250,0.8)'; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt('Час вийшов', A.x + A.w / 2, A.y + A.h / 2, 26, INK, { font: FD });
        }
      };
      return inst;
    }
  });
})();

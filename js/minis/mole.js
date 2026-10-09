// Кріт — whack-a-mole as a fake playable ad: bonk 12 moles in 20 seconds, a bomb costs 2 points.
(function () {
  const PG = window.PG;
  const { FD, FB, INK, clamp, circle, rrect, txt } = PG;
  const GOAL = 12, TIME = 20, N = 9;
  const FUR = '#9B6B4E', FUR_D = '#7E5540', NOSE = '#F2615E';

  PG.ads.register({
    id: 'mole',
    title: 'Кріт',
    hook: 'Тільки справжній геймер приб\'є 12 кротів!',
    create() {
      // a hole: kind 'mole' | 'bomb' | null; up: time it appeared; life: how long it stays; hit: when it was bonked
      const holes = Array.from({ length: N }, () => ({ kind: null, up: 0, life: 0, hit: 0, out: 0 }));
      let t = 0, score = 0, spawnIn = 0.5, lastHole = -1;
      const inst = { over: null, hint: 'Тапай по кротах, бомби не чіпай' };

      function grid(A) {
        const pad = 20, top = 70;
        const cell = Math.min((A.w - pad * 2) / 3, (A.h - top - 30) / 3);
        const gw = cell * 3;
        return { x: A.x + (A.w - gw) / 2, y: A.y + top + (A.h - top - 30 - gw) / 2, cell };
      }
      function holeCenter(g, i) { return { x: g.x + (i % 3 + 0.5) * g.cell, y: g.y + (Math.floor(i / 3) + 0.6) * g.cell }; }
      // 0..1: how far the creature has risen out of the hole
      function rise(h) {
        if (!h.kind) return 0;
        if (h.hit) return clamp(1 - (PG.now - h.hit) / 0.22, 0, 1);
        const a = (PG.now - h.up) / 0.14, b = (h.up + h.life - PG.now) / 0.14;
        return clamp(Math.min(a, b, 1), 0, 1);
      }
      function spawn() {
        const free = holes.map((h, i) => (!h.kind && i !== lastHole ? i : -1)).filter(i => i >= 0);
        if (!free.length) return;
        const i = PG.pick(free), h = holes[i], k = clamp(t / TIME, 0, 1);
        lastHole = i;
        h.kind = Math.random() < 0.06 + 0.12 * k && t > 2 ? 'bomb' : 'mole';
        h.up = PG.now; h.hit = 0;
        h.life = (h.kind === 'bomb' ? 1.5 : 1.25 - 0.4 * k) + PG.rand(-0.1, 0.15);
      }

      inst.down = (x, y, A) => {
        if (inst.over) return;
        const g = grid(A);
        for (let i = 0; i < N; i++) {
          const h = holes[i], c = holeCenter(g, i);
          if (!h.kind || h.hit || rise(h) < 0.35) continue;
          if (Math.abs(x - c.x) > g.cell * 0.46 || y < c.y - g.cell * 0.72 || y > c.y + g.cell * 0.3) continue;
          h.hit = PG.now;
          if (h.kind === 'mole') {
            score++;
            PG.sfx.pop(); PG.buzz(PG.HAP.light);
            PG.burst(c.x, c.y - g.cell * 0.25, PG.PAL[1], 8, 140);
            PG.floatText(c.x, c.y - g.cell * 0.6, '+1', INK, 18);
            if (score >= GOAL) inst.over = { won: true };
          } else {
            score = Math.max(0, score - 2);
            PG.sfx.hit(); PG.buzz(PG.HAP.thud); PG.shake(6);
            PG.burst(c.x, c.y - g.cell * 0.25, PG.BAD, 14, 220);
            PG.floatText(c.x, c.y - g.cell * 0.6, '−2', PG.BAD, 20);
          }
          return;
        }
        PG.sfx.tick();
      };
      inst.update = dt => {
        if (inst.over) return;
        t += dt;
        for (const h of holes) {
          if (!h.kind) continue;
          if (h.hit ? PG.now - h.hit > 0.25 : PG.now > h.up + h.life) h.kind = null;
        }
        spawnIn -= dt;
        if (spawnIn <= 0) {
          spawn();
          // a second mole now and then once the player has warmed up
          if (t > 6 && Math.random() < 0.3) spawn();
          spawnIn = PG.lerp(0.72, 0.48, clamp(t / TIME, 0, 1)) + PG.rand(-0.08, 0.08);
        }
        if (t >= TIME) inst.over = { won: false };
      };
      function drawMole(ctx, x, y, r, hit) {
        ctx.fillStyle = FUR; rrect(x - r, y - r * 1.1, r * 2, r * 2.2, r); ctx.fill();
        ctx.fillStyle = '#C79A7C'; circle(x, y + r * 0.1, r * 0.55); ctx.fill();
        if (hit) {
          ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          for (const dx of [-0.38, 0.38]) {
            const ex = x + dx * r, ey = y - r * 0.42, s = r * 0.13;
            ctx.beginPath(); ctx.moveTo(ex - s, ey - s); ctx.lineTo(ex + s, ey + s); ctx.moveTo(ex + s, ey - s); ctx.lineTo(ex - s, ey + s); ctx.stroke();
          }
        } else {
          ctx.fillStyle = INK; circle(x - r * 0.38, y - r * 0.42, r * 0.13); ctx.fill(); circle(x + r * 0.38, y - r * 0.42, r * 0.13); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; circle(x - r * 0.34, y - r * 0.47, r * 0.05); ctx.fill(); circle(x + r * 0.42, y - r * 0.47, r * 0.05); ctx.fill();
        }
        ctx.fillStyle = NOSE; circle(x, y - r * 0.12, r * 0.17); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; rrect(x - r * 0.14, y + r * 0.06, r * 0.12, r * 0.18, 2); ctx.fill(); rrect(x + r * 0.02, y + r * 0.06, r * 0.12, r * 0.18, 2); ctx.fill();
        ctx.fillStyle = FUR_D; circle(x - r * 0.62, y + r * 0.85, r * 0.22); ctx.fill(); circle(x + r * 0.62, y + r * 0.85, r * 0.22); ctx.fill();
      }
      function drawBomb(ctx, x, y, r, hit) {
        if (hit) { ctx.fillStyle = PG.rgba(PG.BAD, 0.35); circle(x, y, r * 1.3); ctx.fill(); }
        ctx.fillStyle = '#2E3440'; circle(x, y, r * 0.9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; circle(x - r * 0.3, y - r * 0.32, r * 0.24); ctx.fill();
        ctx.fillStyle = '#5B6474'; rrect(x - r * 0.22, y - r * 1.12, r * 0.44, r * 0.3, 3); ctx.fill();
        ctx.strokeStyle = '#8B6B4E'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - r * 1.1); ctx.quadraticCurveTo(x + r * 0.4, y - r * 1.5, x + r * 0.55, y - r * 1.3); ctx.stroke();
        const fl = 0.7 + 0.3 * Math.sin(PG.now * 30);
        ctx.fillStyle = PG.PAL[1]; circle(x + r * 0.58, y - r * 1.32, r * 0.2 * fl); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; circle(x + r * 0.58, y - r * 1.32, r * 0.08 * fl); ctx.fill();
        txt('!', x, y + r * 0.05, r * 0.9, '#FFFFFF', { font: FD });
      }
      inst.draw = (ctx, A) => {
        const g = grid(A);
        ctx.fillStyle = '#E4F3E8'; ctx.fillRect(A.x, A.y, A.w, A.h);
        const k = clamp(1 - t / TIME, 0, 1);
        ctx.fillStyle = '#D2E6D8'; rrect(A.x + 18, A.y + 14, A.w - 36, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.25 ? PG.BAD : PG.PAL[2]; rrect(A.x + 18, A.y + 14, Math.max(8, (A.w - 36) * k), 8, 4); ctx.fill();
        txt(`${score}/${GOAL}`, A.x + A.w / 2, A.y + 46, 26, INK, { font: FD });
        for (let i = 0; i < N; i++) {
          const h = holes[i], c = holeCenter(g, i), r = g.cell * 0.3, hw = g.cell * 0.4;
          // hole
          ctx.fillStyle = '#5A4334'; ctx.beginPath(); ctx.ellipse(c.x, c.y, hw, hw * 0.34, 0, 0, Math.PI * 2); ctx.fill();
          const p = rise(h);
          if (p > 0) {
            // the creature rises from behind the front lip of the hole
            ctx.save();
            ctx.beginPath(); ctx.rect(c.x - g.cell / 2, c.y - g.cell, g.cell, g.cell); ctx.ellipse(c.x, c.y, hw, hw * 0.34, 0, 0, Math.PI); ctx.clip();
            const y = c.y + r * 1.25 - p * r * 1.75;
            if (h.kind === 'mole') drawMole(ctx, c.x, y, r, !!h.hit); else drawBomb(ctx, c.x, y, r, !!h.hit);
            ctx.restore();
          }
          // front lip of grass
          ctx.fillStyle = '#7FC48E'; ctx.beginPath(); ctx.ellipse(c.x, c.y + hw * 0.18, hw * 1.08, hw * 0.2, 0, 0, Math.PI); ctx.fill();
        }
        if (inst.over && !inst.over.won) {
          ctx.fillStyle = 'rgba(244,246,250,0.8)'; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt('Час вийшов', A.x + A.w / 2, A.y + A.h / 2, 26, INK, { font: FD });
        }
      };
      return inst;
    }
  });
})();

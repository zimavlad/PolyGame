// Stack — after Ketchapp's Stack. A slab slides over the tower; tap to drop it, the overhang is cut off.
(function () {
  const PG = window.PG;
  const { PAL, FD, FB, clamp, randi, txt } = PG;

  function slab(ctx, x, y, w, h, hue) {
    ctx.fillStyle = `hsl(${hue},62%,62%)`; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `hsl(${hue},72%,77%)`; ctx.fillRect(x, y, w, Math.min(h * 0.24, 6));
    const e = Math.min(6, w * 0.06);
    ctx.fillStyle = `hsla(${hue},55%,28%,0.16)`; ctx.fillRect(x + w - e, y, e, h);
  }

  PG.arcade.register({
    id: 'stack',
    title: 'Stack',
    family: 'Ketchapp',
    accent: PAL[3],
    howto: ['Тапни, щоб скинути блок на вежу', 'Що точніше, то ширша вежа'],
    goal: lv => ({ count: Math.min(6 + lv * 2, 26), unit: 'поверхів' }),
    icon(ctx, x, y, r) { [[1.3, 0.55], [1.1, 0], [0.9, -0.55]].forEach(([w, dy], i) => { ctx.fillStyle = `hsl(${250 + i * 18},62%,64%)`; ctx.fillRect(x - r * w / 2, y + dy * r - r * 0.22, r * w, r * 0.45); }); },
    create(level) {
      // Level 1: a slow slab, a wide base and a generous "perfect" window.
      const speed0 = Math.min(0.34 + (level - 1) * 0.03, 0.75);
      const tol = Math.max(0.025 - (level - 1) * 0.0015, 0.012);
      const base = Math.max(0.64 - (level - 1) * 0.01, 0.5);
      const s = { blocks: [{ x: (1 - base) / 2, w: base }], cur: null, debris: [], cam: 0, streak: 0, hue0: randi(360), moving: false };
      const inst = { progress: 0, over: null, stats: { perfects: 0, level, lastDelta: 0 } };
      const hue = i => (s.hue0 + i * 9) % 360;
      const geo = A => { const lh = Math.max(14, A.h * 0.05); return { lh, baseTop: A.y + A.h * 0.74 + s.cam * lh }; };
      function spawn() {
        const top = s.blocks[s.blocks.length - 1], fromLeft = s.blocks.length % 2 === 1;
        s.cur = { w: top.w, x: fromLeft ? -top.w * 0.3 : 1 - top.w * 0.7, dir: fromLeft ? 1 : -1 };
      }
      spawn();
      function drop(A) {
        const top = s.blocks[s.blocks.length - 1], c = s.cur;
        if (!c) return;
        const { lh, baseTop } = geo(A);
        const layer = s.blocks.length, delta = c.x - top.x;
        inst.stats.lastDelta = Math.round(delta * 1000) / 1000;
        if (Math.abs(delta) <= tol) {
          const nb = { x: top.x, w: top.w, perfectAt: PG.now };
          s.streak++; inst.stats.perfects++;
          if (s.streak >= 3 && nb.w < base) { const g = Math.min(0.03, base - nb.w); nb.w += g; nb.x = clamp(nb.x - g / 2, 0, 1 - nb.w); }
          s.blocks.push(nb);
          PG.reward({ energy: 1, score: 20, x: A.x + (nb.x + nb.w / 2) * A.w, y: baseTop - layer * lh - 24 });
          PG.sfx.stack(s.streak + 1); PG.buzz(PG.HAP.double);
          PG.floatText(A.x + (nb.x + nb.w / 2) * A.w, baseTop - layer * lh - 50, s.streak >= 3 ? 'ІДЕАЛЬНО ×' + s.streak : 'ІДЕАЛЬНО!', PAL[1], 18);
        } else {
          const l = Math.max(c.x, top.x), rr = Math.min(c.x + c.w, top.x + top.w), ov = rr - l;
          if (ov <= 0) {
            s.debris.push({ x: c.x, w: c.w, layer, dy: 0, vy: 0, rot: 0, vr: (Math.random() - 0.5) * 3 });
            s.cur = null;
            inst.over = { won: false, cause: 'miss' };
            PG.sfx.die(); PG.shake(6);
            return;
          }
          s.blocks.push({ x: l, w: ov });
          if (delta > 0) s.debris.push({ x: rr, w: c.x + c.w - rr, layer, dy: 0, vy: 0, rot: 0, vr: 2 + Math.random() * 2 });
          else s.debris.push({ x: c.x, w: l - c.x, layer, dy: 0, vy: 0, rot: 0, vr: -2 - Math.random() * 2 });
          s.streak = 0; PG.sfx.cut(); PG.buzz(PG.HAP.light);
          PG.reward({ score: 10 });
        }
        inst.progress++;
        spawn();
      }
      inst.tap = () => {
        if (inst.over) return;
        if (!s.moving) { s.moving = true; PG.sfx.pick(); return; } // the first tap only sets the slab in motion
        drop(PG.arena);
      };
      inst.win = () => { s.cur = null; };
      inst.update = (dt, A) => {
        s.cam += (Math.max(0, inst.progress - 6) - s.cam) * Math.min(1, dt * 5);
        if (s.moving && s.cur && !inst.over) {
          const c = s.cur, sp = Math.min(speed0 + inst.progress * 0.025, 1.2);
          c.x += c.dir * sp * dt;
          const mn = -c.w * 0.3, mx = 1 - c.w * 0.7;
          if (c.x > mx) { c.x = mx; c.dir = -1; } else if (c.x < mn) { c.x = mn; c.dir = 1; }
        }
        for (const d of s.debris) { d.vy += A.h * 2.4 * dt; d.dy += d.vy * dt; d.rot += d.vr * dt; }
        for (let i = s.debris.length - 1; i >= 0; i--) if (s.debris[i].dy > A.h * 1.6) s.debris.splice(i, 1);
      };
      inst.idle = (dt, A) => inst.update(dt, A);
      inst.draw = (ctx, A) => {
        const { lh, baseTop } = geo(A);
        const h = hue(inst.progress);
        const gr = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
        gr.addColorStop(0, `hsl(${h},60%,93%)`); gr.addColorStop(1, `hsl(${(h + 40) % 360},52%,82%)`);
        ctx.fillStyle = gr; ctx.fillRect(A.x, A.y, A.w, A.h);
        const b0 = s.blocks[0];
        slab(ctx, A.x + b0.x * A.w, baseTop, b0.w * A.w, A.y + A.h - baseTop + 4, hue(0));
        for (let i = 1; i < s.blocks.length; i++) {
          const b = s.blocks[i], y = baseTop - i * lh;
          if (y > A.y + A.h) continue;
          slab(ctx, A.x + b.x * A.w, y, b.w * A.w, lh, hue(i));
          if (b.perfectAt && PG.now - b.perfectAt < 0.5) {
            const k = (PG.now - b.perfectAt) / 0.5;
            ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
            ctx.strokeRect(A.x + b.x * A.w - k * 12, y - k * 12, b.w * A.w + k * 24, lh + k * 24);
          }
        }
        if (s.cur) slab(ctx, A.x + s.cur.x * A.w, baseTop - s.blocks.length * lh, s.cur.w * A.w, lh, hue(s.blocks.length));
        for (const d of s.debris) {
          const w = d.w * A.w, x = A.x + d.x * A.w, y = baseTop - d.layer * lh + d.dy;
          ctx.save(); ctx.translate(x + w / 2, y + lh / 2); ctx.rotate(d.rot); slab(ctx, -w / 2, -lh / 2, w, lh, hue(d.layer)); ctx.restore();
        }
        const col = `hsl(${h},35%,36%)`, cx = A.x + A.w / 2;
        txt(String(inst.progress), cx, A.y + A.h * 0.36, Math.min(56, A.w * 0.16), col, { font: FD });
        if (!s.moving && !inst.over) txt('Тапни — блок поїде', cx, A.y + A.h * 0.36 + 44, 14, col, { font: FB, weight: 900 });
      };
      return inst;
    }
  });
})();

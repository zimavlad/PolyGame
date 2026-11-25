// Ласощі для Ави — a drop-and-merge puzzle. Slide your finger to aim, let go to drop a treat into Ava's basket.
// Two equal treats touching merge into the next one up: biscuit → cookie → sausage → ball → squeaky chicken → frisbee →
// big bone → teddy → her bed. Two beds make Ava curl up and sleep (a big bonus). Don't let the basket overflow.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, rand, randi, txt, rgba } = PG;
  const ACCENT = '#E8743B';
  const ITEMS = ['biscuit', 'cookie', 'sausage', 'ball', 'chicken', 'frisbee', 'bone', 'bear', 'bed'];
  const NAMES = ['печиво-кісточка', 'печиво', 'сосиска', "м'ячик", 'курочка-пищалка', 'фризбі', 'велика кістка', 'ведмедик', 'лежанка'];
  const RAD = ITEMS.map((_, k) => 0.058 * Math.pow(1.235, k)); // in basket widths
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66];
  PG.arcade.register({
    id: 'avamerge',
    title: 'Ласощі для Ави',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/treats/chicken.webp',
    howto: ['Веди пальцем і відпусти — смаколик падає', 'Два однакові злипаються в більший'],
    goal: lv => ({ count: Math.min(10 + (lv - 1) * 3, 40), unit: 'злиттів' }),
    twist: lv => ({ 1: 'Розминка: просторий кошик', 2: 'Більша ціль', 3: 'Нове: падають і сосиски', 4: 'Кошик вужчий', 5: "Нове: падають і м'ячики" }[lv] || 'Кошик вужчий, ціль більша'),
    icon(ctx, x, y, r) { PG.drawSprite(ctx, 'img/treats/chicken.webp', x, y, r * 1.5); },
    create(level) {
      const L = level;
      const maxSpawn = L >= 5 ? 3 : L >= 3 ? 2 : 1;
      const narrow = L >= 4 ? Math.min(0.12, 0.03 * (L - 3)) : 0;
      const s = { t: 0, items: [], aim: 0.5, cur: randi(maxSpawn + 1), next: randi(maxSpawn + 1), cool: 0, danger: 0, pops: [], idc: 0, sleepAt: -9, cheerAt: -9, best: 0 };
      const inst = { progress: 0, over: null, stats: { level: L, drops: 0, top: 0 } };
      inst._s = s;
      let box = null; // basket in px, recomputed every frame
      const geo = A => {
        const w = A.w * (0.9 - narrow), x = A.x + (A.w - w) / 2, top = A.y + A.h * 0.24, bottom = A.y + A.h - 34;
        box = { x, w, top, bottom, h: (bottom - top) / w }; return box;
      };
      function drop() {
        if (s.cool > 0 || inst.over) return;
        const r = RAD[s.cur];
        s.items.push({ id: ++s.idc, k: s.cur, x: clamp(s.aim, r, 1 - r), y: -r - 0.02, vx: 0, vy: 0.3, rot: rand(-0.3, 0.3), vr: 0, born: s.t });
        s.cur = s.next; s.next = randi(maxSpawn + 1); s.cool = 0.45; inst.stats.drops++;
        PG.sfx.whoosh(); PG.buzz(PG.HAP.tick);
      }
      function merge(a, b, A) {
        a.dead = b.dead = true;
        const k = a.k + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        inst.progress++;
        const px = box.x + x * box.w, py = box.top + y * box.w;
        if (k >= ITEMS.length) { // two beds: Ava falls asleep in it
          s.sleepAt = s.t; PG.reward({ score: 500, energy: 3, x: px, y: py }); PG.floatText(px, py - 40, 'Ава спить!', ACCENT, 24);
          PG.sfx.win(); PG.buzz(PG.HAP.success); PG.confetti && PG.confetti(40); return;
        }
        s.items.push({ id: ++s.idc, k, x, y, vx: 0, vy: -0.4, rot: 0, vr: rand(-2, 2), born: s.t, pop: s.t });
        s.best = Math.max(s.best, k); inst.stats.top = s.best;
        PG.reward({ score: 10 * (k + 1), energy: k >= 5 ? 1 : 0, x: px, y: py });
        if (k >= 4) { s.cheerAt = s.t; PG.floatText(px, py - 30, NAMES[k] + '!', ACCENT, 18); }
        PG.tone && PG.tone(notes[Math.min(k, notes.length - 1)], 0.18, 'triangle', 0.1); PG.tone && PG.tone(notes[Math.min(k, notes.length - 1)] * 1.5, 0.2, 'sine', 0.05, 0.05);
        PG.buzz(k >= 5 ? PG.HAP.double : PG.HAP.light); PG.burst(px, py, '#F5B12E', 8 + k * 2, 160 + k * 15);
      }
      function physics(dt, A) {
        const g = 2.6, H = box.h;
        for (const it of s.items) {
          it.vy += g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
          it.vx *= Math.pow(0.6, dt); it.vr *= Math.pow(0.4, dt);
          const r = RAD[it.k];
          if (it.x < r) { it.x = r; it.vx = Math.abs(it.vx) * 0.2; }
          if (it.x > 1 - r) { it.x = 1 - r; it.vx = -Math.abs(it.vx) * 0.2; }
          if (it.y > H - r) { it.y = H - r; if (it.vy > 0.6) PG.buzz(PG.HAP.tick); it.vy = -Math.abs(it.vy) * 0.15; it.vr += it.vx * 4; }
        }
        for (let iter = 0; iter < 4; iter++) {
          for (let i = 0; i < s.items.length; i++) for (let j = i + 1; j < s.items.length; j++) {
            const a = s.items[i], b = s.items[j]; if (a.dead || b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, ra = RAD[a.k], rb = RAD[b.k], ov = ra + rb - d;
            if (ov > 0) {
              if (a.k === b.k && iter === 0) { merge(a, b, A); continue; }
              const nx = dx / d, ny = dy / d, ma = ra * ra, mb = rb * rb, sum = ma + mb;
              a.x -= nx * ov * (mb / sum); a.y -= ny * ov * (mb / sum); b.x += nx * ov * (ma / sum); b.y += ny * ov * (ma / sum);
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) { const imp = -1.15 * rv / (1 / ma + 1 / mb); a.vx -= imp / ma * nx; a.vy -= imp / ma * ny; b.vx += imp / mb * nx; b.vy += imp / mb * ny; a.vr -= rv * nx * 2; b.vr += rv * nx * 2; }
            }
          }
          s.items = s.items.filter(it => !it.dead);
        }
      }
      Object.assign(inst, {
        tap(x) { const A = PG.arena; geo(A); s.aim = clamp((x - box.x) / box.w, 0, 1); s.holding = true; },
        move(x) { if (!box) return; s.aim = clamp((x - box.x) / box.w, 0, 1); },
        up(x) { if (!box) return; s.aim = clamp((x - box.x) / box.w, 0, 1); if (s.holding) drop(); s.holding = false; },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt; geo(A); s.cool -= dt;
          const steps = 3; for (let i = 0; i < steps; i++) physics(dt / steps, A);
          // overflow: something resting above the line for a while
          const line = 0.1;
          const high = s.items.some(it => it.y - RAD[it.k] < line && s.t - it.born > 1.2 && Math.abs(it.vy) < 0.4);
          s.danger = high ? s.danger + dt : Math.max(0, s.danger - dt * 2);
          if (s.danger > 2.2 && !inst.over) { inst.over = { won: false, cause: 'overflow' }; PG.sfx.over(); PG.shake(6); }
        },
        draw(ctx, A) {
          geo(A);
          // warm room background
          const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, '#FFE9CF'); g.addColorStop(1, '#F6C9A0');
          ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h);
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.arc(A.x + (i + (j % 2) * 0.5) * A.w / 6, A.y + j * A.h / 8, 3, 0, Math.PI * 2); ctx.fill(); }
          txt(String(inst.progress), A.x + A.w / 2, A.y + A.h * 0.55, Math.min(110, A.w * 0.3), 'rgba(255,255,255,0.55)', { font: FD });
          // basket
          const bx = box.x, bw = box.w, bt = box.top, bb = box.bottom;
          ctx.fillStyle = 'rgba(160,100,50,0.12)'; PG.rrect(bx - 6, bt, bw + 12, bb - bt + 8, 18); ctx.fill();
          ctx.strokeStyle = '#B9814F'; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx - 3, bt + 10); ctx.lineTo(bx - 3, bb + 3); ctx.lineTo(bx + bw + 3, bb + 3); ctx.lineTo(bx + bw + 3, bt + 10); ctx.stroke();
          // danger line
          const ly = bt + 0.1 * bw;
          ctx.setLineDash([8, 8]); ctx.strokeStyle = s.danger > 0 ? rgba('#E5484D', 0.5 + 0.5 * Math.sin(s.t * 14)) : 'rgba(185,129,79,0.45)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx + bw, ly); ctx.stroke(); ctx.setLineDash([]);
          // items
          for (const it of s.items) {
            const r = RAD[it.k] * bw, px = bx + it.x * bw, py = bt + it.y * bw;
            const pop = it.pop != null ? Math.min(1, (s.t - it.pop) / 0.25) : 1, sc = 0.6 + 0.4 * PG.easeOutBack(pop);
            PG.drawSprite(ctx, 'img/treats/' + ITEMS[it.k] + '.webp', px, py, r * 2.25 * sc, { rot: it.rot });
          }
          // next treat and Ava watching
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; PG.rrect(A.x + A.w - 66, A.y + 12, 54, 54, 16); ctx.fill();
          txt('далі', A.x + A.w - 39, A.y + 22, 10, '#9A6A44', { font: FB, weight: 900 });
          PG.drawSprite(ctx, 'img/treats/' + ITEMS[s.next] + '.webp', A.x + A.w - 39, A.y + 44, 30);
          const sleeping = s.t - s.sleepAt < 3;
          if (sleeping) { PG.drawSprite(ctx, 'img/treats/bed.webp', A.x + 58, A.y + 72, 52); PG.ava.draw(ctx, A.x + 58, A.y + 82, A.w * 0.14, { pose: 'sleep', t: s.t, shadow: false }); txt('z z z', A.x + 98, A.y + 30 - (s.t % 1) * 8, 14, '#7765EE', { font: FD }); }
          else PG.ava.draw(ctx, A.x + 52, A.y + A.h * 0.2, A.w * 0.15, { pose: s.t - s.cheerAt < 1 ? 'jump' : s.danger > 0 ? 'scared' : 'happy', t: s.t, shadow: false });
          // aim: the treat in hand and a guide line
          if (!inst.over) {
            const r = RAD[s.cur] * bw, px = bx + clamp(s.aim, RAD[s.cur], 1 - RAD[s.cur]) * bw, py = bt - r - 6;
            ctx.strokeStyle = 'rgba(185,129,79,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(px, py + r); ctx.lineTo(px, bb); ctx.stroke(); ctx.setLineDash([]);
            PG.drawSprite(ctx, 'img/treats/' + ITEMS[s.cur] + '.webp', px, py, r * 2.25, { alpha: s.cool > 0 ? 0.5 : 1 });
          }
        }
      });
      return inst;
    }
  });
})();

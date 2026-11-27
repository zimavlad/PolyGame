// Ласощі для Ави — a drop-and-merge puzzle. Slide your finger to aim, let go to drop a treat into Ava's basket.
// Two equal treats touching merge into the next one up: biscuit → cookie → sausage → ball → squeaky chicken → frisbee →
// big bone → teddy → her bed. Two beds make Ava curl up and sleep (a big bonus). Don't let the basket overflow.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, rand, randi, pick, txt, rgba } = PG;
  const ACCENT = '#E8743B';
  const ITEMS = ['biscuit', 'cookie', 'sausage', 'ball', 'chicken', 'frisbee', 'bone', 'bear', 'bed'];
  const NAMES = ['печиво-кісточка', 'печиво', 'сосиска', "м'ячик", 'курочка-пищалка', 'фризбі', 'велика кістка', 'ведмедик', 'лежанка'];
  const RAD = ITEMS.map((_, k) => 0.058 * Math.pow(1.235, k)); // in basket widths
  // each level asks for one treat further up the ladder: a ball, a squeaky chicken ... Ava's bed
  const GOALN = ['', '', '', "м'ячик", 'курочка-пищалка', 'фризбі', 'велика кістка', 'ведмедик', 'лежанка'];
  const targetOf = lv => Math.min(3 + lv, 8);
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66];
  PG.arcade.register({
    id: 'avamerge',
    title: 'Ласощі для Ави',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/treats/chicken.webp',
    howto: ['Веди пальцем і відпусти: смаколик упаде', 'Два однакові злипаються в більший. Збери те, що вгорі'],
    boosts: [{ id: 'wide', icon: '↔️', name: 'Ширший кошик', price: 3 }],
    goal: lv => ({ count: 1, unit: GOALN[targetOf(lv)] }),
    twist: lv => `Зроби: ${GOALN[targetOf(lv)]}` + (lv >= 2 ? ' · кошик вужчий' : ''),
    icon(ctx, x, y, r) { PG.drawSprite(ctx, 'img/treats/chicken.webp', x, y, r * 1.5); },
    create(level) {
      const L = level;
      const maxSpawn = L >= 3 ? 3 : L >= 2 ? 2 : 1;
      const narrow = L >= 2 ? Math.min(0.16, 0.035 * (L - 1)) : 0;
      const s = { t: 0, items: [], aim: 0.5, cur: randi(maxSpawn + 1), next: randi(maxSpawn + 1), cool: 0, danger: 0, pops: [], idc: 0, sleepAt: -9, cheerAt: -9, best: 0 };
      const inst = { progress: 0, over: null, stats: { level: L, drops: 0, top: 0 } };
      const target = targetOf(L);
      // drops a tidy player needs: the goal's 'mass' (2^tier) over the average mass of a dropped treat, plus some slack
      const avgMass = (() => { let m = 0; for (let k = 0; k <= (L >= 3 ? 3 : L >= 2 ? 2 : 1); k++) m += Math.pow(2, k); return m / ((L >= 3 ? 3 : L >= 2 ? 2 : 1) + 1); })();
      const parDrops = Math.ceil(Math.pow(2, target) / avgMass * 1.15);
      inst._s = s;
      let box = null; // basket in px, recomputed every frame
      const geo = A => {
        const w = A.w * (0.9 - (s.wide ? 0 : narrow)), x = A.x + (A.w - w) / 2, top = A.y + A.h * 0.24, bottom = A.y + A.h - 34;
        box = { x, w, top, bottom, h: (bottom - top) / w }; return box;
      };
      function drop() {
        if (s.cool > 0 || inst.over) return;
        const r = RAD[s.cur];
        s.items.push({ id: ++s.idc, k: s.cur, x: clamp(s.aim, r, 1 - r), y: -r - 0.02, vx: 0, vy: 0.3, rot: rand(-0.15, 0.15), vr: 0, born: s.t, gold: s.curGold });
        s.cur = s.next; s.curGold = s.nextGold; s.nextGold = false; s.next = randi(maxSpawn + 1);
        // now and then a golden biscuit: whatever it touches goes one step up the ladder
        if (inst.stats.drops % 11 === 9) { s.nextGold = true; s.next = 0; } s.cool = 0.45; inst.stats.drops++;
        PG.sfx.whoosh(); PG.buzz(PG.HAP.tick);
      }
      function merge(a, b, A) {
        a.dead = b.dead = true;
        const k = a.k + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        s.merges = (s.merges || 0) + 1;
        const px = box.x + x * box.w, py = box.top + y * box.w;
        if (k >= ITEMS.length) { // two beds: Ava falls asleep in it
          s.sleepAt = s.t; PG.reward({ score: 500, energy: 3, x: px, y: py }); PG.floatText(px, py - 40, 'Ава спить!', ACCENT, 24);
          PG.sfx.win(); PG.buzz(PG.HAP.success); PG.confetti && PG.confetti(40); return;
        }
        s.items.push({ id: ++s.idc, k, x, y, vx: 0, vy: -0.4, rot: 0, vr: rand(-1, 1), born: s.t, pop: s.t });
        // merges in quick succession make a combo: more points, a higher note, Ava cheers
        s.combo = s.t - (s.lastMerge || -9) < 1.3 ? (s.combo || 1) + 1 : 1; s.lastMerge = s.t;
        if (s.combo >= 2) { PG.floatText(px, py - 46, `Комбо ×${s.combo}!`, '#7765EE', 16 + Math.min(s.combo, 5) * 2); PG.reward({ score: 15 * s.combo }); s.cheerAt = s.t; }
        s.say = { text: pick(['Ням!', 'Смачно!', 'Ще!', 'Гав!']), t: s.t };
        s.best = Math.max(s.best, k); inst.stats.top = s.best;
        if (k >= target && !inst.progress) { // the goal treat: Ava jumps for joy
          inst.progress = 1; s.cheerAt = s.t;
          const used = inst.stats.drops; inst.stars = used <= parDrops ? 3 : used <= parDrops * 1.4 ? 2 : 1; inst.stats.stars = inst.stars;
          PG.floatText(px, py - 50, 'Ура! ' + GOALN[target] + '!', ACCENT, 22);
        }
        PG.reward({ score: 10 * (k + 1), energy: k >= 5 ? 1 : 0, x: px, y: py });
        if (k >= 4) { s.cheerAt = s.t; PG.floatText(px, py - 30, NAMES[k] + '!', ACCENT, 18); }
        PG.tone && PG.tone(notes[Math.min(k, notes.length - 1)], 0.18, 'triangle', 0.1); PG.tone && PG.tone(notes[Math.min(k, notes.length - 1)] * 1.5, 0.2, 'sine', 0.05, 0.05);
        PG.buzz(k >= 5 ? PG.HAP.double : PG.HAP.light); PG.burst(px, py, '#F5B12E', 8 + k * 2, 160 + k * 15);
      }
      function physics(dt, A) {
        const g = 2.6, H = box.h;
        for (const it of s.items) {
          it.vy += g * dt; it.x += it.vx * dt; it.y += it.vy * dt;
          it.vx *= Math.pow(0.6, dt);
          // treats lean a little when nudged and settle back upright, they never spin
          it.vr += (-it.rot * 18 - it.vr * 6) * dt; it.rot = clamp(it.rot + it.vr * dt, -0.35, 0.35);
          const r = RAD[it.k];
          if (it.x < r) { it.x = r; it.vx = Math.abs(it.vx) * 0.2; }
          if (it.x > 1 - r) { it.x = 1 - r; it.vx = -Math.abs(it.vx) * 0.2; }
          if (it.y > H - r) { it.y = H - r; if (it.vy > 0.6) PG.buzz(PG.HAP.tick); it.vy = -Math.abs(it.vy) * 0.15; it.vr += it.vx * 0.8; }
        }
        for (let iter = 0; iter < 4; iter++) {
          for (let i = 0; i < s.items.length; i++) for (let j = i + 1; j < s.items.length; j++) {
            const a = s.items[i], b = s.items[j]; if (a.dead || b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, ra = RAD[a.k], rb = RAD[b.k], ov = ra + rb - d;
            if (ov > 0) {
              if (iter === 0 && (a.gold || b.gold) && !(a.gold && b.gold)) { const gld = a.gold ? a : b, other = a.gold ? b : a; gld.k = other.k; gld.gold = false; merge(gld, other, A); continue; }
              if (a.k === b.k && iter === 0) { merge(a, b, A); continue; }
              const nx = dx / d, ny = dy / d, ma = ra * ra, mb = rb * rb, sum = ma + mb;
              a.x -= nx * ov * (mb / sum); a.y -= ny * ov * (mb / sum); b.x += nx * ov * (ma / sum); b.y += ny * ov * (ma / sum);
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) { const imp = -1.15 * rv / (1 / ma + 1 / mb); a.vx -= imp / ma * nx; a.vy -= imp / ma * ny; b.vx += imp / mb * nx; b.vy += imp / mb * ny; a.vr -= rv * nx * 0.4; b.vr += rv * nx * 0.4; }
            }
          }
          s.items = s.items.filter(it => !it.dead);
        }
      }
      inst.boost = id => { if (id === 'wide') s.wide = true; };
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
          // the ladder up to the goal treat: what you have made so far glows, the goal sits in a ring
          const ly0 = A.y + A.h * 0.235 - 22, n = target + 1, step = Math.min(30, (A.w - 150) / n), lx0 = A.x + A.w / 2 - (n - 1) * step / 2 + 30;
          for (let k = 0; k <= target; k++) {
            const x = lx0 + k * step, got = k <= s.best, isGoal = k === target;
            if (isGoal) { ctx.strokeStyle = rgba(ACCENT, 0.6 + 0.4 * Math.sin(s.t * 5)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, ly0, step * 0.52, 0, Math.PI * 2); ctx.stroke(); }
            PG.drawSprite(ctx, 'img/treats/' + ITEMS[k] + '.webp', x, ly0, step * (isGoal ? 0.95 : 0.78), { alpha: got ? 1 : 0.28 });
          }
          txt(`кидків: ${inst.stats.drops}`, A.x + A.w / 2 + 30, ly0 + 22, 11, 'rgba(154,106,68,0.8)', { font: FB, weight: 900 });
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
            if (it.gold) { ctx.fillStyle = rgba('#F5B12E', 0.35 + 0.2 * Math.sin(s.t * 8)); ctx.beginPath(); ctx.arc(px, py, r * 1.5, 0, Math.PI * 2); ctx.fill(); }
            PG.drawSprite(ctx, 'img/treats/' + ITEMS[it.k] + '.webp', px, py, r * 2.25 * sc, { rot: it.rot });
            if (it.gold) txt('✨', px + r * 0.8, py - r * 0.8, 14, '#000', {});
          }
          // next treat and Ava watching
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; PG.rrect(A.x + A.w - 66, A.y + 12, 54, 54, 16); ctx.fill();
          txt('далі', A.x + A.w - 39, A.y + 22, 10, '#9A6A44', { font: FB, weight: 900 });
          if (s.nextGold) { ctx.fillStyle = rgba('#F5B12E', 0.4); ctx.beginPath(); ctx.arc(A.x + A.w - 39, A.y + 44, 18, 0, Math.PI * 2); ctx.fill(); }
          PG.drawSprite(ctx, 'img/treats/' + ITEMS[s.next] + '.webp', A.x + A.w - 39, A.y + 44, 30);
          const sleeping = s.t - s.sleepAt < 3;
          if (sleeping) { PG.drawSprite(ctx, 'img/treats/bed.webp', A.x + 58, A.y + 72, 52); PG.ava.draw(ctx, A.x + 58, A.y + 82, A.w * 0.14, { pose: 'sleep', t: s.t, shadow: false }); txt('z z z', A.x + 98, A.y + 30 - (s.t % 1) * 8, 14, '#7765EE', { font: FD }); }
          else PG.ava.draw(ctx, A.x + 52, A.y + A.h * 0.2, A.w * 0.15, { pose: s.t - s.cheerAt < 1 ? 'hop' : s.danger > 0 ? 'scared' : 'idle', t: s.t, shadow: false });
          if (s.say && s.t - s.say.t < 0.9) { const a = 1 - (s.t - s.say.t) / 0.9; ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`; PG.rrect(A.x + 70, A.y + A.h * 0.2 - 92, 64, 26, 13); ctx.fill(); txt(s.say.text, A.x + 102, A.y + A.h * 0.2 - 79, 13, rgba('#9A5A2E', a), { font: FB, weight: 900 }); }
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

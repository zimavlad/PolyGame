// Пекарня — build the cake on the order card. Pick the right layer from the shelf, then tap when it slides over the
// cake to drop it. The closer to the middle, the neater the cake; a layer that misses the cake falls, and so does a
// wrong pick count as a slip. Three slips and the bakery closes for the day. Ava sits by the counter, hoping.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, rand, randi, pick, shuffle, txt, rgba, easeOutBack } = PG;
  const ACCENT = '#EC6F9C';
  // layer kinds: base colour, highlight, and how it is drawn
  const KINDS = {
    sponge: { name: 'бісквіт', c: '#F2C46B', l: '#FBE2A6', d: '#C9963F', h: 1, style: 'sponge' },
    choco: { name: 'шоколад', c: '#7A4A2E', l: '#9C6643', d: '#56301C', h: 1, style: 'sponge' },
    cream: { name: 'крем', c: '#FFF6EA', l: '#FFFFFF', d: '#E8D9C4', h: 0.55, style: 'cream' },
    jam: { name: 'полуниця', c: '#E8455A', l: '#FF7C8C', d: '#B52A3D', h: 0.5, style: 'jam' },
    berry: { name: 'чорниця', c: '#5A57C9', l: '#7F7CE8', d: '#3B389A', h: 0.5, style: 'jam' },
    mint: { name: "м'ята", c: '#8FDCC2', l: '#B9F0DD', d: '#5DB79A', h: 0.55, style: 'cream' }
  };
  const TOPS = ['cherry', 'strawberry', 'candles'];
  const BASES = ['sponge', 'choco'];
  const FILL = ['cream', 'jam', 'berry', 'mint'];
  function recipe(level, n) {
    const r = []; const base = level >= 3 ? pick(BASES) : 'sponge';
    r.push(base);
    while (r.length < n - 1) { r.push(pick(level >= 2 ? FILL : ['cream', 'jam'])); if (r.length < n - 1) r.push(level >= 4 ? pick(BASES) : base); }
    r.push('top:' + pick(TOPS));
    return r;
  }
  function layer(ctx, kind, x, y, w, h, t) {
    if (kind.startsWith('top:')) return topping(ctx, kind.slice(4), x, y, w, h, t);
    const k = KINDS[kind];
    ctx.save();
    if (k.style === 'sponge') {
      const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, k.l); g.addColorStop(1, k.c);
      ctx.fillStyle = g; PG.rrect(x - w / 2, y - h, w, h, Math.min(8, h * 0.3)); ctx.fill();
      ctx.fillStyle = k.d; for (let i = 0; i < 9; i++) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x - w / 2 + (i + 0.5) * w / 9, y - h * (0.35 + 0.3 * ((i * 7) % 3) / 2), 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x - w / 2, y - h * 0.15, w, h * 0.15);
    } else if (k.style === 'cream') {
      ctx.fillStyle = k.c; ctx.beginPath(); ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w / 2, y - h * 0.7);
      for (let i = 0; i <= 8; i++) { const px = x - w / 2 + i * w / 8; ctx.quadraticCurveTo(px - w / 16, y - h * 1.15, px, y - h * 0.75); }
      ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = k.l; ctx.fillRect(x - w / 2 + 6, y - h * 0.62, w - 12, h * 0.16);
      // drips over the edge
      ctx.fillStyle = k.c; for (let i = 0; i < 5; i++) { const px = x - w / 2 + (i * 0.23 + 0.06) * w, dl = h * (0.4 + 0.5 * ((i * 3) % 4) / 3); PG.rrect(px, y - h * 0.2, w * 0.05, dl, w * 0.025); ctx.fill(); }
    } else { // jam
      const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, k.l); g.addColorStop(1, k.c);
      ctx.fillStyle = g; PG.rrect(x - w / 2, y - h, w, h, h * 0.4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - w * 0.25, y - h * 0.6, w * 0.12, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function topping(ctx, kind, x, y, w, h, t) {
    if (kind === 'cherry') {
      for (const dx of [-0.25, 0.25]) { const cx = x + dx * w, cy = y - h * 0.45; const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, h * 0.45); g.addColorStop(0, '#FF7A85'); g.addColorStop(1, '#C21E33'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, h * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4E8A2E'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.4); ctx.quadraticCurveTo(cx + 4, cy - h, cx + 8, cy - h * 1.05); ctx.stroke(); }
    } else if (kind === 'strawberry') {
      for (const dx of [-0.3, 0, 0.3]) { const cx = x + dx * w, cy = y - h * 0.4; ctx.fillStyle = '#E8384F'; ctx.beginPath(); ctx.moveTo(cx - h * 0.4, cy - h * 0.2); ctx.quadraticCurveTo(cx, cy + h * 0.7, cx + h * 0.4, cy - h * 0.2); ctx.quadraticCurveTo(cx, cy - h * 0.5, cx - h * 0.4, cy - h * 0.2); ctx.fill(); ctx.fillStyle = '#5FB34A'; ctx.fillRect(cx - h * 0.25, cy - h * 0.42, h * 0.5, h * 0.14); ctx.fillStyle = '#FFE08A'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - h * 0.15 + i * h * 0.12, cy, 1.5, 1.5); }
    } else { // candles
      [-0.25, 0, 0.25].forEach((dx, i) => { const cx = x + dx * w, cy = y; ctx.fillStyle = ['#7765EE', '#22B59B', '#F5B12E'][i]; ctx.fillRect(cx - 3, cy - h * 1.1, 6, h * 1.1); ctx.fillStyle = '#FFB13B'; ctx.beginPath(); ctx.ellipse(cx, cy - h * 1.25 + Math.sin(t * 12 + i) * 1, 3.2, 6, 0, 0, Math.PI * 2); ctx.fill(); });
    }
  }
  const layerH = (kind, base) => kind.startsWith('top:') ? base * 0.7 : KINDS[kind].h * base;
  PG.arcade.register({
    id: 'bakery',
    title: 'Пекарня',
    family: 'Ава',
    accent: ACCENT,
    howto: ['Обери внизу шар, який потрібен', 'Тапни, коли він їде над тортом'],
    boosts: [{ id: 'tries', icon: '💗', name: '+2 спроби', price: 2 }, { id: 'patient', icon: '⏳', name: 'Терплячі клієнти', price: 2 }],
    goal: lv => ({ count: Math.min(2 + Math.floor((lv - 1) / 2), 6), unit: 'тортів' }),
    twist: lv => ({ 1: 'Клієнт чекає: встигни зібрати торт', 2: 'Нове: начинки й м\'ята', 3: 'Нове: тарілка їздить', 4: 'Нове: шари чергуються', 5: 'Більше шарів і швидше' }[lv] || 'Швидше, клієнти нетерплячі'),
    icon(ctx, x, y, r) { layer(ctx, 'sponge', x, y + r * 0.6, r * 1.6, r * 0.6, 0); layer(ctx, 'cream', x, y, r * 1.6, r * 0.4, 0); topping(ctx, 'cherry', x, y - r * 0.35, r * 1.6, r * 0.5, 0); },
    create(level) {
      const nLayers = Math.min(5 + Math.floor((level - 1) / 2), 8);
      const speed = Math.min(0.68 + (level - 1) * 0.09, 1.4);
      const tol = Math.max(0.17 - (level - 1) * 0.014, 0.09); // max offset as a fraction of cake width before it falls
      const patience = Math.max(26 - (level - 1) * 2.5, 11); // seconds a customer waits for one cake
      const s = { t: 0, order: recipe(level, nLayers), cake: [], cur: null, slips: 0, falling: [], shelf: [], doneAt: -9, wobble: 0, beg: 0, hintAt: -9, wrongI: -1, wait: patience, plate: 0 };
      const inst = { progress: 0, over: null, stats: { level, slips: 0, perfect: 0 } };
      inst._s = s;
      function newShelf() {
        const need = s.order[s.cake.length];
        const all = BASES.concat(FILL).filter(k => level >= 3 || k !== 'choco').filter(k => level >= 2 || ['sponge', 'cream', 'jam'].includes(k));
        const opts = new Set([need]);
        while (opts.size < 4) opts.add(pick(all.concat(['top:cherry', 'top:strawberry', 'top:candles'])));
        s.shelf = shuffle([...opts]);
      }
      newShelf();
      const geo = A => {
        const cw = A.w * 0.5, base = A.h * 0.075;
        return { cw, base, cx: A.x + A.w / 2, plateY: A.y + A.h * 0.7, shelfY: A.y + A.h * 0.86, slideY: A.y + A.h * 0.3 };
      };
      function slip(A, msg) {
        s.slips++; inst.stats.slips++; PG.sfx.bad(); PG.buzz(PG.HAP.thud); PG.shake(4);
        PG.floatText(A.x + A.w / 2, A.y + A.h * 0.45, msg, '#27303F', 18);
        if (s.slips >= 3 + (s.extraTries || 0)) inst.over = { won: false, cause: 'slips' };
      }
      Object.assign(inst, {
        boost(id) { if (id === 'tries') s.extraTries = 2; if (id === 'patient') { s.patK = 1.5; s.wait *= 1.5; } },
        start() { s.skip = true; s.started = true; },
        tap(x, y) {
          const A = PG.arena, g = geo(A);
          if (s.skip) { s.skip = false; return; }
          if (s.doneAt > 0 && s.t - s.doneAt < 1.1) return;
          // shelf buttons
          if (y > g.shelfY - 34) {
            const i = clamp(Math.floor((x - A.x) / (A.w / 4)), 0, 3), kind = s.shelf[i];
            // a wrong pick only teaches: the right layer lights up, no slip
            if (kind !== s.order[s.cake.length]) { s.hintAt = s.t; s.wrongI = i; PG.sfx.bad(); PG.buzz(PG.HAP.double); return; }
            s.cur = { kind, x: 0, dir: 1, born: s.t }; PG.sfx.pick(); PG.buzz(PG.HAP.tick); return;
          }
          if (!s.cur) return;
          // drop the sliding layer
          const off = s.cur.x, kind = s.cur.kind; s.cur = null;
          if (Math.abs(off) > tol + 0.25) { s.falling.push({ kind, x: off, y: 0, vy: 0, rot: 0 }); slip(A, 'Мимо!'); return; }
          const prev = s.cake.length ? s.cake[s.cake.length - 1].x + s.plate : s.plate, x2 = clamp(off, prev - tol, prev + tol) - s.plate;
          if (Math.abs(off - prev) > tol) { s.falling.push({ kind, x: off, y: 0, vy: 0, rot: 0 }); slip(A, 'Впало!'); return; }
          const perfect = Math.abs(off - prev) < tol * 0.25;
          s.cake.push({ kind, x: perfect ? prev - s.plate : x2, at: s.t }); s.wobble = 1;
          PG.sfx.place(); PG.buzz(perfect ? PG.HAP.double : PG.HAP.light);
          if (perfect) { inst.stats.perfect++; PG.reward({ score: 20, x: g.cx, y: g.plateY - 60 }); PG.floatText(g.cx, g.plateY - 90, 'Рівненько!', ACCENT, 16); }
          else PG.reward({ score: 8 });
          if (s.cake.length === s.order.length) {
            inst.progress++; s.doneAt = s.t; PG.sfx.win(); PG.buzz(PG.HAP.success); PG.reward({ energy: 1, score: 50, x: g.cx, y: g.plateY - 120 });
            PG.burst(g.cx, g.plateY - 80, ACCENT, 24, 240);
          } else newShelf();
        },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt; s.wobble = Math.max(0, s.wobble - dt * 3);
          // the plate slides slowly from level 3, so a perfect drop has to be timed against it
          if (level >= 3 && !inst.over) s.plate = Math.sin(s.t * (0.6 + level * 0.06)) * Math.min(0.16, 0.05 + level * 0.02);
          // the customer's patience runs out: the order is lost (a slip) and a new one comes
          if (s.doneAt < 0 && !inst.over && s.started) { s.wait -= dt; if (s.wait <= 0) { const A = PG.arena; slip(A, 'Клієнт не дочекався!'); s.cake = []; s.cur = null; s.order = recipe(level, nLayers); newShelf(); s.wait = patience * (s.patK || 1); } }
          if (s.cur) { s.cur.x += s.cur.dir * speed * (1 + inst.progress * 0.05) * dt; if (Math.abs(s.cur.x) > 0.55) { s.cur.dir *= -1; s.cur.x = clamp(s.cur.x, -0.55, 0.55); } }
          s.falling.forEach(f => { f.vy += 1800 * dt; f.y += f.vy * dt; f.rot += dt * 3 * Math.sign(f.x || 1); });
          s.falling = s.falling.filter(f => f.y < 900);
          // next order after the finished cake has been admired
          if (s.doneAt > 0 && s.t - s.doneAt > 1.2 && !inst.over && inst.progress < Math.min(2 + Math.floor((level - 1) / 2), 6)) { s.doneAt = -9; s.cake = []; s.order = recipe(level, nLayers); newShelf(); s.wait = patience * (s.patK || 1); }
        },
        draw(ctx, A) {
          const g = geo(A);
          // bakery wall and counter
          const bg = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); bg.addColorStop(0, '#FFF1F5'); bg.addColorStop(1, '#FFD9E6');
          ctx.fillStyle = bg; ctx.fillRect(A.x, A.y, A.w, A.h);
          ctx.fillStyle = 'rgba(236,111,156,0.08)'; for (let i = 0; i < 12; i++) ctx.fillRect(A.x + i * A.w / 12, A.y, A.w / 24, A.h * 0.72);
          ctx.fillStyle = '#C98B5E'; ctx.fillRect(A.x, g.plateY + 8, A.w, A.h * 0.1); ctx.fillStyle = '#A9714A'; ctx.fillRect(A.x, g.plateY + 8, A.w, 6);
          txt(String(inst.progress), A.x + A.w / 2, A.y + A.h * 0.47, Math.min(90, A.w * 0.24), 'rgba(236,111,156,0.16)', { font: FD });
          // order card
          const ox = A.x + 12, oy = A.y + 12, ow = 104, oh = 132;
          ctx.fillStyle = '#FFFFFF'; PG.rrect(ox, oy, ow, oh, 14); ctx.fill(); ctx.strokeStyle = 'rgba(236,111,156,0.35)'; ctx.lineWidth = 2; ctx.stroke();
          txt('ЗАМОВЛЕННЯ', ox + ow / 2, oy + 13, 9, ACCENT, { font: FB, weight: 900 });
          let yy = oy + oh - 12; const mw = ow * 0.62, mb = 11;
          s.order.forEach((k, i) => { const h = layerH(k, mb * 1.4); ctx.globalAlpha = i < s.cake.length ? 0.35 : 1; layer(ctx, k, ox + ow / 2, yy, mw, h, s.t); ctx.globalAlpha = 1; if (i === s.cake.length) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.moveTo(ox + 8, yy - h / 2 - 4); ctx.lineTo(ox + 14, yy - h / 2); ctx.lineTo(ox + 8, yy - h / 2 + 4); ctx.fill(); } yy -= h + 1; });
          // Ava hoping for crumbs
          PG.ava.draw(ctx, A.x + A.w - 30, g.plateY + 6, A.w * 0.13, { pose: s.doneAt > 0 && s.t - s.doneAt < 1.2 ? 'hop' : 'idle', t: s.t, shadow: false });
          // plate and cake
          ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(g.cx + s.plate * g.cw, g.plateY + 4, g.cw * 0.68, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#E3D6DC'; ctx.stroke();
          // patience bar of the customer
          if (s.doneAt < 0 && !inst.over) { const k = Math.max(0, s.wait / (patience * (s.patK || 1))), bx = A.x + 120, bw = A.w - 140, by = A.y + 44; ctx.fillStyle = 'rgba(255,255,255,0.8)'; PG.rrect(bx, by, bw, 12, 6); ctx.fill(); ctx.fillStyle = k > 0.5 ? '#22B59B' : k > 0.25 ? '#F5B12E' : '#E5484D'; PG.rrect(bx, by, Math.max(8, bw * k), 12, 6); ctx.fill(); txt('терпіння клієнта', bx + bw / 2, by + 24, 10, '#8A5A6E', { font: FB, weight: 900 }); }
          let y = g.plateY;
          s.cake.forEach((l, i) => {
            const h = layerH(l.kind, g.base), sq = i === s.cake.length - 1 ? 1 - Math.sin(Math.min(1, (s.t - l.at) / 0.25) * Math.PI) * 0.12 : 1;
            const wob = Math.sin(s.t * 20) * s.wobble * 2 * (i / Math.max(1, s.cake.length));
            ctx.save(); ctx.translate(g.cx + (l.x + s.plate) * g.cw + wob, y); ctx.scale(1 / Math.sqrt(sq), sq); layer(ctx, l.kind, 0, 0, g.cw, h, s.t); ctx.restore();
            y -= h * (l.kind.startsWith('top:') ? 0 : 0.92);
          });
          // the sliding layer, with a drop guide
          if (s.cur) {
            const h = layerH(s.cur.kind, g.base), cx = g.cx + s.cur.x * g.cw;
            ctx.strokeStyle = 'rgba(236,111,156,0.35)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, g.slideY + 4); ctx.lineTo(cx, y - 4); ctx.stroke(); ctx.setLineDash([]);
            layer(ctx, s.cur.kind, cx, g.slideY, g.cw, h, s.t);
          }
          s.falling.forEach(f => { ctx.save(); ctx.translate(g.cx + f.x * g.cw, g.slideY + f.y); ctx.rotate(f.rot); layer(ctx, f.kind, 0, 0, g.cw, layerH(f.kind, g.base), s.t); ctx.restore(); });
          // shelf with four choices
          const bw = A.w / 4;
          for (let i = 0; i < 4; i++) {
            const k = s.shelf[i], bx = A.x + i * bw + 6, by = g.shelfY - 30, w = bw - 12, h = 62;
            const need = !s.cur && s.doneAt < 0 && k === s.order[s.cake.length] && (level <= 2 || s.t - s.hintAt < 3);
            const wrong = i === s.wrongI && s.t - s.hintAt < 0.4;
            const bob = need ? Math.sin(s.t * 6) * 3 : wrong ? Math.sin((s.t - s.hintAt) * 50) * 3 : 0;
            ctx.save(); ctx.translate(wrong ? bob : 0, need ? -Math.abs(bob) : 0);
            ctx.fillStyle = s.cur && s.cur.kind === k ? '#FFE3EE' : need ? '#FFF3F8' : '#FFFFFF'; PG.rrect(bx, by, w, h, 14); ctx.fill();
            ctx.strokeStyle = need ? rgba(ACCENT, 0.6 + 0.4 * Math.sin(s.t * 6)) : 'rgba(236,111,156,0.3)'; ctx.lineWidth = need ? 4 : 2; ctx.stroke();
            if (k) { layer(ctx, k, bx + w / 2, by + h * 0.62, w * 0.7, layerH(k, 20), s.t); txt(k.startsWith('top:') ? { cherry: 'вишні', strawberry: 'полуниці', candles: 'свічки' }[k.slice(4)] : KINDS[k].name, bx + w / 2, by + h - 9, 10, '#8A5A6E', { font: FB, weight: 900 }); }
            ctx.restore();
          }
          // slips
          for (let i = 0; i < 3 + (s.extraTries || 0); i++) { ctx.fillStyle = i < 3 + (s.extraTries || 0) - s.slips ? ACCENT : 'rgba(236,111,156,0.2)'; ctx.beginPath(); ctx.arc(A.x + A.w - 20 - i * 18, A.y + 20, 6, 0, Math.PI * 2); ctx.fill(); }
          if (!s.cur && s.doneAt < 0 && !inst.over) {
            const need = s.order[s.cake.length], nm = need.startsWith('top:') ? { cherry: 'вишні', strawberry: 'полуниці', candles: 'свічки' }[need.slice(4)] : KINDS[need].name;
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; PG.rrect(A.x + A.w / 2 - 92, g.slideY - 24, 184, 48, 24); ctx.fill();
            txt('Потрібно: ' + nm, A.x + A.w / 2, g.slideY - 4, 16, '#8A3A5E', { font: FD, max: 170 });
            txt('обери внизу ↓', A.x + A.w / 2, g.slideY + 14, 11, rgba('#8A5A6E', 0.6 + 0.4 * Math.sin(s.t * 5)), { font: FB, weight: 900 });
          } else if (s.cur && !inst.over) txt('Тапни, коли шар над тортом!', A.x + A.w / 2, g.slideY - 34, 13, rgba('#8A3A5E', 0.6 + 0.4 * Math.sin(s.t * 5)), { font: FB, weight: 900 });
        }
      });
      return inst;
    }
  });
})();

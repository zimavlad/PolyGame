// Прогулянка з Авою — a side-scrolling walk with the family dog. Tap to jump over puddles, bushes and cats, collect
// treats. Ava is shy: when another dog comes along, hold your finger and she creeps past low and quiet, just as she
// does in real life; bump into it and she barks and gets a fright. Three hearts; the treats are the goal.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, rand, randi, pick, txt, rgba } = PG;
  const ACCENT = '#F28A3C';
  const TREATS = ['biscuit', 'cookie', 'sausage', 'bone'];
  const DOGS = [
    { img: 'img/walk/dog_big.webp', h: 0.25, w: 0.3 },
    { img: 'img/walk/dog_pug.webp', h: 0.15, w: 0.22 },
    { img: 'img/walk/dog_dach.webp', h: 0.11, w: 0.27 }
  ];
  const tone = (f, d, type, v, delay, slide) => PG.tone && PG.tone(f, d, type, v, delay, slide);
  const bark = () => { tone(420, 0.09, 'square', 0.05, 0, 0.55); tone(380, 0.11, 'square', 0.05, 0.13, 0.5); };
  const woof = () => { tone(180, 0.16, 'sawtooth', 0.05, 0, 0.6); };

  function drawPuddle(ctx, x, y, w) {
    const h = w * 0.2;
    const g = ctx.createRadialGradient(x, y, 2, x, y, w * 0.55);
    g.addColorStop(0, '#9FD8F5'); g.addColorStop(0.7, '#5BB2E4'); g.addColorStop(1, 'rgba(70,150,210,0.85)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    const r = (PG.now * 0.6) % 1;
    ctx.globalAlpha = 1 - r; ctx.beginPath(); ctx.ellipse(x + w * 0.1, y, w * 0.12 + r * w * 0.2, h * 0.12 + r * h * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - w * 0.18, y - h * 0.12, w * 0.12, h * 0.1, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  function drawBush(ctx, x, y, w, h) {
    const blobs = [[-0.32, -0.38, 0.3], [0, -0.55, 0.36], [0.3, -0.4, 0.3], [-0.12, -0.2, 0.32], [0.18, -0.2, 0.3]];
    for (const [bx, by, br] of blobs) {
      const cx = x + bx * w, cy = y + by * h, r = br * w;
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#8BD45A'); g.addColorStop(0.7, '#4FA83A'); g.addColorStop(1, '#3A8A2E');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#F25C7A';
    [[-0.2, -0.55], [0.22, -0.6], [0.05, -0.3]].forEach(([bx, by]) => { ctx.beginPath(); ctx.arc(x + bx * w, y + by * h, w * 0.04, 0, Math.PI * 2); ctx.fill(); });
  }
  function heart(ctx, x, y, s, on) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-12, -2, -8, -12, 0, -6); ctx.bezierCurveTo(8, -12, 12, -2, 0, 6); ctx.closePath();
    ctx.fillStyle = on ? '#F2615E' : 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = on ? '#C94643' : 'rgba(39,48,63,0.25)'; ctx.stroke();
    ctx.restore();
  }

  PG.arcade.register({
    id: 'avawalk',
    title: 'Прогулянка з Авою',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/ava/jump.webp',
    howto: ['Добіжи до воріт. Тапни — Ава стрибне', 'Смаколики дають зірки. Собака? Тримай палець'],
    goal: lv => ({ count: Math.min(250 + (lv - 1) * 60, 700), unit: 'метрів' }),
    twist: lv => ({ 1: 'Розминка: калюжі й смаколики', 2: 'Нове: кущі й каміння', 3: 'Нове: інші собаки — тримай палець', 4: 'Нове: пляж і швидше', 5: 'Нове: кіт — стрибни двічі в повітрі', 6: 'Нове: подвійні калюжі' }[lv] || (lv % 2 ? 'Швидше на 8%' : 'Більше собак і котів')),
    icon(ctx, x, y, r) { if (!PG.ava.draw(ctx, x, y + r * 0.55, r * 1.3, { pose: 'run', t: PG.now, shadow: false })) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill(); } },
    create(level) {
      const L = level;
      const feat = { bush: L >= 2, dog: L >= 3, cat: L >= 5, double: L >= 6, dj: L >= 5 };
      const beach = L >= 4 && L % 2 === 0;
      const speed0 = Math.min(0.42 * Math.pow(1.1, L - 1), 0.95); // A.w per second
      const GY = 0.885, FX = 0.27;
      const s = {
        t: 0, scroll: 0, speed: speed0, y: 0, vy: 0, air: 0, jumps: 0, objs: [], gap: 0.9, hearts: 3, hurtT: -9, hurtUntil: 0,
        creep: false, holdAt: -1, started: false, fx: [], barkAt: -9, combo: 0, treats: 0, seen: 0, magnetUntil: 0, slowUntil: 0, spawns: 0
      };
      const goalM = Math.min(250 + (L - 1) * 60, 700), M_PER_W = 25; // metres per arena width of path
      const inst = { progress: 0, over: null, stats: { level: L, jumps: 0, hits: 0, dogs: 0, sneaks: 0 } };
      inst._s = s; // for automated checks
      function spawn() {
        const r = Math.random();
        const x = 1.25;
        // the finish gate is near: keep the last stretch clear
        if (goalM - s.scroll * M_PER_W < 40) { s.gap = 0.5; return; }
        // power-ups now and then: a golden bone pulls treats in, a heart when one is lost
        if (++s.spawns % 7 === 0) { s.objs.push({ type: s.hearts < 3 && L >= 2 && Math.random() < 0.5 ? 'heart' : 'magnet', x, alt: 0.22, w: 0.06 }); s.gap = 0.45; return; }
        const dogNear = s.objs.some(o => o.type === 'dog');
        const clearAhead = !s.objs.some(o => o.type !== 'treat' && o.x > FX - 0.15);
        if (feat.dog && !dogNear && r < 0.22 + Math.min(0.1, L * 0.01)) {
          if (!clearAhead) { s.gap = 0.25; return; } // a dog only comes along on a clear stretch, so a tap there always means "sneak"
          const d = pick(DOGS);
          s.objs.push({ type: 'dog', x, w: d.w, h: d.h, img: d.img, walk: 0.1 + Math.random() * 0.05, passed: false });
          s.gap = 1.15; return;
        }
        if (feat.cat && r < 0.36) { s.objs.push({ type: 'cat', x, w: 0.14, h: 0.15 }); s.objs.push({ type: 'treat', x: x + 0.02, alt: 0.42, k: pick(TREATS) }); s.gap = 0.8; return; }
        if (feat.bush && r < 0.55) { s.objs.push({ type: 'bush', x, w: 0.14, h: 0.12, stone: Math.random() < 0.4 }); s.objs.push({ type: 'treat', x: x, alt: 0.24, k: pick(TREATS) }); s.gap = rand(0.6, 0.9); return; }
        if (r < 0.86) {
          const n = feat.double && Math.random() < 0.4 ? 2 : 1;
          for (let i = 0; i < n; i++) s.objs.push({ type: 'puddle', x: x + i * 0.2, w: 0.15 });
          s.objs.push({ type: 'treat', x: x + (n - 1) * 0.1, alt: 0.2, k: pick(TREATS) });
          s.gap = rand(0.55, 0.85) + (n - 1) * 0.2; return;
        }
        // now and then a short trail of treats on the ground
        for (let i = 0; i < 2; i++) s.objs.push({ type: 'treat', x: x + i * 0.12, alt: 0.03, k: pick(TREATS) });
        s.gap = 0.7;
      }
      function dogAhead() { return s.objs.find(o => o.type === 'dog' && !o.passed && o.x - FX < 0.8 && o.x + o.w > FX - 0.12); }
      function jump() {
        if (s.y > 0.001 && s.y < 0.07 && s.vy < 0 && !(feat.dj && s.jumps < 2)) { s.buffer = s.t; return; } // tapped just before landing: jump on touchdown
        if (s.y <= 0.001) { s.vy = 1.7; s.jumps = 1; }
        else if (feat.dj && s.jumps < 2) { s.vy = 1.45; s.jumps = 2; }
        else return;
        inst.stats.jumps++;
        PG.sfx.whoosh(); PG.buzz(PG.HAP.light);
      }
      function hurt(cause, A) {
        if (s.t < s.hurtUntil) return;
        s.hearts--; s.hurtT = s.t; s.hurtUntil = s.t + 1.3; inst.stats.hits++; s.combo = 0;
        PG.sfx.hit(); PG.buzz(PG.HAP.thud); PG.shake(5);
        const ax = A.x + FX * A.w, ay = A.y + GY * A.h;
        PG.floatText(ax, ay - A.h * 0.25, cause === 'dog' ? 'Гав! Гав!' : cause === 'cat' ? 'Шшш!' : cause === 'puddle' ? 'Хлюп!' : 'Ой!', '#27303F', 20);
        if (cause === 'puddle') PG.burst(ax, ay, '#5BB2E4', 14, 200);
        if (cause === 'dog') { bark(); setTimeout(woof, 220); }
        if (s.hearts <= 0) inst.over = { won: false, cause };
      }
      Object.assign(inst, {
        start() { s.started = true; },
        tap(x, y) {
          s.holdAt = s.t;
          if (dogAhead()) { s.creep = true; return; }
          jump();
        },
        up() { s.creep = false; s.holdAt = -1; },
        idle(dt) { s.t += dt; s.scroll += dt * 0.08; },
        update(dt, A) {
          s.t += dt;
          if (inst.over && !inst.over.won) { s.y = Math.max(0, s.y + s.vy * dt); s.vy -= 4.2 * dt; return; }
          const sp = s.speed * (s.creep ? 0.45 : 1) * (inst.over ? 0.4 : 1) * (s.t < s.slowUntil ? 0.55 : 1);
          if (s.started) s.scroll += sp * dt;
          inst.progress = Math.min(goalM, Math.floor(s.scroll * M_PER_W));
          s.speed = speed0 * (1 + Math.min(0.3, inst.progress / goalM * 0.3));
          // the golden bone pulls treats ahead of her in
          if (s.t < s.magnetUntil) for (const o of s.objs) if (o.type === 'treat' && !o.got && o.x > FX - 0.05 && o.x < FX + 0.55) { o.x = lerp(o.x, FX + 0.02, Math.min(1, dt * 5)); o.alt = lerp(o.alt, s.y + 0.06, Math.min(1, dt * 5)); }
          // physics (heights in A.h units)
          if (s.y > 0 || s.vy > 0) { s.vy -= 4.0 * dt; s.y += s.vy * dt; if (s.y <= 0) { s.y = 0; s.vy = 0; s.jumps = 0; s.landAt = s.t; if (s.t - (s.buffer || -9) < 0.18) { s.buffer = -9; jump(); } PG.burst(A.x + FX * A.w, A.y + GY * A.h, 'rgba(210,190,160,0.9)', 7, 90); } }
          // little dust puffs from her paws while she runs
          if (s.y <= 0 && !s.creep && s.started && Math.random() < dt * 6) s.fx.push({ x: FX - 0.06, y: 0, t: 0, r: 2 + Math.random() * 3 });
          s.fx.forEach(f => { f.t += dt; f.x -= sp * dt * 0.8; f.y += dt * 0.03; }); s.fx = s.fx.filter(f => f.t < 0.6);
          if (s.creep && !dogAhead()) { if (s.holdAt < 0) s.creep = false; }
          // spawning
          s.gap -= sp * dt;
          if (s.gap <= 0 && !inst.over) spawn();
          const ax = A.x + FX * A.w, ay = A.y + GY * A.h;
          const crouch = s.creep && s.y <= 0;
          for (const o of s.objs) {
            o.x -= sp * dt + (o.type === 'dog' ? o.walk * dt : 0);
            // treats use a generous box; obstacles a forgiving one (Ava's body core, 75% of the obstacle)
            const left = o.type === 'treat' ? FX - 0.09 : FX - 0.035, right = o.type === 'treat' ? FX + 0.11 : FX + 0.045;
            const hw = (o.w || 0.06) / 2 * (o.type === 'treat' ? 1 : o.type === 'dog' ? 0.7 : 0.6);
            const ox0 = o.x - hw, ox1 = o.x + hw;
            const overlap = ox1 > left && ox0 < right;
            if (o.type === 'treat' && !o.got) {
              const ty = o.alt + Math.sin(s.t * 4 + o.x * 9) * 0.01;
              if (overlap && Math.abs(ty - (s.y + 0.06)) < 0.11) {
                o.got = true; s.treats++; s.combo++;
                const px = A.x + o.x * A.w, py = A.y + (GY - ty) * A.h;
                PG.reward({ score: 10 + Math.min(s.combo, 10), x: px, y: py });
                if (s.combo > 0 && s.combo % 5 === 0) { PG.reward({ energy: 1, x: px, y: py - 20 }); PG.floatText(px, py - 40, 'Смакота ×' + s.combo, ACCENT, 18); }
                PG.sfx.candy(); PG.buzz(PG.HAP.tick); PG.burst(px, py, '#F5B12E', 8, 140);
              }
            } else if ((o.type === 'magnet' || o.type === 'heart') && !o.got && overlap && Math.abs(o.alt - (s.y + 0.06)) < 0.12) {
              o.got = true; const px = A.x + o.x * A.w, py = A.y + (GY - o.alt) * A.h;
              if (o.type === 'magnet') { s.magnetUntil = s.t + 6; PG.floatText(px, py - 30, 'Магніт!', '#F5B12E', 20); }
              else { s.hearts = Math.min(3, s.hearts + 1); PG.floatText(px, py - 30, '+1 ♥', '#F2615E', 20); }
              PG.sfx.loop(); PG.burst(px, py, o.type === 'magnet' ? '#F5B12E' : '#F2615E', 16, 180);
            } else if (o.type === 'puddle' && overlap && s.y < 0.02 && !o.hit) {
              o.hit = true;
              if (L <= 2) { s.slowUntil = s.t + 0.7; s.combo = 0; PG.floatText(ax, ay - A.h * 0.25, 'Хлюп!', '#3E9BF0', 20); PG.burst(ax, ay, '#5BB2E4', 14, 200); PG.sfx.back(); }
              else hurt('puddle', A);
            }
            else if ((o.type === 'bush' || o.type === 'cat') && overlap && s.y < o.h * 0.7 && !o.hit) { o.hit = true; hurt(o.type, A); }
            else if (o.type === 'dog') {
              if (overlap && !o.hit && !crouch) { o.hit = true; inst.stats.dogs++; hurt('dog', A); }
              if (!o.passed && ox1 < left) {
                o.passed = true;
                if (!o.hit) { inst.stats.sneaks++; PG.reward({ score: 30, energy: 1, x: ax, y: ay - A.h * 0.2 }); PG.floatText(ax, ay - A.h * 0.3, 'Тихенько!', '#22B59B', 20); PG.buzz(PG.HAP.success); PG.sfx.coin(); }
              }
            }
          }
          for (const o of s.objs) if (o.type === 'treat' && !o.counted && o.x < FX) { o.counted = true; s.seen++; }
          s.objs = s.objs.filter(o => o.x > -0.5 && !(o.got && o.type !== 'dog'));
        },
        win() {
          s.objs = s.objs.filter(o => o.type === 'treat');
          const share = s.treats / Math.max(1, s.seen + s.objs.filter(o => o.type === 'treat').length);
          inst.stars = share >= 0.85 && s.hearts === 3 ? 3 : share >= 0.55 ? 2 : 1;
          inst.stats.treats = s.treats; inst.stats.stars = inst.stars;
        },
        draw(ctx, A) {
          // background: seamless panorama scaled to the arena height, scrolling at 60% for depth
          const bg = PG.sprite(beach ? 'img/walk/bg_beach.webp' : 'img/walk/bg_park.webp');
          if (bg) {
            const bh = A.h, bw = bg.naturalWidth * bh / bg.naturalHeight;
            let off = -((s.scroll * A.w * 0.6) % bw);
            for (let x = A.x + off; x < A.x + A.w; x += bw) ctx.drawImage(bg, x, A.y, bw + 1, bh);
          } else { ctx.fillStyle = '#BFE3F7'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          const ax = A.x + FX * A.w, gy = A.y + GY * A.h;
          // the big counter in the sky, Ketchapp style
          // the treat counter in the sky and the metres left
          PG.drawSprite(ctx, 'img/treats/biscuit.webp', A.x + A.w / 2 - 44, A.y + A.h * 0.2, 36, { rot: -0.3 });
          txt(String(s.treats), A.x + A.w / 2 + 14, A.y + A.h * 0.2, Math.min(70, A.w * 0.19), 'rgba(255,255,255,0.85)', { font: FD });
          txt(`ще ${Math.max(0, goalM - inst.progress)} м`, A.x + A.w - 50, A.y + 24, 13, 'rgba(39,48,63,0.7)', { font: FB, weight: 900 });
          if (s.t < s.magnetUntil) { const k = (s.magnetUntil - s.t) / 6; ctx.strokeStyle = 'rgba(245,177,46,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(A.x + A.w - 30, A.y + 54, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); PG.ava.bone(ctx, A.x + A.w - 30, A.y + 54, 14, -0.4, '#F5B12E'); }
          // the finish gate, once it is on screen
          const gateX = A.x + (FX + goalM / M_PER_W - s.scroll) * A.w;
          if (gateX < A.x + A.w + 60) {
            ctx.fillStyle = '#8E5E37'; ctx.fillRect(gateX - 4, gy - A.h * 0.42, 8, A.h * 0.42); ctx.fillRect(gateX + 56, gy - A.h * 0.42, 8, A.h * 0.42);
            for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#27303F' : '#FFFFFF'; ctx.fillRect(gateX - 4 + i * 8.5, gy - A.h * 0.42, 8.5, 16); ctx.fillStyle = i % 2 ? '#FFFFFF' : '#27303F'; ctx.fillRect(gateX - 4 + i * 8.5, gy - A.h * 0.42 + 16, 8.5, 16); }
            txt('ФІНІШ', gateX + 30, gy - A.h * 0.42 - 14, 14, '#27303F', { font: FD });
          }
          // objects behind Ava
          const lift = s.y * A.h;
          for (const o of s.objs) {
            const ox = A.x + o.x * A.w;
            if (o.type === 'puddle') { if (!PG.drawSprite(ctx, 'img/walk/puddle.webp', ox, gy + 4, o.w * A.w * 1.5 * 89 / 400, { ay: 0.55 })) drawPuddle(ctx, ox, gy + 2, o.w * A.w); }
            else if (o.type === 'bush') { const im = o.stone ? 'img/walk/stone.webp' : 'img/walk/bush.webp'; if (!PG.drawSprite(ctx, im, ox, gy + 6, o.h * A.h * 1.45, { ay: 1 })) drawBush(ctx, ox, gy + 4, o.w * A.w, o.h * A.h * 1.6); }
            else if (o.type === 'cat') PG.drawSprite(ctx, 'img/walk/cat.webp', ox, gy + 3, o.h * A.h * 1.25, { ay: 1 });
            else if (o.type === 'dog') {
              const bob = Math.abs(Math.sin(s.t * 7)) * 2;
              ctx.fillStyle = 'rgba(39,48,63,0.14)'; ctx.beginPath(); ctx.ellipse(ox, gy + 2, o.w * A.w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();
              PG.drawSprite(ctx, o.img, ox, gy + 3 - bob, o.h * A.h * 1.35, { ay: 1 });
              if (!o.passed && !o.hit && o.x - FX < 0.8 && o.x - FX > 0.05) {
                const p = 0.6 + 0.4 * Math.sin(s.t * 8);
                ctx.fillStyle = rgba('#27303F', 0.78); PG.rrect(A.x + A.w / 2 - 86, A.y + A.h * 0.34, 172, 34, 17); ctx.fill();
                txt(s.creep ? 'Тихенько…' : 'Тримай палець!', A.x + A.w / 2, A.y + A.h * 0.34 + 17, 15, rgba('#FFFFFF', s.creep ? 1 : p), { font: FB, weight: 900 });
              }
            } else if (o.type === 'magnet' || o.type === 'heart') {
              const ty = gy - (o.alt + Math.sin(s.t * 5 + o.x * 9) * 0.015) * A.h, pulse = 1 + Math.sin(s.t * 8) * 0.08;
              ctx.fillStyle = o.type === 'magnet' ? 'rgba(245,177,46,0.35)' : 'rgba(242,97,94,0.3)'; ctx.beginPath(); ctx.arc(ox, ty, A.w * 0.065 * pulse, 0, Math.PI * 2); ctx.fill();
              if (o.type === 'magnet') PG.ava.bone(ctx, ox, ty, A.w * 0.09, Math.sin(s.t * 3) * 0.3, '#F5B12E'); else heart(ctx, ox, ty, A.w * 0.075, true);
            } else if (o.type === 'treat') {
              const ty = gy - (o.alt + Math.sin(s.t * 4 + o.x * 9) * 0.01) * A.h;
              ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.beginPath(); ctx.arc(ox, ty, A.w * 0.05, 0, Math.PI * 2); ctx.fill();
              PG.drawSprite(ctx, 'img/treats/' + o.k + '.webp', ox, ty, A.w * 0.075, { rot: Math.sin(s.t * 3 + o.x * 5) * 0.2 });
            }
          }
          // Ava
          const hurting = s.t - s.hurtT < 0.7;
          const blink = s.t < s.hurtUntil && !hurting && Math.floor(s.t * 12) % 2 === 0;
          let pose = 'run';
          if (!s.started) pose = 'stand';
          else if (inst.over && inst.over.won) pose = 'hop';
          else if (hurting || (inst.over && !inst.over.won)) pose = 'scared';
          else if (s.creep && s.y <= 0) pose = 'stalk';
          s.fx.forEach(f => { ctx.fillStyle = `rgba(214,196,168,${0.55 * (1 - f.t / 0.6)})`; ctx.beginPath(); ctx.arc(A.x + f.x * A.w, gy - f.y * A.h - 2, f.r + f.t * 10, 0, Math.PI * 2); ctx.fill(); });
          // in the air she keeps her stretched gallop frame; on landing a quick squash
          if (pose === 'run' && s.y > 0.01) pose = s.vy > 0 ? 'leapUp' : 'leapDown';
          const land = s.landAt != null ? Math.min(1, (s.t - s.landAt) / 0.18) : 1, sq = 1 - Math.sin(land * Math.PI) * 0.1;
          if (!blink) { ctx.save(); ctx.translate(ax, gy - lift); ctx.scale(1 / Math.sqrt(sq), sq); ctx.rotate(s.y > 0.01 ? -s.vy * 0.06 : 0); PG.ava.draw(ctx, 0, 0, A.w * 0.235, { pose, t: s.t }); ctx.restore(); }
          // hearts
          for (let i = 0; i < 3; i++) heart(ctx, A.x + 22 + i * 26, A.y + 24, 22, i < s.hearts);
        }
      });
      return inst;
    }
  });
})();

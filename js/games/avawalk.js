// Прогулянка з Авою — a runner through the park and along the beach to the finish gate.
// Controls: tap = jump (a second tap in the air from level 3), swipe down = duck under a low branch or a gull
// (in the air it drops her straight down), hold when another dog comes = sneak past (Ava is shy, she creeps low).
// Fun on the way: pigeons that burst up as she runs through, ZOOMIES (fast, unstoppable, everything pulled in),
// a squirrel to chase by tapping fast, a ball thrown by Polina to catch in a jump, a golden-bone magnet, hearts,
// a combo multiplier for treats in a row. Stars come from the share of treats collected and the hearts kept.
(function () {
  const PG = window.PG;
  const { FD, FB, lerp, rand, randi, pick, txt, rgba } = PG;
  const ACCENT = '#F28A3C';
  const TREATS = ['biscuit', 'cookie', 'sausage', 'bone'];
  const DOGS = [
    { img: 'img/walk/dog_big.webp', h: 0.25, w: 0.3 },
    { img: 'img/walk/dog_pug.webp', h: 0.15, w: 0.22 },
    { img: 'img/walk/dog_dach.webp', h: 0.11, w: 0.27 }
  ];
  const tone = (f, d, type, v, delay, slide) => PG.tone && PG.tone(f, d, type, v, delay, slide);
  const bark = () => { tone(420, 0.09, 'square', 0.05, 0, 0.55); tone(380, 0.11, 'square', 0.05, 0.13, 0.5); };
  const woof = () => tone(180, 0.16, 'sawtooth', 0.05, 0, 0.6);
  const flutter = () => { for (let i = 0; i < 4; i++) tone(900 + i * 140, 0.03, 'triangle', 0.025, i * 0.035); };
  function heart(ctx, x, y, s, on) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-12, -2, -8, -12, 0, -6); ctx.bezierCurveTo(8, -12, 12, -2, 0, 6); ctx.closePath();
    ctx.fillStyle = on ? '#F2615E' : 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = on ? '#C94643' : 'rgba(39,48,63,0.25)'; ctx.stroke();
    ctx.restore();
  }
  const spec = L => ({
    goal: Math.min(300 + (L - 1) * 60, 800),
    speed: Math.min(0.44 * Math.pow(1.08, L - 1), 0.9),
    bush: L >= 2, branch: L >= 2, dog: L >= 3, dj: L >= 3, gull: L >= 4, cat: L >= 5, doubleP: L >= 6,
    beach: L >= 4 && L % 2 === 0, softPuddles: L <= 2, dense: Math.min(1.45, 1 + (L - 1) * 0.06) // gaps shrink with level
  });

  PG.arcade.register({
    id: 'avawalk',
    title: 'Прогулянка з Авою',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/ava/jump.webp',
    howto: ['Тап — стрибок. Проведи вниз — Ава пригнеться', 'Інша собака? Тримай палець, Ава підкрадеться'],
    boosts: [{ id: 'heart', icon: '❤️', name: '+1 серце', price: 2 }, { id: 'zoom', icon: '🌈', name: 'Зумі на старті', price: 3 }],
    goal: lv => ({ count: spec(lv).goal, unit: 'метрів' }),
    twist: lv => ({ 1: 'Голуби, калюжі й смаколики', 2: 'Нове: гілки. Проведи пальцем униз', 3: 'Нове: собаки й подвійний стрибок', 4: 'Нове: пляж і чайки', 5: 'Нове: коти на доріжці', 6: 'Подвійні калюжі, ще швидше' }[lv] || 'Швидше й довше'),
    icon(ctx, x, y, r) { if (!PG.ava.draw(ctx, x, y + r * 0.55, r * 1.3, { pose: 'run', t: PG.now, shadow: false })) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill(); } },
    create(level) {
      const L = level, F = spec(L);
      const GY = 0.885, FX = 0.27, MPW = 25; // ground line, Ava's x, metres per arena width
      const SZ = 0.235; // Ava's body length as a share of the arena width; branch and gull heights are in these units
      const s = {
        t: 0, scroll: 0, speed: F.speed, y: 0, vy: 0, jumps: 0, objs: [], gap: 1.0, hearts: 3, maxHearts: 3, hurtT: -9, hurtUntil: 0,
        creep: false, down: null, pending: null, duckUntil: 0, started: false, fx: [], combo: 0, best: 0, treats: 0, seen: 0,
        magnetUntil: 0, zoomUntil: 0, slowUntil: 0, spawns: 0, chase: null, ball: null, banner: null, tutBranch: true, events: 0, buffer: -9
      };
      const inst = { progress: 0, over: null, stats: { level: L, jumps: 0, ducks: 0, hits: 0, sneaks: 0, squirrels: 0, balls: 0, zooms: 0 } };
      inst._s = s; // for automated checks
      const zoom = () => s.t < s.zoomUntil;
      const say = (text, col) => { s.banner = { text, col: col || '#27303F', t: s.t }; };
      function spawn() {
        const x = 1.25, r = Math.random();
        if (F.goal - s.scroll * MPW < 45) { s.gap = 0.5; return; } // keep the last stretch before the gate clear
        s.spawns++;
        const clearAhead = !s.objs.some(o => ['puddle', 'bush', 'cat', 'dog', 'branch', 'gull'].includes(o.type) && o.x > FX - 0.15);
        // a set piece every 6th spawn, in turn: squirrel chase, zoomies, Polina's ball
        if (s.spawns % 6 === 0) {
          if (!clearAhead) { s.spawns--; s.gap = 0.25; return; }
          const ev = s.events++ % 3;
          if (ev === 0) { s.chase = { x: FX + 0.44, t: 0, power: 0, done: false }; say('Білка! Тапай швидко-швидко!', '#C0581E'); PG.buzz(PG.HAP.double); return; }
          if (ev === 2) { s.ball = { x: -0.06, y: 0.5, vx: 0.3, vy: 0.15, t: 0 }; say('Поліна кидає м\'ячик! Стрибай!', '#1E9E86'); s.gap = 1.0; return; }
          s.objs.push({ type: 'zoom', x, alt: 0.2, w: 0.07 }); s.gap = 0.5; return;
        }
        if (s.spawns % 7 === 0) { s.objs.push({ type: s.hearts < s.maxHearts && L >= 2 && Math.random() < 0.5 ? 'heart' : 'magnet', x, alt: 0.2, w: 0.06 }); s.gap = 0.45; return; }
        if (F.dog && r < 0.14) {
          if (!clearAhead) { s.gap = 0.25; return; } // a dog only comes on a clear stretch, so holding there always means "sneak"
          const d = pick(DOGS); s.objs.push({ type: 'dog', x, w: d.w, h: d.h, img: d.img, walk: 0.1 + Math.random() * 0.05 }); s.gap = 1.15; return;
        }
        if (r < (L >= 4 ? 0.2 : 0.27)) { // a flock of pigeons on the path: harmless, they burst up as she runs through
          const n = 3 + randi(3); for (let i = 0; i < n; i++) s.objs.push({ type: 'pigeon', x: x + i * 0.07 + rand(0, 0.03), w: 0.06, ph: rand(0, 6), alt: 0 });
          s.objs.push({ type: 'treat', x: x + 0.12, alt: 0.03, k: pick(TREATS) }); s.gap = 0.75; return;
        }
        if (F.branch && r < 0.41) { s.objs.push({ type: 'branch', x: x + 0.1, w: 0.5 }); s.objs.push({ type: 'treat', x: x + 0.1, alt: 0.03, k: pick(TREATS) }); s.gap = 0.95; return; }
        if (F.gull && r < 0.5) { s.objs.push({ type: 'gull', x: x + 0.1, w: 0.12 }); s.gap = 0.85; return; }
        if (F.cat && r < 0.58) { s.objs.push({ type: 'cat', x, w: 0.14, h: 0.15 }); s.objs.push({ type: 'treat', x: x + 0.02, alt: 0.42, k: pick(TREATS) }); s.gap = 0.8; return; }
        if (F.bush && r < 0.72) { s.objs.push({ type: 'bush', x, w: 0.14, h: 0.12, stone: Math.random() < 0.4 }); s.objs.push({ type: 'treat', x, alt: 0.26, k: pick(TREATS) }); s.gap = rand(0.6, 0.9); return; }
        if (r < 0.9) {
          const n = F.doubleP && Math.random() < 0.4 ? 2 : 1;
          for (let i = 0; i < n; i++) s.objs.push({ type: 'puddle', x: x + i * 0.2, w: 0.15 });
          s.objs.push({ type: 'treat', x: x + (n - 1) * 0.1, alt: 0.2, k: pick(TREATS) });
          s.gap = rand(0.55, 0.85) + (n - 1) * 0.2; return;
        }
        for (let i = 0; i < 4; i++) s.objs.push({ type: 'treat', x: x + i * 0.09, alt: 0.03 + Math.sin(i / 3 * Math.PI) * 0.18, k: pick(TREATS) }); // a little arc of treats
        s.gap = 0.75;
      }
      const dogAhead = () => s.objs.find(o => o.type === 'dog' && !o.passed && o.x - FX < 0.8 && o.x + o.w > FX - 0.12);
      function jump() {
        if (s.chase && !s.chase.done) return;
        if (s.y > 0.001 && s.y < 0.07 && s.vy < 0 && !(F.dj && s.jumps < 2)) { s.buffer = s.t; return; } // tapped just before landing: jump on touchdown
        if (s.y <= 0.001) { s.vy = 1.7; s.jumps = 1; s.duckUntil = 0; }
        else if (F.dj && s.jumps < 2) { s.vy = 1.45; s.jumps = 2; }
        else return;
        inst.stats.jumps++; PG.sfx.whoosh(); PG.buzz(PG.HAP.light);
      }
      function duck() {
        if (s.chase && !s.chase.done) return;
        if (s.y > 0.01) s.vy = Math.min(s.vy, -3.2); // in the air: drop straight down, then stay low
        s.duckUntil = s.t + 0.8; inst.stats.ducks++; PG.sfx.back(); PG.buzz(PG.HAP.tick);
      }
      function hurt(cause, A) {
        if (s.t < s.hurtUntil || zoom()) return;
        s.hearts--; s.hurtT = s.t; s.hurtUntil = s.t + 1.3; inst.stats.hits++; s.combo = 0;
        PG.sfx.hit(); PG.buzz(PG.HAP.thud); PG.shake(5);
        const ax = A.x + FX * A.w, ay = A.y + GY * A.h;
        PG.floatText(ax, ay - A.h * 0.25, { dog: 'Гав! Гав!', cat: 'Шшш!', puddle: 'Хлюп!', branch: 'Бум!', gull: 'Ой, чайка!' }[cause] || 'Ой!', '#27303F', 20);
        if (cause === 'puddle') PG.burst(ax, ay, '#5BB2E4', 14, 200);
        if (cause === 'branch') PG.burst(ax, ay - A.w * SZ, '#5FAE3E', 12, 160);
        if (cause === 'dog') { bark(); setTimeout(woof, 220); }
        if (s.hearts <= 0) inst.over = { won: false, cause };
      }
      function collect(o, px, py) {
        o.got = true; s.treats++; s.combo++; s.best = Math.max(s.best, s.combo);
        const mult = 1 + Math.floor(s.combo / 5);
        PG.reward({ score: 10 * mult, x: px, y: py });
        if (s.combo % 5 === 0) { PG.reward({ energy: 1 }); PG.floatText(px, py - 36, `Комбо ×${mult}!`, ACCENT, 18); PG.buzz(PG.HAP.double); }
        PG.sfx.candy(); PG.buzz(PG.HAP.tick); PG.burst(px, py, '#F5B12E', 8, 140);
      }
      Object.assign(inst, {
        boost(id) { if (id === 'heart') { s.hearts++; s.maxHearts = 4; } if (id === 'zoom') s.zoomStart = true; },
        start() { s.started = true; if (s.zoomStart) { s.zoomUntil = s.t + 4; say('ЗУМІ!', '#7765EE'); } },
        tap(x, y) {
          s.down = { x, y, t: s.t };
          if (s.chase && !s.chase.done) { // every tap pushes Ava on
            const c = s.chase; c.power = Math.min(10, c.power + 1); c.taps = (c.taps || 0) + 1;
            PG.buzz(PG.HAP.tick); tone(500 + c.power * 40, 0.04, 'triangle', 0.04); return;
          }
          if (dogAhead()) { s.creep = true; return; }
          s.pending = s.t; // jump in a moment, unless this turns into a swipe down
        },
        move(x, y) {
          if (!s.down || s.down.swiped) return;
          if (y - s.down.y > 20) { s.down.swiped = true; s.pending = null; duck(); }
        },
        up() { if (s.pending != null) { s.pending = null; jump(); } s.creep = false; s.down = null; },
        idle(dt) { s.t += dt; s.scroll += dt * 0.08; },
        update(dt, A) {
          s.t += dt;
          if (s.pending != null && s.t - s.pending > 0.09) { s.pending = null; jump(); }
          if (inst.over && !inst.over.won) { s.y = Math.max(0, s.y + s.vy * dt); s.vy -= 4.2 * dt; return; }
          let mul = (s.creep ? 0.45 : 1) * (s.t < s.slowUntil ? 0.55 : 1) * (zoom() ? 1.6 : 1) * (inst.over ? 0.4 : 1);
          if (s.chase && !s.chase.done) mul *= 1 + Math.min(1, s.chase.power / 8) * 0.5;
          const sp = s.speed * mul;
          if (s.started) s.scroll += sp * dt;
          inst.progress = Math.min(F.goal, Math.floor(s.scroll * MPW));
          s.speed = F.speed * (1 + Math.min(0.3, inst.progress / F.goal * 0.3));
          // physics (heights in arena heights)
          if (s.y > 0 || s.vy > 0) {
            s.vy -= 4.0 * dt; s.y += s.vy * dt;
            if (s.y <= 0) { s.y = 0; s.vy = 0; s.jumps = 0; s.landAt = s.t; if (s.t - s.buffer < 0.18) { s.buffer = -9; jump(); } PG.burst(A.x + FX * A.w, A.y + GY * A.h, 'rgba(210,190,160,0.9)', 7, 90); }
          }
          if (s.y <= 0 && !s.creep && s.started && Math.random() < dt * (zoom() ? 24 : 6)) s.fx.push({ x: FX - 0.06, y: 0, t: 0, r: 2 + Math.random() * 3, rb: zoom() });
          s.fx.forEach(f => { f.t += dt; f.x -= sp * dt * 0.8; f.y += dt * 0.03; }); s.fx = s.fx.filter(f => f.t < 0.6);
          if (s.creep && !dogAhead() && !s.down) s.creep = false;
          if (s.t < s.magnetUntil || zoom()) for (const o of s.objs) if (o.type === 'treat' && !o.got && o.x > FX - 0.05 && o.x < FX + 0.55) { o.x = lerp(o.x, FX + 0.02, Math.min(1, dt * 5)); o.alt = lerp(o.alt, s.y + 0.06, Math.min(1, dt * 5)); }
          const ax = A.x + FX * A.w, ay = A.y + GY * A.h;
          // the squirrel chase: tap fast to catch it before it gets up a tree
          if (s.chase) {
            const c = s.chase; c.t += dt;
            if (!c.done) {
              c.x = Math.min(1.0, c.x + (0.1 - Math.min(1, c.power / 8) * 0.35) * dt); // tapping closes the gap
              c.power = Math.max(0, c.power - dt * 1.5);
              if (c.x <= FX + 0.09) {
                c.done = 'caught'; inst.stats.squirrels++; PG.reward({ score: 120, energy: 1, x: ax, y: ay - A.h * 0.3 });
                say('Наздогнала білку! +120', '#1E9E86'); PG.sfx.win(); PG.buzz(PG.HAP.success);
                for (let i = 0; i < 6; i++) s.objs.push({ type: 'treat', x: FX + 0.25 + i * 0.07, alt: 0.03 + i * 0.015, k: pick(TREATS) });
              } else if (c.t > 6) { c.done = 'away'; say('Втекла на дерево…', '#8A5A2E'); PG.sfx.back(); }
            } else { c.x += dt * 0.9; c.up = c.done === 'away' ? (c.up || 0) + dt * 0.6 : 0; if (c.x > 1.4) { s.chase = null; s.gap = 0.3; } }
          }
          // Polina's ball: catch it in a jump
          if (s.ball) {
            const b = s.ball; b.t += dt; b.x += b.vx * dt; b.vy -= 0.64 * dt; b.y += b.vy * dt;
            if (s.y > 0.04 && Math.abs(b.x - FX) < 0.08 && Math.abs(b.y - (s.y + 0.08)) < 0.1) {
              inst.stats.balls++; PG.reward({ score: 80, energy: 1, x: ax, y: ay - (s.y + 0.1) * A.h });
              say('Впіймала! Молодчинка!', '#1E9E86'); PG.sfx.coin(); PG.buzz(PG.HAP.success); PG.burst(ax, ay - (s.y + 0.08) * A.h, '#F2615E', 16, 200); s.ball = null;
            } else if (b.y < -0.05 || b.x > 1.3) { s.ball = null; if (b.x < 1.3) say('Не впіймала. Наступного разу!', '#5C6577'); }
          }
          s.gap -= sp * dt * F.dense;
          if (s.gap <= 0 && !inst.over && !s.chase && !s.ball) spawn();
          const low = (s.t < s.duckUntil && s.y <= 0.08) || (s.creep && s.y <= 0); // a duck still counts in the last moment of a landing
          const flyClear = A.w * SZ * 1.35 / A.h; // a gull can also be jumped clean over
          for (const o of s.objs) {
            o.x -= sp * dt + (o.type === 'dog' ? o.walk * dt : 0) + (o.type === 'gull' ? 0.16 * dt : 0);
            const left = FX - (o.type === 'treat' ? 0.09 : 0.035), right = FX + (o.type === 'treat' ? 0.11 : 0.045);
            const hw = (o.w || 0.06) / 2 * (o.type === 'treat' ? 1 : o.type === 'dog' ? 0.7 : 0.6);
            const overlap = o.x + hw > left && o.x - hw < right;
            if (o.type === 'treat' && !o.got) { const ty = o.alt + Math.sin(s.t * 4 + o.x * 9) * 0.01; if (overlap && Math.abs(ty - (s.y + 0.06)) < 0.11) collect(o, A.x + o.x * A.w, A.y + (GY - ty) * A.h); }
            else if ((o.type === 'magnet' || o.type === 'heart' || o.type === 'zoom') && !o.got && overlap && Math.abs(o.alt - (s.y + 0.06)) < 0.13) {
              o.got = true; const px = A.x + o.x * A.w, py = A.y + (GY - o.alt) * A.h;
              if (o.type === 'magnet') { s.magnetUntil = s.t + 6; say('Магніт! Смаколики летять до Ави', '#B07A0E'); }
              else if (o.type === 'zoom') { s.zoomUntil = s.t + 4.5; inst.stats.zooms++; say('ЗУМІ! Ава мчить, як вітер', '#7765EE'); PG.shake(3); PG.buzz(PG.HAP.success); }
              else { s.hearts = Math.min(s.maxHearts, s.hearts + 1); PG.floatText(px, py - 30, '+1 ♥', '#F2615E', 20); }
              PG.sfx.loop(); PG.burst(px, py, o.type === 'heart' ? '#F2615E' : o.type === 'zoom' ? '#9C8CFF' : '#F5B12E', 16, 180);
            } else if (o.type === 'pigeon' && !o.fly && o.x < FX + 0.14) {
              o.fly = s.t; o.vy = rand(0.45, 0.75); o.vx = rand(0.15, 0.45); flutter(); PG.reward({ score: 5 });
              if (Math.random() < 0.35) PG.floatText(A.x + o.x * A.w, A.y + (GY - 0.12) * A.h, 'Пурх!', '#5C6577', 13);
            }
            else if (o.type === 'puddle' && overlap && s.y < 0.02 && !o.hit) {
              o.hit = true;
              if (zoom()) PG.burst(ax, ay, '#5BB2E4', 20, 260);
              else if (F.softPuddles) { s.slowUntil = s.t + 0.7; s.combo = 0; PG.floatText(ax, ay - A.h * 0.25, 'Хлюп!', '#3E9BF0', 20); PG.burst(ax, ay, '#5BB2E4', 14, 200); PG.sfx.back(); }
              else hurt('puddle', A);
            }
            else if ((o.type === 'bush' || o.type === 'cat') && overlap && s.y < o.h * 0.7 && !o.hit) { o.hit = true; if (zoom()) { o.smash = s.t; PG.burst(A.x + o.x * A.w, ay - 20, o.type === 'cat' ? '#9AA3B5' : '#4FA83A', 18, 240); } else hurt(o.type, A); }
            else if ((o.type === 'branch' || o.type === 'gull') && overlap && !o.hit && !o.ok) {
              const over = o.type === 'gull' && s.y > flyClear;
              if (low || over) { o.ok = true; PG.reward({ score: 15, x: ax, y: ay - A.h * 0.2 }); PG.floatText(ax, ay - A.h * 0.28, over ? 'Перестрибнула!' : 'Пригнулась!', '#1E9E86', 16); }
              else { o.hit = true; if (zoom()) o.smash = s.t; else hurt(o.type, A); }
            }
            else if (o.type === 'dog') {
              if (overlap && !o.hit && !(s.creep && s.y <= 0) && !zoom()) { o.hit = true; hurt('dog', A); }
              if (!o.passed && o.x + hw < left) { o.passed = true; if (!o.hit) { inst.stats.sneaks++; PG.reward({ score: 30, energy: 1, x: ax, y: ay - A.h * 0.2 }); PG.floatText(ax, ay - A.h * 0.3, zoom() ? 'Вжух!' : 'Тихенько!', '#1E9E86', 20); PG.buzz(PG.HAP.success); PG.sfx.coin(); } }
            }
            if (o.fly) { o.x += o.vx * dt; o.alt += o.vy * dt; o.vy += 0.4 * dt; }
            if (o.type === 'treat' && !o.counted && o.x < FX) { o.counted = true; s.seen++; }
          }
          s.objs = s.objs.filter(o => o.x > -0.5 && !(o.got && o.type !== 'dog') && (o.alt || 0) < 1.3);
          if (s.tutBranch && s.objs.some(o => o.type === 'branch' && o.x - FX < 0.75 && o.x > FX)) { say('Гілка! Проведи пальцем униз', '#27303F'); s.tutBranch = false; }
        },
        win() {
          s.objs = s.objs.filter(o => o.type === 'treat');
          const share = s.treats / Math.max(1, s.seen + s.objs.length);
          inst.stars = share >= 0.8 && s.hearts >= 3 ? 3 : share >= 0.5 ? 2 : 1;
          Object.assign(inst.stats, { treats: s.treats, stars: inst.stars, combo: s.best });
        },
        draw(ctx, A) {
          const bg = PG.sprite(F.beach ? 'img/walk/bg_beach.webp' : 'img/walk/bg_park.webp');
          if (bg) { const bh = A.h, bw = bg.naturalWidth * bh / bg.naturalHeight; const off = -((s.scroll * A.w * 0.6) % bw); for (let x = A.x + off; x < A.x + A.w; x += bw) ctx.drawImage(bg, x, A.y, bw + 1, bh); }
          else { ctx.fillStyle = '#BFE3F7'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          const ax = A.x + FX * A.w, gy = A.y + GY * A.h, size = A.w * SZ;
          if (zoom()) { // speed lines
            const k = Math.min(1, (s.zoomUntil - s.t) * 2);
            for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,255,255,${0.55 * k})`; ctx.fillRect(A.x + ((i * 97 - s.t * 1100) % A.w + A.w) % A.w, A.y + A.h * (0.3 + i * 0.065), 46, 3); }
          }
          // HUD: treats, metres left, active power-ups
          PG.drawSprite(ctx, 'img/treats/biscuit.webp', A.x + A.w / 2 - 44, A.y + A.h * 0.2, 36, { rot: -0.3 });
          txt(String(s.treats), A.x + A.w / 2 + 14, A.y + A.h * 0.2, Math.min(70, A.w * 0.19), 'rgba(255,255,255,0.88)', { font: FD });
          if (s.combo >= 3) txt(`комбо ${s.combo}${s.combo >= 5 ? ' · ×' + (1 + Math.floor(s.combo / 5)) : ''}`, A.x + A.w / 2, A.y + A.h * 0.2 + 34, 15, 'rgba(39,48,63,0.6)', { font: FB, weight: 900 });
          txt(`ще ${Math.max(0, F.goal - inst.progress)} м`, A.x + A.w - 50, A.y + 24, 13, 'rgba(39,48,63,0.7)', { font: FB, weight: 900 });
          const ring = (x, k, col) => { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, A.y + 54, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k)); ctx.stroke(); };
          if (s.t < s.magnetUntil) { ring(A.x + A.w - 30, (s.magnetUntil - s.t) / 6, 'rgba(245,177,46,0.9)'); PG.ava.bone(ctx, A.x + A.w - 30, A.y + 54, 14, -0.4, '#F5B12E'); }
          if (zoom()) { ring(A.x + A.w - 64, (s.zoomUntil - s.t) / 4.5, 'rgba(119,101,238,0.9)'); txt('⚡', A.x + A.w - 64, A.y + 55, 13, '#7765EE', {}); }
          // finish gate
          const gateX = A.x + (FX + F.goal / MPW - s.scroll) * A.w;
          if (gateX < A.x + A.w + 60) {
            ctx.fillStyle = '#8E5E37'; ctx.fillRect(gateX - 4, gy - A.h * 0.42, 8, A.h * 0.42); ctx.fillRect(gateX + 56, gy - A.h * 0.42, 8, A.h * 0.42);
            for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#27303F' : '#FFFFFF'; ctx.fillRect(gateX - 4 + i * 8.5, gy - A.h * 0.42, 8.5, 16); ctx.fillStyle = i % 2 ? '#FFFFFF' : '#27303F'; ctx.fillRect(gateX - 4 + i * 8.5, gy - A.h * 0.42 + 16, 8.5, 16); }
            txt('ФІНІШ', gateX + 30, gy - A.h * 0.42 - 14, 14, '#27303F', { font: FD });
          }
          const lift = s.y * A.h;
          for (const o of s.objs) {
            const ox = A.x + o.x * A.w;
            if (o.type === 'puddle') PG.drawSprite(ctx, 'img/walk/puddle.webp', ox, gy + 4, o.w * A.w * 1.5 * 89 / 400, { ay: 0.55 });
            else if (o.type === 'bush') { if (!o.smash) PG.drawSprite(ctx, o.stone ? 'img/walk/stone.webp' : 'img/walk/bush.webp', ox, gy + 6, o.h * A.h * 1.45, { ay: 1 }); }
            else if (o.type === 'cat') {
              if (o.smash) { const k = s.t - o.smash; PG.drawSprite(ctx, 'img/walk/cat.webp', ox + k * 300, gy - k * 500 + k * k * 600, o.h * A.h * 1.25, { ay: 1, rot: k * 8 }); }
              else PG.drawSprite(ctx, 'img/walk/cat.webp', ox, gy + 3, o.h * A.h * 1.25, { ay: 1 });
            }
            else if (o.type === 'branch') {
              // a tree by the path with one low branch over it: the leaves end just above a ducking Ava (0.98 of her length)
              const th = size * 4.05, tw = th * 651 / 900, sway = o.smash ? -0.08 : Math.sin(s.t * 2.2 + o.x * 3) * 0.012;
              PG.drawSprite(ctx, 'img/walk/tree.webp', ox - 0.19 * tw, gy + 2, th, { ay: 1, rot: sway });
            }
            else if (o.type === 'gull') PG.drawStrip(ctx, 'img/walk/gull.webp', 4, Math.floor(s.t * 10 + o.x * 7), ox, gy - size * 1.0, size * 0.7, { ay: 0.5, alpha: o.smash ? 0.5 : 1, rot: o.smash ? -0.6 : 0 });
            else if (o.type === 'pigeon') { const fr = o.fly ? 2 + Math.floor(s.t * 14 + o.ph) % 2 : Math.floor(s.t * 1.5 + o.ph) % 2; PG.drawStrip(ctx, 'img/walk/pigeon.webp', 4, fr, ox, gy + 2 - o.alt * A.h, size * 0.4, { ay: 1, flip: !!o.fly }); }
            else if (o.type === 'dog') {
              const bob = Math.abs(Math.sin(s.t * 7)) * 2;
              ctx.fillStyle = 'rgba(39,48,63,0.14)'; ctx.beginPath(); ctx.ellipse(ox, gy + 2, o.w * A.w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();
              PG.drawSprite(ctx, o.img, ox, gy + 3 - bob, o.h * A.h * 1.35, { ay: 1 });
              if (!o.passed && !o.hit && o.x - FX < 0.8 && !zoom()) { // keep saying it until the dog is fully past
                const p = 0.6 + 0.4 * Math.sin(s.t * 8);
                ctx.fillStyle = rgba('#27303F', 0.78); PG.rrect(A.x + A.w / 2 - 86, A.y + A.h * 0.37, 172, 34, 17); ctx.fill();
                txt(s.creep ? 'Тихенько…' : 'Тримай палець!', A.x + A.w / 2, A.y + A.h * 0.37 + 17, 15, rgba('#FFFFFF', s.creep ? 1 : p), { font: FB, weight: 900 });
              }
            } else if (o.type === 'magnet' || o.type === 'heart' || o.type === 'zoom') {
              const ty = gy - (o.alt + Math.sin(s.t * 5 + o.x * 9) * 0.015) * A.h, pulse = 1 + Math.sin(s.t * 8) * 0.08;
              ctx.fillStyle = o.type === 'heart' ? 'rgba(242,97,94,0.3)' : o.type === 'zoom' ? 'rgba(119,101,238,0.35)' : 'rgba(245,177,46,0.35)';
              ctx.beginPath(); ctx.arc(ox, ty, A.w * 0.07 * pulse, 0, Math.PI * 2); ctx.fill();
              if (o.type === 'magnet') PG.ava.bone(ctx, ox, ty, A.w * 0.09, Math.sin(s.t * 3) * 0.3, '#F5B12E');
              else if (o.type === 'heart') heart(ctx, ox, ty, A.w * 0.075, true);
              else { // a rainbow bolt: zoomies
                for (let i = 0; i < 5; i++) { ctx.strokeStyle = `hsl(${i * 60 + s.t * 200},85%,62%)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ox, ty + 6, A.w * (0.045 - i * 0.006), Math.PI, 0); ctx.stroke(); }
                txt('⚡', ox, ty - 2, A.w * 0.05, '#7765EE', {});
              }
            } else if (o.type === 'treat') {
              const ty = gy - (o.alt + Math.sin(s.t * 4 + o.x * 9) * 0.01) * A.h;
              ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.beginPath(); ctx.arc(ox, ty, A.w * 0.05, 0, Math.PI * 2); ctx.fill();
              PG.drawSprite(ctx, 'img/treats/' + o.k + '.webp', ox, ty, A.w * 0.075, { rot: Math.sin(s.t * 3 + o.x * 5) * 0.2 });
            }
          }
          // the squirrel ahead, and the ball in the air
          if (s.chase) {
            const c = s.chase, cx = A.x + c.x * A.w;
            PG.drawStrip(ctx, 'img/walk/squirrel.webp', 4, Math.floor(s.t * 14), cx, gy + 2 - (c.up || 0) * A.h, size * 0.6, { ay: 0.92, rot: c.done === 'away' ? -1.2 : 0 });
            if (!c.done) {
              const k = Math.min(1, c.power / 8), bx = A.x + A.w / 2 - 80, by = A.y + A.h * 0.37;
              ctx.fillStyle = 'rgba(255,255,255,0.88)'; PG.rrect(bx, by, 160, 16, 8); ctx.fill();
              ctx.fillStyle = k > 0.7 ? '#22B59B' : ACCENT; PG.rrect(bx, by, Math.max(16, 160 * k), 16, 8); ctx.fill();
              txt('ТАП-ТАП-ТАП!', A.x + A.w / 2, by + 34, 17, rgba('#27303F', 0.65 + 0.35 * Math.sin(s.t * 12)), { font: FD });
            }
          }
          if (s.ball) {
            const bx = A.x + s.ball.x * A.w, by = gy - s.ball.y * A.h;
            ctx.fillStyle = 'rgba(39,48,63,0.12)'; ctx.beginPath(); ctx.ellipse(bx, gy + 2, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
            PG.drawSprite(ctx, 'img/treats/ball.webp', bx, by, A.w * 0.075, { rot: s.t * 8 });
            if (s.ball.x > FX - 0.3 && s.ball.x < FX) txt('СТРИБАЙ!', A.x + A.w / 2, A.y + A.h * 0.37 + 14, 20, rgba('#1E9E86', 0.6 + 0.4 * Math.sin(s.t * 14)), { font: FD });
          }
          // Ava
          const hurting = s.t - s.hurtT < 0.7, blink = s.t < s.hurtUntil && !hurting && Math.floor(s.t * 12) % 2 === 0;
          const ducking = (s.creep || s.t < s.duckUntil) && s.y <= 0.02;
          let pose = 'run';
          if (!s.started) pose = 'stand';
          else if (inst.over && inst.over.won) pose = 'hop';
          else if (hurting || (inst.over && !inst.over.won)) pose = 'scared';
          else if (ducking) pose = 'stalk';
          s.fx.forEach(f => { ctx.fillStyle = f.rb ? `hsla(${(f.t * 600 + f.x * 900) % 360},90%,65%,${0.7 * (1 - f.t / 0.6)})` : `rgba(214,196,168,${0.55 * (1 - f.t / 0.6)})`; ctx.beginPath(); ctx.arc(A.x + f.x * A.w, gy - f.y * A.h - 2 - (f.rb ? size * 0.3 : 0), f.r + f.t * 10, 0, Math.PI * 2); ctx.fill(); });
          if (pose === 'run' && s.y > 0.01) pose = s.vy > 0 ? 'leapUp' : 'leapDown';
          const land = s.landAt != null ? Math.min(1, (s.t - s.landAt) / 0.18) : 1;
          let sq = 1 - Math.sin(land * Math.PI) * 0.1;
          if (pose === 'stalk' && !s.creep) sq *= 0.88; // ducking under a branch: flatter still
          if (!blink) { ctx.save(); ctx.translate(ax, gy - lift); ctx.scale(1 / Math.sqrt(sq), sq); ctx.rotate(s.y > 0.01 ? -s.vy * 0.06 : 0); PG.ava.draw(ctx, 0, 0, size, { pose, t: s.t * (zoom() ? 1.6 : 1) }); ctx.restore(); }
          for (let i = 0; i < s.maxHearts; i++) heart(ctx, A.x + 22 + i * 26, A.y + 24, 22, i < s.hearts);
          if (s.banner && s.t - s.banner.t < 1.8) {
            const a = Math.min(1, (1.8 - (s.t - s.banner.t)) * 3), w = Math.min(A.w - 24, 290);
            ctx.fillStyle = `rgba(255,255,255,${0.92 * a})`; PG.rrect(A.x + A.w / 2 - w / 2, A.y + A.h * 0.29, w, 32, 16); ctx.fill();
            txt(s.banner.text, A.x + A.w / 2, A.y + A.h * 0.29 + 16, 14, rgba(s.banner.col, a), { font: FB, weight: 900, max: w - 16 });
          }
        }
      });
      return inst;
    }
  });
})();

// Ава шукає кісточку — hot and cold in the backyard. Tap the lawn and Ava trots there and sniffs. The closer she is
// to the buried bone, the warmer the nose meter, the redder the scent wisps and the faster the phone taps in your hand.
// Stop on the spot and she digs it up. Later levels hide a smelly sock as a decoy and let the neighbour's cat in:
// Ava is shy, so she backs away from it with her ears flat.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, rand, txt, rgba } = PG;
  const ACCENT = '#C9864A';
  const hyp = Math.hypot;
  function sniffSound(p) { if (!PG.tone) return; const f = 900 + p * 700; PG.tone(f, 0.04, 'triangle', 0.025); PG.tone(f * 1.1, 0.04, 'triangle', 0.02, 0.07); }
  function sock(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 30, s / 30);
    ctx.fillStyle = '#F4F1EA'; ctx.strokeStyle = '#B9B2A4'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(6, -14); ctx.lineTo(6, 4); ctx.quadraticCurveTo(16, 6, 14, 12); ctx.quadraticCurveTo(10, 16, -4, 14); ctx.quadraticCurveTo(-8, 12, -6, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F2615E'; ctx.fillRect(-6, -14, 12, 4); ctx.fillStyle = '#7765EE'; ctx.fillRect(-6, -8, 12, 3);
    ctx.restore();
  }
  PG.arcade.register({
    id: 'avasniff',
    title: 'Ава шукає кісточку',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/ava/sniff.webp',
    howto: ['Тапай по траві: кільце покаже, тепло чи холодно', 'Що гарячіше — то частіше тремтить. Ава копає, коли стане на місце'],
    goal: lv => ({ count: Math.min(3 + Math.floor((lv - 1) / 2), 7), unit: 'кісточок' }),
    twist: lv => ({ 1: 'Розминка: багато часу', 2: 'Кісточки глибше: шукай точніше', 3: 'Нове: смердюча шкарпетка-обманка', 4: 'Нове: сусідський кіт', 5: 'Менше часу', 6: 'Нове: без шкали — тільки нюх і вібрація' }[lv] || 'Менше часу, точніше'),
    icon(ctx, x, y, r) { if (!PG.ava.draw(ctx, x, y + r * 0.6, r * 1.5, { pose: 'sniff', shadow: false })) PG.ava.bone(ctx, x, y, r * 1.2, -0.4); },
    create(level) {
      const L = level;
      const goalN = Math.min(3 + Math.floor((L - 1) / 2), 7);
      const R = Math.max(0.075 - (L - 1) * 0.006, 0.045); // find radius in arena widths
      const perBone = Math.max(20 - (L - 1) * 1.8, 10);
      const s = {
        t: 0, ax: 0.5, ay: 0.62, tx: 0.5, ty: 0.62, dir: 1, moving: false, still: 0, heat: 0, bone: null, decoy: null,
        dig: 0, digAt: -9, found: [], wisps: [], rings: [], nextBuzz: 0, time: goalN * perBone, cat: null, catMove: 6, scaredUntil: 0, celebrate: -9, sockAt: -9
      };
      const inst = { progress: 0, over: null, stats: { level: L, taps: 0, socks: 0, cats: 0 } };
      inst._s = s;
      const FIELD = { x0: 0.12, x1: 0.88, y0: 0.34, y1: 0.86 }; // open lawn in the yard picture
      const randSpot = (away, minD) => { for (let i = 0; i < 60; i++) { const p = { x: rand(FIELD.x0 + 0.04, FIELD.x1 - 0.04), y: rand(FIELD.y0 + 0.04, FIELD.y1 - 0.04) }; if (!away.some(a => a && hyp(a.x - p.x, (a.y - p.y) * 1.35) < minD)) return p; } return { x: 0.5, y: 0.6 }; };
      function hide() {
        s.bone = randSpot([{ x: s.ax, y: s.ay }], 0.4);
        s.decoy = L >= 3 ? randSpot([s.bone, { x: s.ax, y: s.ay }], 0.3) : null;
      }
      hide();
      if (L >= 4) s.cat = Object.assign(randSpot([s.bone, { x: s.ax, y: s.ay }], 0.3), { show: 0 });
      // heat from 0 (cold) to 1 (on the spot), measured in arena widths with y squashed for the angled view
      const heatAt = (p, x, y) => p ? clamp(1 - hyp(p.x - x, (p.y - y) * 1.35) / 0.75, 0, 1) : 0;
      Object.assign(inst, {
        tap(x, y) {
          const A = PG.arena; if (s.dig > 0 || PG.now < 0) return;
          inst.stats.taps++;
          s.tx = clamp((x - A.x) / A.w, FIELD.x0, FIELD.x1); s.ty = clamp((y - A.y) / A.h, FIELD.y0, FIELD.y1);
          // the nose already feels the spot you point at: a coloured ring there and taps in your hand, hotter = more
          const h = Math.max(heatAt(s.bone, s.tx, s.ty), heatAt(s.decoy, s.tx, s.ty) * 0.92);
          s.rings.push({ x: s.tx, y: s.ty, h, t: s.t });
          PG.buzz(h > 0.85 ? [12, 50, 12, 50, 12, 50, 14] : h > 0.62 ? [10, 60, 10, 60, 12] : h > 0.38 ? [9, 80, 9] : 8);
          sniffSound(h);
        },
        move(x, y) { const A = PG.arena; if (s.dig > 0) return; s.tx = clamp((x - A.x) / A.w, FIELD.x0, FIELD.x1); s.ty = clamp((y - A.y) / A.h, FIELD.y0, FIELD.y1); },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt;
          if (inst.over) return;
          s.time -= dt;
          if (s.time <= 0) { s.time = 0; inst.over = { won: false, cause: 'time' }; PG.sfx.over(); return; }
          // the cat wanders now and then
          if (s.cat) {
            s.catMove -= dt; s.cat.show = Math.min(1, s.cat.show + dt * 2);
            if (s.catMove <= 0) { Object.assign(s.cat, randSpot([s.bone, { x: s.ax, y: s.ay }], 0.28)); s.cat.show = 0; s.catMove = rand(6, 9); }
          }
          const scared = s.t < s.scaredUntil;
          if (s.dig > 0) {
            s.dig -= dt;
            if (Math.floor(s.t * 14) % 2 === 0) PG.burst(A.x + s.ax * A.w + s.dir * A.w * 0.08, A.y + s.ay * A.h, '#8B5A33', 2, 90);
            if (s.dig <= 0) finishDig(A);
            return;
          }
          // walking
          const dx = s.tx - s.ax, dy = (s.ty - s.ay) * 1.35, d = hyp(dx, dy), sp = (scared ? 0.7 : 0.58) * dt;
          if (d > 0.01) { s.moving = true; s.still = 0; const k = Math.min(1, sp / d); s.ax += dx * k; s.ay += dy / 1.35 * k; if (Math.abs(dx) > 0.004) s.dir = dx > 0 ? 1 : -1; }
          else { s.moving = false; s.still += dt; }
          // cat: Ava backs away with her ears flat
          if (s.cat && !scared && s.cat.show >= 1 && hyp(s.cat.x - s.ax, (s.cat.y - s.ay) * 1.35) < 0.16) {
            inst.stats.cats++; s.scaredUntil = s.t + 1.4; s.time = Math.max(0, s.time - 2);
            const ax = s.ax - s.cat.x, ay = s.ay - s.cat.y, n = hyp(ax, ay) || 1;
            s.tx = clamp(s.ax + ax / n * 0.25, FIELD.x0, FIELD.x1); s.ty = clamp(s.ay + ay / n * 0.25, FIELD.y0, FIELD.y1);
            PG.floatText(A.x + s.cat.x * A.w, A.y + s.cat.y * A.h - 50, 'Шшш!', '#27303F', 20); PG.sfx.hit(); PG.buzz(PG.HAP.thud);
          }
          // heat with a little smoothing; the decoy smells almost as good
          const h = Math.max(heatAt(s.bone, s.ax, s.ay), heatAt(s.decoy, s.ax, s.ay) * 0.92);
          s.heat = lerp(s.heat, h, Math.min(1, dt * 5));
          // haptics and sniff sounds: faster as it gets hotter, only while she is sniffing
          s.nextBuzz -= dt;
          if (!s.moving && s.nextBuzz <= 0) {
            const p = s.heat; s.nextBuzz = lerp(1.1, 0.12, Math.pow(p, 1.4));
            PG.buzz(p > 0.85 ? PG.HAP.soft : p > 0.6 ? PG.HAP.light : PG.HAP.tick); sniffSound(p);
          }
          // scent wisps rise from the ground near her nose
          if (Math.random() < dt * (3 + s.heat * 14)) s.wisps.push({ x: s.ax + s.dir * 0.07 + rand(-0.05, 0.05), y: s.ay + rand(-0.02, 0.02), t: 0, h: s.heat });
          s.wisps.forEach(w => { w.t += dt; w.y -= dt * 0.08; }); s.wisps = s.wisps.filter(w => w.t < 1.1);
          // standing still on the spot digs
          const onBone = hyp(s.bone.x - s.ax, (s.bone.y - s.ay) * 1.35) < R, onSock = s.decoy && hyp(s.decoy.x - s.ax, (s.decoy.y - s.ay) * 1.35) < R;
          if (!s.moving && s.still > 0.45 && (onBone || onSock)) { s.dig = 0.9; s.digWhat = onBone ? 'bone' : 'sock'; PG.buzz(PG.HAP.double); }
        },
        draw(ctx, A) {
          const bg = PG.sprite('img/walk/bg_yard.webp');
          if (bg) { const k = Math.max(A.w / bg.naturalWidth, A.h / bg.naturalHeight), w = bg.naturalWidth * k, h = bg.naturalHeight * k; ctx.drawImage(bg, A.x + (A.w - w) / 2, A.y + (A.h - h) / 2, w, h); }
          else { ctx.fillStyle = '#8CCB6A'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          // dug holes of bones already found
          s.found.forEach(f => { ctx.fillStyle = 'rgba(92,60,34,0.55)'; ctx.beginPath(); ctx.ellipse(A.x + f.x * A.w, A.y + f.y * A.h, A.w * 0.04, A.w * 0.018, 0, 0, Math.PI * 2); ctx.fill(); });
          // heat rings where you tapped
          s.rings = s.rings.filter(r => s.t - r.t < 1.4);
          s.rings.forEach(r => {
            const p = (s.t - r.t) / 1.4, col = r.h > 0.85 ? '#F2483E' : r.h > 0.62 ? '#F58A2E' : r.h > 0.38 ? '#F5C02E' : '#5DB7F2';
            ctx.strokeStyle = rgba(col, 0.9 * (1 - p)); ctx.lineWidth = 4;
            ctx.beginPath(); ctx.ellipse(A.x + r.x * A.w, A.y + r.y * A.h, 10 + p * 34, (10 + p * 34) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
            if (p < 0.6) txt(r.h > 0.85 ? 'Гаряче!' : r.h > 0.62 ? 'Тепліше' : r.h > 0.38 ? 'Тепло' : 'Холодно', A.x + r.x * A.w, A.y + r.y * A.h - 26 - p * 20, 13, rgba('#27303F', 1 - p / 0.6), { font: FB, weight: 900 });
          });
          // target marker
          if (s.moving) { ctx.strokeStyle = rgba('#FFFFFF', 0.8); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(A.x + s.tx * A.w, A.y + s.ty * A.h, 12, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
          // wisps: blue when cold, red when hot
          s.wisps.forEach(w => {
            const c = w.h < 0.5 ? `rgba(${Math.round(lerp(120, 255, w.h * 2))},${Math.round(lerp(180, 200, w.h * 2))},255,` : `rgba(255,${Math.round(lerp(200, 70, (w.h - 0.5) * 2))},${Math.round(lerp(120, 60, (w.h - 0.5) * 2))},`;
            ctx.fillStyle = c + (0.7 * (1 - w.t / 1.1)) + ')';
            ctx.beginPath(); ctx.arc(A.x + w.x * A.w + Math.sin(w.t * 6 + w.x * 40) * 4, A.y + w.y * A.h, 3 + w.t * 5, 0, Math.PI * 2); ctx.fill();
          });
          // the cat
          if (s.cat) PG.drawSprite(ctx, 'img/walk/cat.webp', A.x + s.cat.x * A.w, A.y + s.cat.y * A.h + 6, A.w * 0.17, { ay: 1, flip: s.cat.x < s.ax, alpha: s.cat.show });
          // the dig result popping out
          const sinceDig = s.t - s.digAt;
          if (sinceDig < 1.2 && s.lastDig) {
            const p = sinceDig / 1.2, bx = A.x + s.lastDig.x * A.w, by = A.y + s.lastDig.y * A.h - Math.sin(p * Math.PI) * A.h * 0.12;
            if (s.lastDig.what === 'bone') PG.drawSprite(ctx, 'img/treats/bone.webp', bx, by, A.w * 0.12, { rot: p * 6 });
            else sock(ctx, bx, by, A.w * 0.09, p * 5);
          }
          // Ava
          const scared = s.t < s.scaredUntil, cele = s.t - s.celebrate < 1;
          const far = hyp(s.tx - s.ax, (s.ty - s.ay) * 1.35) > 0.14;
          const pose = scared ? 'scared' : cele ? 'hop' : s.dig > 0 ? 'dig' : s.moving ? (far ? 'run' : 'walk') : 'sniff';
          PG.ava.draw(ctx, A.x + s.ax * A.w, A.y + s.ay * A.h, A.w * 0.2, { pose, t: s.t, dir: scared ? -s.dir : s.dir });
          // HUD: nose meter, time, bones
          const top = A.y + 14;
          if (L < 6) {
            const bw = A.w - 120, bx = A.x + 60;
            ctx.fillStyle = 'rgba(255,255,255,0.85)'; PG.rrect(bx - 8, top - 4, bw + 16, 30, 15); ctx.fill();
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#5DB7F2'); g.addColorStop(0.5, '#F5B12E'); g.addColorStop(1, '#F2483E');
            ctx.fillStyle = g; PG.rrect(bx, top + 2, Math.max(14, bw * s.heat), 18, 9); ctx.fill();
            txt(s.heat > 0.85 ? 'Гаряче!' : s.heat > 0.6 ? 'Тепліше' : s.heat > 0.35 ? 'Тепло' : 'Холодно', bx + bw / 2, top + 11, 13, '#27303F', { font: FB, weight: 900 });
          }
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; PG.rrect(A.x + 10, top - 4, 44, 30, 15); ctx.fill();
          txt(String(Math.ceil(s.time)), A.x + 32, top + 11, 15, s.time < 10 ? '#E5484D' : '#27303F', { font: FD });
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; PG.rrect(A.x + A.w - 54, top - 4, 44, 30, 15); ctx.fill();
          PG.ava.bone(ctx, A.x + A.w - 42, top + 11, 14, -0.4, '#C9864A');
          txt(String(inst.progress), A.x + A.w - 24, top + 11, 14, '#27303F', { font: FD });
        }
      });
      function finishDig(A) {
        s.digAt = s.t; s.lastDig = { x: s.ax + s.dir * 0.05, y: s.ay, what: s.digWhat };
        if (s.digWhat === 'bone') {
          inst.progress++; s.found.push({ x: s.bone.x, y: s.bone.y }); s.celebrate = s.t;
          PG.reward({ score: 40, energy: 1, x: A.x + s.ax * A.w, y: A.y + s.ay * A.h - 60 });
          PG.sfx.coin(); PG.buzz(PG.HAP.success); PG.burst(A.x + s.ax * A.w, A.y + s.ay * A.h, '#F5B12E', 18, 220);
          if (inst.progress < goalN) hide();
        } else {
          inst.stats.socks++; s.decoy = L >= 3 ? randSpot([s.bone, { x: s.ax, y: s.ay }], 0.3) : null; s.time = Math.max(0, s.time - 3);
          PG.floatText(A.x + s.ax * A.w, A.y + s.ay * A.h - 70, 'Фу, шкарпетка! −3 с', '#27303F', 17); PG.sfx.bad(); PG.buzz(PG.HAP.thud);
        }
      }
      return inst;
    }
  });
})();

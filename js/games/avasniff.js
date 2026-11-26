// Ава шукає кісточку — a logic game in the backyard. The lawn is a grid of patches. Tap one: Ava runs there and sniffs,
// and the patch shows how many steps away the nearest bone is (warm colours = close). You have a few sniffs for each
// bone: narrow it down and send her to the right patch, and she digs it up. Later levels add bushes that block patches,
// a smelly sock that fools the nose, the neighbour's cat that she is scared of, and two bones buried at once.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, rand, randi, shuffle, txt, rgba } = PG;
  const ACCENT = '#C9864A';
  const COLS = 6, ROWS = 7;
  const FIELD = { x0: 0.08, x1: 0.92, y0: 0.27, y1: 0.93 }; // the lawn inside the yard picture
  const heatCol = d => d <= 0 ? '#22B59B' : d === 1 ? '#F2483E' : d === 2 ? '#F58A2E' : d === 3 ? '#F5C02E' : d <= 5 ? '#7FC7F0' : '#5D8FD9';
  const heatWord = d => d === 1 ? 'Гаряче!' : d === 2 ? 'Тепло' : d === 3 ? 'Тепліше' : d <= 5 ? 'Прохолодно' : 'Холодно';
  function sniffSound(d) { if (!PG.tone) return; const f = 1300 - Math.min(d, 7) * 110; PG.tone(f, 0.05, 'triangle', 0.035); PG.tone(f * 1.12, 0.05, 'triangle', 0.03, 0.08); PG.tone(f * 1.25, 0.05, 'triangle', 0.025, 0.16); }
  const spec = lv => ({
    bones: Math.min(3 + Math.floor((lv - 1) / 2), 6),
    sniffs: Math.max(7 - Math.floor((lv - 1) / 2), 4),       // per bone
    bushes: Math.min(lv >= 2 ? 3 + Math.floor(lv / 2) : 0, 8),
    sock: lv >= 3, cat: lv >= 4, pair: lv >= 6               // two bones buried at the same time
  });

  PG.arcade.register({
    id: 'avasniff',
    title: 'Ава шукає кісточку',
    family: 'Ава',
    accent: ACCENT,
    thumb: 'img/ava/sniff.webp',
    howto: ['Тапни клітинку: Ава понюхає й покаже, скільки кроків до кісточки', 'Знайди за кілька нюхів — і вона викопає'],
    goal: lv => ({ count: spec(lv).bones, unit: 'кісточок' }),
    twist: lv => ({ 1: 'Розминка: 7 нюхів на кісточку', 2: 'Нове: кущі закривають клітинки', 3: 'Нове: смердюча шкарпетка-обманка', 4: 'Нове: сусідський кіт', 5: 'Менше нюхів', 6: 'Нове: дві кісточки одночасно' }[lv] || 'Менше нюхів, більше кущів'),
    icon(ctx, x, y, r) { if (!PG.ava.draw(ctx, x, y + r * 0.6, r * 1.5, { pose: 'sniff', shadow: false })) PG.ava.bone(ctx, x, y, r * 1.2, -0.4); },
    create(level) {
      const L = level, sp = spec(L);
      const N = COLS * ROWS, idx = (c, r) => r * COLS + c, cr = i => [i % COLS, Math.floor(i / COLS)];
      const s = {
        t: 0, tiles: Array.from({ length: N }, () => ({ state: 'grass', d: -1, at: 0 })), blocked: new Set(),
        bones: [], sock: -1, cat: -1, catMoves: 0, ax: 0.5, ay: 0.95, tx: 0.5, ty: 0.95, dir: 1, phase: 'idle', phaseT: 0, target: -1,
        sniffs: sp.sniffs, found: 0, pop: null, scaredUntil: 0, msg: null, stars: 0, totalLeft: 0
      };
      const inst = { progress: 0, over: null, stats: { level: L, sniffs: 0, socks: 0, cats: 0 } };
      inst._s = s;
      const center = i => { const [c, r] = cr(i); return [FIELD.x0 + (c + 0.5) * (FIELD.x1 - FIELD.x0) / COLS, FIELD.y0 + (r + 0.5) * (FIELD.y1 - FIELD.y0) / ROWS]; };
      const dist = (a, b) => { const [c1, r1] = cr(a), [c2, r2] = cr(b); return Math.abs(c1 - c2) + Math.abs(r1 - r2); };
      const free = i => !s.blocked.has(i) && s.tiles[i].state === 'grass' && !s.bones.includes(i) && i !== s.sock && i !== s.cat;
      // bushes first, then the bones away from bushes' shadow, the sock and the cat
      const all = shuffle([...Array(N).keys()]);
      for (const i of all) { if (s.blocked.size >= sp.bushes) break; const [c, r] = cr(i); if (r === ROWS - 1) continue; s.blocked.add(i); }
      function hideBones() {
        const need = sp.pair ? 2 : 1, picks = shuffle([...Array(N).keys()].filter(i => free(i) && s.tiles[i].state === 'grass'));
        s.bones = picks.slice(0, need);
        if (sp.sock && (s.sock < 0 || s.tiles[s.sock].state !== 'grass')) { const opts = picks.slice(need).filter(i => s.bones.every(b => dist(i, b) >= 3)); s.sock = opts.length ? opts[0] : -1; }
        s.sniffs = sp.sniffs + (sp.pair ? 2 : 0);
      }
      hideBones();
      function moveCat() { if (!sp.cat) return; const opts = [...Array(N).keys()].filter(i => free(i) && i !== s.target); s.cat = opts.length ? opts[randi(opts.length)] : -1; }
      moveCat();
      const nearest = i => Math.min(...s.bones.map(b => dist(i, b)).concat(s.sock >= 0 ? [dist(i, s.sock)] : []));
      function tileAt(x, y) {
        const A = PG.arena, fx = (x - A.x) / A.w, fy = (y - A.y) / A.h;
        if (fx < FIELD.x0 || fx > FIELD.x1 || fy < FIELD.y0 || fy > FIELD.y1) return -1;
        return idx(clamp(Math.floor((fx - FIELD.x0) / (FIELD.x1 - FIELD.x0) * COLS), 0, COLS - 1), clamp(Math.floor((fy - FIELD.y0) / (FIELD.y1 - FIELD.y0) * ROWS), 0, ROWS - 1));
      }
      function say(text, col) { s.msg = { text, col: col || '#27303F', t: s.t }; }
      Object.assign(inst, {
        start() { s.skip = true; },
        tap(x, y) {
          if (s.skip) { s.skip = false; return; }
          if (s.phase !== 'idle' || inst.over) return;
          const i = tileAt(x, y); if (i < 0) return;
          if (s.blocked.has(i)) { say('Там кущ — не пролізти', '#4C7A3A'); PG.sfx.bad(); PG.buzz(PG.HAP.double); return; }
          if (i === s.cat) { // she is shy: running at the cat costs a sniff
            s.sniffs--; inst.stats.cats++; s.scaredUntil = s.t + 1.2; say('Шшш! Кіт! −1 нюх', '#27303F'); PG.sfx.hit(); PG.buzz(PG.HAP.thud); moveCat();
            if (s.sniffs <= 0) lose(); return;
          }
          const tl = s.tiles[i];
          if (tl.state !== 'grass') { say(tl.state === 'sniffed' ? `Тут уже нюхали: ${tl.d} ${tl.d === 1 ? 'крок' : tl.d < 5 ? 'кроки' : 'кроків'}` : 'Тут уже копали'); PG.sfx.pick(); return; }
          s.target = i; const [cx, cy] = center(i); s.tx = cx; s.ty = cy + 0.02; s.phase = 'run'; s.phaseT = s.t;
          // haptics now, while the finger is on the glass (iOS allows them only here): hotter spot = more taps
          const d = nearest(i);
          PG.buzz(d === 0 ? PG.HAP.success : d === 1 ? [10, 50, 10, 50, 12] : d === 2 ? [10, 70, 10] : 8);
          PG.sfx.pick();
        },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt;
          if (inst.over) return;
          if (s.phase === 'run') {
            const dx = s.tx - s.ax, dy = (s.ty - s.ay) * 1.3, d = Math.hypot(dx, dy), v = 0.75 * dt;
            if (Math.abs(dx) > 0.004) s.dir = dx > 0 ? 1 : -1;
            if (d <= v) { s.ax = s.tx; s.ay = s.ty; s.phase = 'sniff'; s.phaseT = s.t; sniffSound(nearest(s.target)); }
            else { s.ax += dx / d * v; s.ay += dy / 1.3 / d * v; }
          } else if (s.phase === 'sniff' && s.t - s.phaseT > 0.7) {
            const i = s.target, tl = s.tiles[i], d = nearest(i);
            inst.stats.sniffs++;
            if (s.bones.includes(i) || i === s.sock) { s.phase = 'dig'; s.phaseT = s.t; PG.buzz(PG.HAP.double); return; }
            tl.state = 'sniffed'; tl.d = d; tl.at = s.t; s.sniffs--;
            say(`${heatWord(d)} · ${d} ${d === 1 ? 'крок' : d < 5 ? 'кроки' : 'кроків'}`, heatCol(d));
            s.phase = 'idle';
            if (sp.cat && ++s.catMoves % 2 === 0) moveCat();
            if (s.sniffs <= 0) lose();
          } else if (s.phase === 'dig') {
            if (Math.floor(s.t * 14) % 2 === 0) PG.burst(A.x + (s.ax + s.dir * 0.05) * A.w, A.y + s.ay * A.h, '#8B5A33', 2, 90);
            if (s.t - s.phaseT > 1.0) finishDig(A);
          } else if (s.phase === 'cheer' && s.t - s.phaseT > 1.0) s.phase = 'idle';
        },
        draw(ctx, A) {
          const bg = PG.sprite('img/walk/bg_yard.webp');
          if (bg) { const k = Math.max(A.w / bg.naturalWidth, A.h / bg.naturalHeight), w = bg.naturalWidth * k, h = bg.naturalHeight * k; ctx.drawImage(bg, A.x + (A.w - w) / 2, A.y + (A.h - h) / 2, w, h); }
          else { ctx.fillStyle = '#8CCB6A'; ctx.fillRect(A.x, A.y, A.w, A.h); }
          // a soft lawn panel so the grid reads on any part of the picture
          const gx = A.x + FIELD.x0 * A.w, gy = A.y + FIELD.y0 * A.h, gw = (FIELD.x1 - FIELD.x0) * A.w, gh = (FIELD.y1 - FIELD.y0) * A.h, tw = gw / COLS, th = gh / ROWS;
          ctx.fillStyle = 'rgba(120,180,80,0.35)'; PG.rrect(gx - 4, gy - 4, gw + 8, gh + 8, 14); ctx.fill();
          for (let i = 0; i < N; i++) {
            const [c, r] = cr(i), x = gx + c * tw, y = gy + r * th, tl = s.tiles[i];
            if (s.blocked.has(i)) { PG.drawSprite(ctx, 'img/walk/bush.webp', x + tw / 2, y + th * 0.95, th * 1.15, { ay: 1 }); continue; }
            ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,60,0,0.06)'; PG.rrect(x + 2, y + 2, tw - 4, th - 4, 8); ctx.fill();
            if (tl.state === 'sniffed') {
              const p = Math.min(1, (s.t - tl.at) / 0.3), col = heatCol(tl.d);
              ctx.fillStyle = rgba(col, 0.28); PG.rrect(x + 2, y + 2, tw - 4, th - 4, 8); ctx.fill();
              ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + tw / 2, y + th / 2, Math.min(tw, th) * 0.3 * PG.easeOutBack(p), 0, Math.PI * 2); ctx.fill();
              txt(String(tl.d), x + tw / 2, y + th / 2 + 1, Math.min(tw, th) * 0.34, '#FFFFFF', { font: FD });
            } else if (tl.state === 'dug') {
              ctx.fillStyle = 'rgba(92,60,34,0.6)'; ctx.beginPath(); ctx.ellipse(x + tw / 2, y + th * 0.6, tw * 0.3, th * 0.18, 0, 0, Math.PI * 2); ctx.fill();
              if (tl.what === 'bone') PG.ava.bone(ctx, x + tw / 2, y + th * 0.42, tw * 0.45, -0.4, '#F4EADB');
            }
          }
          // the cat sits on a patch
          if (s.cat >= 0) { const [cx, cy] = center(s.cat); PG.drawSprite(ctx, 'img/walk/cat.webp', A.x + cx * A.w, A.y + cy * A.h + th * 0.4, th * 1.05, { ay: 1, flip: cx < s.ax }); }
          // target patch while she runs
          if (s.phase === 'run' || s.phase === 'sniff') { const [c, r] = cr(s.target); ctx.strokeStyle = rgba('#FFFFFF', 0.6 + 0.4 * Math.sin(s.t * 10)); ctx.lineWidth = 3; PG.rrect(gx + c * tw + 2, gy + r * th + 2, tw - 4, th - 4, 8); ctx.stroke(); }
          // the dig result popping out
          if (s.pop && s.t - s.pop.t < 1.1) {
            const p = (s.t - s.pop.t) / 1.1, bx = A.x + s.pop.x * A.w, by = A.y + s.pop.y * A.h - Math.sin(p * Math.PI) * A.h * 0.12;
            if (s.pop.what === 'bone') PG.drawSprite(ctx, 'img/treats/bone.webp', bx, by, A.w * 0.13, { rot: p * 6 });
            else { ctx.save(); ctx.translate(bx, by); ctx.rotate(p * 5); ctx.fillStyle = '#F4F1EA'; ctx.fillRect(-8, -12, 16, 22); ctx.fillStyle = '#F2615E'; ctx.fillRect(-8, -12, 16, 5); ctx.restore(); }
          }
          // Ava
          const scared = s.t < s.scaredUntil;
          const pose = scared ? 'scared' : s.phase === 'cheer' ? 'hop' : s.phase === 'dig' ? 'dig' : s.phase === 'run' ? 'run' : s.phase === 'sniff' ? 'sniff' : 'idle';
          PG.ava.draw(ctx, A.x + s.ax * A.w, A.y + s.ay * A.h, A.w * 0.17, { pose, t: s.t, dir: s.dir });
          // HUD: sniffs left as noses, bones found
          const top = A.y + 12;
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; PG.rrect(A.x + 10, top - 2, A.w - 20, 34, 17); ctx.fill();
          txt('Нюхи', A.x + 40, top + 15, 12, '#8A5A2E', { font: FB, weight: 900 });
          const maxN = sp.sniffs + (sp.pair ? 2 : 0);
          for (let k = 0; k < maxN; k++) { ctx.fillStyle = k < s.sniffs ? '#27303F' : 'rgba(39,48,63,0.15)'; ctx.beginPath(); ctx.ellipse(A.x + 70 + k * 17, top + 15, 6.5, 5, 0, 0, Math.PI * 2); ctx.fill(); }
          PG.ava.bone(ctx, A.x + A.w - 62, top + 15, 16, -0.4, '#C9864A');
          txt(`${inst.progress}/${sp.bones}`, A.x + A.w - 34, top + 15, 14, '#27303F', { font: FD });
          if (s.msg && s.t - s.msg.t < 1.6) {
            const a = Math.min(1, (1.6 - (s.t - s.msg.t)) * 3);
            ctx.fillStyle = `rgba(255,255,255,${0.92 * a})`; PG.rrect(A.x + A.w / 2 - 120, top + 40, 240, 30, 15); ctx.fill();
            txt(s.msg.text, A.x + A.w / 2, top + 55, 14, rgba(s.msg.col, a), { font: FB, weight: 900, max: 230 });
          }
        }
      });
      function lose() { inst.over = { won: false, cause: 'sniffs' }; s.phase = 'over'; PG.sfx.over(); s.scaredUntil = s.t + 5; say('Нюхи скінчились', '#E5484D'); }
      function finishDig(A) {
        const i = s.target, tl = s.tiles[i];
        tl.state = 'dug'; tl.what = s.bones.includes(i) ? 'bone' : 'sock';
        s.pop = { t: s.t, x: s.ax + s.dir * 0.04, y: s.ay, what: tl.what };
        if (tl.what === 'bone') {
          inst.progress++; s.totalLeft += s.sniffs; s.phase = 'cheer'; s.phaseT = s.t;
          PG.reward({ score: 40 + s.sniffs * 15, energy: 1, x: A.x + s.ax * A.w, y: A.y + s.ay * A.h - 60 });
          PG.sfx.coin(); PG.burst(A.x + s.ax * A.w, A.y + s.ay * A.h, '#F5B12E', 18, 220);
          say(s.sniffs >= 3 ? 'Чудовий нюх!' : 'Знайшла!', '#22B59B');
          s.bones = s.bones.filter(b => b !== i);
          if (s.bones.length) s.tiles.forEach((t, j) => { if (t.state === 'sniffed') t.d = nearest(j); }); // numbers now point to the other bone
          if (!s.bones.length && inst.progress < sp.bones) { s.tiles.forEach(t => { if (t.state === 'sniffed') t.state = 'grass'; }); hideBones(); moveCat(); }
        } else {
          inst.stats.socks++; s.sock = -1; s.sniffs = Math.max(0, s.sniffs - 1); s.phase = 'idle';
          say('Фу, шкарпетка! −1 нюх', '#27303F'); PG.sfx.bad();
          if (s.sniffs <= 0) lose();
        }
      }
      return inst;
    }
  });
})();

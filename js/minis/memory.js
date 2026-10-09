// Мемо — the classic pairs game as a fake playable ad: a short peek, then find all 6 pairs before the timer runs out.
(function () {
  const PG = window.PG;
  const { FD, FB, INK, clamp, circle, rrect, txt } = PG;
  const FACES = [
    { shape: 'circle', color: '#F2615E' },
    { shape: 'square', color: '#F5B12E' },
    { shape: 'tri', color: '#22B59B' },
    { shape: 'star', color: '#7765EE' },
    { shape: 'heart', color: '#EC5FA0' },
    { shape: 'diamond', color: '#3E9BF0' }
  ];
  const COLS = 3, ROWS = 4, TIME = 30, PEEK = 1.8, FLIP = 0.18, SHOW_MISS = 0.65;

  function shape(ctx, kind, x, y, r) {
    ctx.beginPath();
    if (kind === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (kind === 'square') { rrect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76, r * 0.3); return; }
    else if (kind === 'tri') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.98, y + r * 0.72); ctx.lineTo(x - r * 0.98, y + r * 0.72); ctx.closePath(); }
    else if (kind === 'diamond') { ctx.moveTo(x, y - r * 1.05); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r * 1.05); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); }
    else if (kind === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.05;
        if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else if (kind === 'heart') {
      ctx.moveTo(x, y + r * 0.9);
      ctx.bezierCurveTo(x - r * 1.3, y + r * 0.05, x - r * 0.75, y - r * 1.05, x, y - r * 0.38);
      ctx.bezierCurveTo(x + r * 0.75, y - r * 1.05, x + r * 1.3, y + r * 0.05, x, y + r * 0.9);
      ctx.closePath();
    }
  }

  PG.ads.register({
    id: 'memory',
    title: 'Мемо',
    hook: 'Тест на пам\'ять: 97% не знайдуть усі пари!',
    create() {
      const deck = PG.shuffle([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
      // face: shown face up; turnAt: when the last flip started (for the animation); done: matched
      const cards = deck.map(f => ({ f, face: true, turnAt: -9, done: 0 }));
      let t = 0, open = [], missAt = 0, pairs = 0;
      const inst = { over: null, hint: 'Запам\'ятай і знайди однакові пари' };

      function grid(A) {
        const pad = 16, top = 34, bottom = 30, gap = 10;
        const cw = Math.min((A.w - pad * 2 - gap * (COLS - 1)) / COLS, ((A.h - top - bottom - gap * (ROWS - 1)) / ROWS) / 1.1);
        const ch = cw * 1.1, gw = cw * COLS + gap * (COLS - 1), gh = ch * ROWS + gap * (ROWS - 1);
        return { x: A.x + (A.w - gw) / 2, y: A.y + top + (A.h - top - bottom - gh) / 2, cw, ch, gap };
      }
      function cardRect(g, i) {
        const c = i % COLS, r = Math.floor(i / COLS);
        return { x: g.x + c * (g.cw + g.gap), y: g.y + r * (g.ch + g.gap), w: g.cw, h: g.ch };
      }
      function turn(card, faceUp) { card.face = faceUp; card.turnAt = PG.now; }
      function hideMiss() { open.forEach(c => turn(c, false)); open = []; missAt = 0; }

      inst.down = (x, y, A) => {
        if (inst.over || t < PEEK) return;
        if (missAt) hideMiss();
        const g = grid(A);
        for (let i = 0; i < cards.length; i++) {
          const R = cardRect(g, i), card = cards[i];
          if (x < R.x || x > R.x + R.w || y < R.y || y > R.y + R.h) continue;
          if (card.face || card.done) return;
          turn(card, true); open.push(card);
          PG.sfx.pick(); PG.buzz(PG.HAP.tick);
          if (open.length === 2) {
            const [a, b] = open;
            if (a.f === b.f) {
              a.done = b.done = PG.now; open = []; pairs++;
              PG.sfx.note(pairs + 1); PG.buzz(PG.HAP.double);
              PG.burst(R.x + R.w / 2, R.y + R.h / 2, FACES[card.f].color, 10, 150);
              if (pairs === FACES.length) inst.over = { won: true };
            } else { missAt = PG.now; PG.sfx.bad(); }
          }
          return;
        }
      };
      inst.update = dt => {
        if (inst.over) return;
        const was = t;
        t += dt;
        if (was < PEEK && t >= PEEK) { cards.forEach(c => turn(c, false)); PG.sfx.whoosh(); }
        if (missAt && PG.now - missAt > SHOW_MISS) hideMiss();
        if (t >= PEEK + TIME) inst.over = { won: false };
      };
      inst.draw = (ctx, A) => {
        const g = grid(A);
        // timer: full during the peek, then drains
        const k = t < PEEK ? 1 : clamp(1 - (t - PEEK) / TIME, 0, 1);
        ctx.fillStyle = '#E3E8F0'; rrect(A.x + 18, A.y + 14, A.w - 36, 8, 4); ctx.fill();
        ctx.fillStyle = k < 0.25 ? PG.BAD : PG.PAL[3]; rrect(A.x + 18, A.y + 14, Math.max(8, (A.w - 36) * k), 8, 4); ctx.fill();
        cards.forEach((card, i) => {
          const R = cardRect(g, i), cx = R.x + R.w / 2, cy = R.y + R.h / 2;
          // flip: width shrinks to 0, the side swaps at the midpoint
          const p = clamp((PG.now - card.turnAt) / FLIP, 0, 1);
          const showFace = p < 0.5 ? !card.face : card.face;
          const sx = Math.max(0.04, Math.abs(Math.cos(p * Math.PI)));
          const pop = card.done ? 1 + 0.08 * Math.sin(clamp((PG.now - card.done) / 0.3, 0, 1) * Math.PI) : 1;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(sx * pop, pop);
          ctx.fillStyle = 'rgba(0,0,0,0.08)'; rrect(-R.w / 2, -R.h / 2 + 3, R.w, R.h, 14); ctx.fill();
          if (showFace) {
            const F = FACES[card.f];
            ctx.fillStyle = card.done ? PG.rgba(F.color, 0.14) : '#FFFFFF'; rrect(-R.w / 2, -R.h / 2, R.w, R.h, 14); ctx.fill();
            ctx.strokeStyle = card.done ? PG.rgba(F.color, 0.5) : '#E3E8F0'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = F.color; shape(ctx, F.shape, 0, 0, Math.min(R.w, R.h) * 0.27); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; circle(-R.w * 0.08, -R.h * 0.09, Math.min(R.w, R.h) * 0.06); ctx.fill();
          } else {
            ctx.fillStyle = PG.PAL[3]; rrect(-R.w / 2, -R.h / 2, R.w, R.h, 14); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            for (const [dx, dy] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) { circle(dx * R.w, dy * R.h, Math.min(R.w, R.h) * 0.09); ctx.fill(); }
            txt('?', 0, 2, Math.min(R.w, R.h) * 0.36, 'rgba(255,255,255,0.9)', { font: FD });
          }
          ctx.restore();
        });
        const label = t < PEEK ? 'Запам\'ятовуй!' : `Пари: ${pairs}/${FACES.length}`;
        txt(label, A.x + A.w / 2, A.y + A.h - 14, 13, INK, { font: FB, weight: 900 });
        if (inst.over && !inst.over.won) {
          ctx.fillStyle = 'rgba(244,246,250,0.8)'; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt('Час вийшов', A.x + A.w / 2, A.y + A.h / 2, 26, INK, { font: FD });
        }
      };
      return inst;
    }
  });
})();

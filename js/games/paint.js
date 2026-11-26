// Розмальовка — paint by numbers on a pixel picture. Pick a colour at the bottom; every cell with its number lights up;
// tap or drag across the cells to paint them. A calm game with no way to lose: each level is the next picture,
// from a heart to Ava herself.
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, txt, rgba } = PG;
  const ACCENT = '#2FB5A6';
  const COL = {
    k: '#2E2D37', g: '#6B6F7D', t: '#C9864A', c: '#F6E9D3', r: '#E8434F', p: '#F48FB1', y: '#F7C948', o: '#F28A3C',
    G: '#4CAF50', l: '#9BD770', b: '#3E9BF0', s: '#9ED8F7', v: '#7765EE', n: '#8B5A33', w: '#FFFFFF', m: '#B07AE0', h: '#4F4F58', f: '#ECCE82', T: '#D6A06E'
  };
  // pictures, simplest first ('.' stays blank)
  const PICS = [
    { name: 'Серце', rows: ['.rr..rr.', 'rrrrrrrr', 'rrprrrrr', 'rpprrrrr', '.rrrrrr.', '..rrrr..', '...rr...'] },
    { name: 'Квітка', rows: ['...pp...', '..pyyp..', '.ppyypp.', '..pyyp..', '...pp...', '...G....', '.lGG.GG.', '...G.l..', '...G....'] },
    { name: 'Сонечко', rows: ['y...y...y', '.y..y..y.', '..ooooo..', 'yyoyyyoyy', '..oyyyo..', 'yyoyyyoyy', '..ooooo..', '.y..y..y.', 'y...y...y'] },
    { name: 'Рибка', rows: ['....bbb....', '..bbsbbb..b', '.bbkbbbbbbb', 'bbbbbbbbbb.', '.bbbbbbbbbb', '..bbbbbb..b', '....bbb....'] },
    { name: 'Яблуко', rows: ['....n...', '...nGG..', '.rrnrrr.', 'rrrrrrrr', 'rprrrrrr', 'rprrrrrr', '.rrrrrr.', '..rr.rr.'] },
    { name: 'Будиночок', rows: ['....rr....', '...rrrr...', '..rrrrrr..', '.rrrrrrrr.', '.cccccccc.', '.csscnncc.', '.csscnncc.', '.cccnnncc.', 'GGGGGGGGGG'] },
    { name: 'Метелик', rows: ['vv.....vv', 'vmv...vmv', 'vmmv.vmmv', 'vmmvkvmmv', '.vvvkvvv.', '.vpvkvpv.', 'vppvkvppv', 'vvv...vvv'] },
    { name: 'Морозиво', rows: ['...ppp...', '..ppppp..', '.ppwpppp.', '.pppppwp.', '..ppppp..', '..yyyyy..', '..ynyny..', '...yyy...', '...yny...', '....y....'] },
    { name: 'Веселка', rows: ['...rrrrrr...', '..roooooor..', '.roy yyyyor.', 'royGGGGGGyor', 'roGbbbbbbGor', 'royb....byor', 'royb....byor'].map(r => r.replace(/ /g, 'y')) },
    { name: 'Ава', rows: [
      '...............kkkkk..', '..............khkhhhk.', '..............kttkhhk.', '.............khtttkhk.', '...kkkk......khttttkk.',
      '..khhhhk.kkkkhhkttfk..', '.khhktthkhgghhhhkfhk..', 'khhkttthhhhgghthhhffk.', 'khhkttthhhthghhhhhhffk', 'khkfffhhhhhhghhkhkfkfk',
      '.k.kfhhhhkhhgghhhkffk.', '..kfhfhkhhhtkkttttkfk.', '..kffhfkhtttkktktk.k..', '..kkfhfkttkttkktk.....', '....kfk.kttkkppk......',
      '.....k...kkttppk......', '.........krkkkkr......', '........khhrrgrhk.....', '........khhhcgghk.....', '........khhhckkchk....',
      '.......khhtccggctk....', '......khhhtccccchk....', '......khkhhkccchk.....', '.....khhkhhkcckhk.....', '.....khhkhhkckhhk.....',
      '.....khhkhhkhkhkhk....', '.....khhhkhkhkhkhk....' ] }
  ];
  const picOf = lv => PICS[(lv - 1) % PICS.length];
  function setup(pic) {
    const H = pic.rows.length, W = Math.max(...pic.rows.map(r => r.length));
    const keys = []; const cells = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const ch = pic.rows[r][c] || '.'; if (ch === '.' || !COL[ch]) continue; if (!keys.includes(ch)) keys.push(ch); cells.push({ r, c, ch, n: 0, paint: null }); }
    cells.forEach(cl => cl.n = keys.indexOf(cl.ch) + 1);
    return { W, H, keys, cells };
  }
  PG.arcade.register({
    id: 'paint',
    title: 'Розмальовка',
    family: 'Спокійна',
    accent: ACCENT,
    rush: false, path: false,
    howto: ['Обери колір внизу', 'Тапай або веди пальцем по клітинках з його номером'],
    goal: lv => ({ count: setup(picOf(lv)).cells.length, unit: 'клітинок' }),
    twist: lv => `Картинка: ${picOf(lv).name}`,
    icon(ctx, x, y, r) { const c = ['#E8434F', '#F7C948', '#3E9BF0', '#4CAF50']; for (let i = 0; i < 4; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x - r * 0.8 + (i % 2) * r * 0.8, y - r * 0.8 + Math.floor(i / 2) * r * 0.8, r * 0.75, r * 0.75); } },
    create(level) {
      const pic = picOf(level), P = setup(pic);
      const s = { t: 0, sel: 0, painting: false, doneAt: -9, pulse: -9 };
      const inst = { progress: 0, over: null, stats: { level, pic: pic.name, wrong: 0 } };
      inst._s = s; s.P = P;
      const geo = A => {
        const palH = 70, cs = Math.min((A.w - 16) / P.W, (A.h - palH - 64) / P.H);
        const gw = cs * P.W, gh = cs * P.H;
        return { cs, gx: A.x + (A.w - gw) / 2, gy: A.y + 52 + (A.h - palH - 70 - gh) / 2, palY: A.y + A.h - palH - 18, palH };
      };
      function paintAt(x, y) {
        const A = PG.arena, g = geo(A);
        const c = Math.floor((x - g.gx) / g.cs), r = Math.floor((y - g.gy) / g.cs);
        const cl = P.cells.find(q => q.r === r && q.c === c); if (!cl) return;
        const want = P.keys[s.sel];
        if (cl.paint === cl.ch) return;
        if (want === cl.ch) {
          cl.paint = want; cl.at = s.t; inst.progress++;
          PG.buzz(PG.HAP.tick); PG.tone && PG.tone(500 + (inst.progress % 12) * 60, 0.06, 'sine', 0.05);
          // a colour finished?
          if (P.cells.filter(q => q.ch === want).every(q => q.paint === q.ch)) { PG.sfx.candy(); PG.reward({ score: 30, x: g.gx + (c + 0.5) * g.cs, y: g.gy + r * g.cs }); s.pulse = s.t; const nx = P.keys.findIndex(k => P.cells.some(q => q.ch === k && q.paint !== q.ch)); if (nx >= 0) s.sel = nx; }
          if (inst.progress === P.cells.length) { s.doneAt = s.t; PG.reward({ energy: 1, score: 60 }); }
        } else if (cl.paint !== want) { cl.paint = want; cl.wrong = true; cl.at = s.t; inst.stats.wrong++; PG.buzz(PG.HAP.light); PG.sfx.bad(); }
      }
      Object.assign(inst, {
        start() { s.skip = true; },
        tap(x, y) {
          if (s.skip) { s.skip = false; return; }
          const A = PG.arena, g = geo(A);
          if (y > g.palY - 6) { const n = P.keys.length, bw = Math.min(54, (A.w - 20) / n), x0 = A.x + (A.w - bw * n) / 2; const i = Math.floor((x - x0) / bw); if (i >= 0 && i < n) { s.sel = i; PG.sfx.pick(); PG.buzz(PG.HAP.tick); } return; }
          s.painting = true; paintAt(x, y);
        },
        move(x, y) { if (s.painting) paintAt(x, y); },
        up() { s.painting = false; },
        idle(dt) { s.t += dt; },
        update(dt) { s.t += dt; },
        draw(ctx, A) {
          const g = geo(A);
          ctx.fillStyle = '#F2FBF9'; ctx.fillRect(A.x, A.y, A.w, A.h);
          txt(pic.name, A.x + A.w / 2, A.y + 24, 18, '#2B6F67', { font: FD });
          const want = P.keys[s.sel], done = s.doneAt > 0, bounce = done ? 1 + Math.sin(Math.min(1, (s.t - s.doneAt) * 2) * Math.PI) * 0.06 : 1;
          ctx.save(); ctx.translate(g.gx + g.cs * P.W / 2, g.gy + g.cs * P.H / 2); ctx.scale(bounce, bounce); ctx.translate(-(g.gx + g.cs * P.W / 2), -(g.gy + g.cs * P.H / 2));
          for (const cl of P.cells) {
            const x = g.gx + cl.c * g.cs, y = g.gy + cl.r * g.cs;
            if (cl.paint === cl.ch) {
              const p = Math.min(1, (s.t - (cl.at || 0)) / 0.2), sz = g.cs * (0.6 + 0.4 * p);
              ctx.fillStyle = COL[cl.ch]; ctx.fillRect(x + (g.cs - sz) / 2, y + (g.cs - sz) / 2, sz + 0.5, sz + 0.5);
              if (!done) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1, y + 1, g.cs - 2, g.cs * 0.2); }
            } else {
              const hl = cl.ch === want;
              ctx.fillStyle = hl ? rgba(COL[cl.ch], 0.22 + 0.1 * Math.sin(s.t * 4)) : '#FFFFFF'; ctx.fillRect(x, y, g.cs, g.cs);
              if (cl.wrong && cl.paint) { ctx.fillStyle = rgba(COL[cl.paint], 0.55); ctx.fillRect(x + 2, y + 2, g.cs - 4, g.cs - 4); }
              ctx.strokeStyle = 'rgba(43,111,103,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, g.cs - 1, g.cs - 1);
              if (g.cs > 9) txt(String(cl.n), x + g.cs / 2, y + g.cs / 2 + 0.5, Math.min(14, g.cs * 0.62), hl ? '#1E4F49' : 'rgba(43,111,103,0.55)', { font: FB, weight: 900 });
            }
          }
          ctx.restore();
          // palette
          const n = P.keys.length, bw = Math.min(54, (A.w - 20) / n), x0 = A.x + (A.w - bw * n) / 2;
          P.keys.forEach((k, i) => {
            const cx = x0 + (i + 0.5) * bw, cy = g.palY + g.palH / 2, r = bw * 0.38 * (i === s.sel ? 1.12 : 1);
            const left = P.cells.filter(q => q.ch === k && q.paint !== q.ch).length;
            ctx.fillStyle = COL[k]; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = i === s.sel ? 4 : 2; ctx.strokeStyle = i === s.sel ? '#2B6F67' : 'rgba(0,0,0,0.12)'; ctx.stroke();
            txt(left ? String(i + 1) : '✓', cx, cy + 1, Math.min(16, r), ['w', 'c', 'y', 's', 'l', 'p', 'f', 'g', 't'].includes(k) ? '#2E2D37' : '#FFFFFF', { font: FD });
          });
          if (done) PG.ava.draw(ctx, A.x + A.w - 50, g.palY - 6, A.w * 0.16, { pose: 'hop', t: s.t, shadow: false });
        }
      });
      return inst;
    }
  });
})();

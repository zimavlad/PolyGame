// Піаніно — tiles fall in four lanes in the rhythm of a well-known tune. Tap each dark tile before it leaves the
// screen and the melody plays note by note. A tap on an empty lane or a tile that slips past ends the round.
// Every level is another public-domain melody (folk, Leontovych, Beethoven, Bach, Offenbach...).
(function () {
  const PG = window.PG;
  const { FD, FB, clamp, lerp, txt, rgba } = PG;
  const ACCENT = '#8E5CF7';
  // note string: NAME OCTAVE [:eighths], e.g. "E5:2 D#5 C5:4"
  const SONGS = [
    { name: 'Зірочка', by: 'народна', notes: 'C5:2 C5:2 G5:2 G5:2 A5:2 A5:2 G5:4 F5:2 F5:2 E5:2 E5:2 D5:2 D5:2 C5:4 G5:2 G5:2 F5:2 F5:2 E5:2 E5:2 D5:4' },
    { name: 'Ода до радості', by: 'Бетховен', notes: 'E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 E5:3 D5:1 D5:4 E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5:1 C5:4' },
    { name: 'Щедрик', by: 'Леонтович', notes: 'C5:2 B4:1 C5:1 A4:2 C5:2 B4:1 C5:1 A4:2 C5:2 B4:1 C5:1 A4:2 C5:2 B4:1 C5:1 A4:2 E5:2 D5:1 E5:1 C5:2 E5:2 D5:1 E5:1 C5:2 E5:2 D5:1 E5:1 C5:2 E5:2 D5:1 E5:1 C5:2 A5:1 A5:1 A5:1 G5:1 F5:1 F5:1 F5:1 E5:1 D5:1 D5:1 D5:1 C5:1 B4:1 B4:1 B4:1 A4:1' },
    { name: 'Jingle Bells', by: 'Пірпонт', notes: 'E5:2 E5:2 E5:4 E5:2 E5:2 E5:4 E5:2 G5:2 C5:3 D5:1 E5:8 F5:2 F5:2 F5:3 F5:1 F5:2 E5:2 E5:2 E5:1 E5:1 E5:2 D5:2 D5:2 E5:2 D5:4 G5:4' },
    { name: 'З днем народження', by: 'Гілл', notes: 'G4:1 G4:1 A4:2 G4:2 C5:2 B4:4 G4:1 G4:1 A4:2 G4:2 D5:2 C5:4 G4:1 G4:1 G5:2 E5:2 C5:2 B4:2 A4:4 F5:1 F5:1 E5:2 C5:2 D5:2 C5:4' },
    { name: 'До Елізи', by: 'Бетховен', notes: 'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:1 B4:3 E4:1 G#4:1 B4:1 C5:3 E4:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:1 B4:3 E4:1 C5:1 B4:1 A4:4' },
    { name: 'Тиха ніч', by: 'Грубер', notes: 'G4:3 A4:1 G4:2 E4:6 G4:3 A4:1 G4:2 E4:6 D5:4 D5:2 B4:6 C5:4 C5:2 G4:6 A4:4 A4:2 C5:3 B4:1 A4:2 G4:3 A4:1 G4:2 E4:6' },
    { name: 'Канкан', by: 'Оффенбах', notes: 'C5:2 D5:1 F5:1 E5:1 D5:1 G5:2 G5:2 G5:2 A5:1 E5:1 F5:1 D5:1 D5:2 D5:2 D5:2 F5:1 E5:1 D5:1 C5:1 C6:1 B5:1 A5:1 G5:1 F5:1 E5:1 D5:1 C5:2 D5:1 F5:1 E5:1 D5:1 G5:2 G5:2 G5:2 A5:1 E5:1 F5:1 D5:1 D5:2 D5:1 G5:1 D5:1 E5:1 C5:2' },
    { name: 'Менует', by: 'Бах', notes: 'D5:2 G4:1 A4:1 B4:1 C5:1 D5:2 G4:2 G4:2 E5:2 C5:1 D5:1 E5:1 F#5:1 G5:2 G4:2 G4:2 C5:2 D5:1 C5:1 B4:1 A4:1 B4:2 C5:1 B4:1 A4:1 G4:1 F#4:2 G4:1 A4:1 B4:1 G4:1 A4:4' }
  ];
  const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function parse(str) {
    return str.trim().split(/\s+/).map(tok => {
      const [n, d] = tok.split(':'), m = n.match(/^([A-G]#?)(\d)$/);
      const midi = 12 * (Number(m[2]) + 1) + SEMI[m[1]];
      return { midi, f: 440 * Math.pow(2, (midi - 69) / 12), len: Number(d || 1) };
    });
  }
  // a soft piano-ish voice: a decaying triangle with a few quiet harmonics
  function play(f, v = 1) {
    if (!PG.tone) return;
    PG.tone(f, 0.9, 'triangle', 0.13 * v); PG.tone(f * 2, 0.5, 'sine', 0.04 * v); PG.tone(f * 3, 0.25, 'sine', 0.018 * v); PG.tone(f / 2, 0.6, 'sine', 0.03 * v);
  }
  // lanes follow the melody's shape: higher notes lean right, repeated notes keep moving so tiles never stack
  function lanes(notes) {
    let prev = -1;
    return notes.map((n, i) => {
      const prevN = notes[i - 1];
      let l = prev < 0 ? 1 : n.midi > prevN.midi ? prev + 1 : n.midi < prevN.midi ? prev - 1 : prev + (i % 2 ? 1 : -1);
      if (l > 3) l = 1; if (l < 0) l = 2;
      if (l === prev) l = (l + 2) % 4;
      prev = l; return l;
    });
  }
  PG.arcade.register({
    id: 'piano',
    title: 'Піаніно',
    family: 'Музика',
    accent: ACCENT,
    howto: ['Тапай чорні плитки знизу вгору', 'Не пропускай і не тапай повз'],
    goal: lv => ({ count: parse(SONGS[(lv - 1) % SONGS.length].notes).length, unit: 'нот' }),
    twist: lv => { const sg = SONGS[(lv - 1) % SONGS.length]; return `«${sg.name}»${lv > 1 ? ' · швидше' : ''}`; },
    icon(ctx, x, y, r) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 1 ? '#27303F' : '#FFFFFF'; ctx.fillRect(x - r + i * r * 0.68, y - r * 0.8, r * 0.6, r * 1.6); } },
    create(level) {
      const song = SONGS[(level - 1) % SONGS.length], notes = parse(song.notes), ln = lanes(notes);
      // rows: each note starts at the running sum of eighth lengths; speed in eighths per second
      let acc = 0; const tiles = notes.map((n, i) => { const t = { at: acc, lane: ln[i], n, hit: false }; acc += n.len; return t; });
      const lap = Math.floor((level - 1) / SONGS.length);
      const speed0 = Math.min(3.2 + (level - 1) * 0.22 + lap * 0.5, 7);
      const s = { t: 0, pos: -4, speed: speed0, next: 0, flash: [], miss: null, started: false, glow: 0 };
      const inst = { progress: 0, over: null, stats: { level, song: song.name } };
      inst._s = s; s.tiles = tiles;
      const ROW = A => A.h / 7.5; // height of one eighth
      const tileY = (A, tl) => A.y + A.h - 24 - (tl.at - s.pos) * ROW(A); // bottom edge of the tile
      function fail(lane, A, why) {
        s.miss = { lane, t: s.t, why }; inst.over = { won: false, cause: why };
        PG.tone && PG.tone(130, 0.5, 'sawtooth', 0.06); PG.tone && PG.tone(138, 0.5, 'sawtooth', 0.05);
        PG.buzz(PG.HAP.thud); PG.shake(5);
      }
      Object.assign(inst, {
        start() { s.started = true; s.skip = true; }, // the tap that starts the round is not a note
        tap(x, y) {
          const A = PG.arena; if (inst.over) return;
          if (s.skip) { s.skip = false; return; }
          const lane = clamp(Math.floor((x - A.x) / (A.w / 4)), 0, 3);
          const tl = tiles[s.next]; if (!tl) return;
          const h = ROW(A) * Math.max(1, Math.min(tl.n.len, 2)) * 0.98, yb = tileY(A, tl), yt = yb - h;
          if (lane === tl.lane && y > yt - ROW(A) * 1.2 && yb > A.y + A.h * 0.15) {
            tl.hit = true; tl.hitAt = s.t; s.next++; inst.progress++;
            play(tl.n.f); PG.buzz(PG.HAP.tick); s.glow = 1;
            PG.burst(A.x + (lane + 0.5) * A.w / 4, yb - h / 2, ACCENT, 6, 120);
            if (inst.progress % 10 === 0) PG.reward({ energy: 1, score: 20, x: A.x + (lane + 0.5) * A.w / 4, y: yb - h });
            else PG.reward({ score: 5 });
            // the tune catches up: if the player is ahead, scroll a little faster
            if (yb < A.y + A.h * 0.5) s.pos += 0.15;
          } else if (!tiles.slice(s.next, s.next + 3).some(t => t.lane === lane && Math.abs(tileY(A, t) - y) < ROW(A) * 2)) fail(lane, A, 'wrong');
        },
        idle(dt) { s.t += dt; },
        update(dt, A) {
          s.t += dt; s.glow = Math.max(0, s.glow - dt * 3);
          if (inst.over) return;
          s.speed = speed0 * (1 + 0.25 * inst.progress / notes.length);
          s.pos += s.speed * dt;
          const tl = tiles[s.next];
          if (tl && tileY(A, tl) > A.y + A.h + 4) fail(tl.lane, A, 'missed');
        },
        draw(ctx, A) {
          const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, '#F4EFFF'); g.addColorStop(1, '#D8C9FF');
          ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h);
          const lw = A.w / 4;
          for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(94,64,170,0.18)'; ctx.fillRect(A.x + i * lw - 0.5, A.y, 1, A.h); }
          // the song title and the big counter
          txt(String(inst.progress), A.x + A.w / 2, A.y + A.h * 0.2, Math.min(80, A.w * 0.22), rgba('#7B5BD6', 0.14 + s.glow * 0.12), { font: FD });
          txt(song.name, A.x + A.w / 2, A.y + 22, 15, '#4A3A86', { font: FD });
          txt(song.by, A.x + A.w / 2, A.y + 42, 11, 'rgba(74,58,134,0.6)', { font: FB, weight: 800 });
          // hit line glow
          ctx.fillStyle = rgba('#8E5CF7', 0.2 + s.glow * 0.35); ctx.fillRect(A.x, A.y + A.h - 24 - 3, A.w, 6);
          for (let i = s.next - 6; i < tiles.length; i++) {
            if (i < 0) continue;
            const tl = tiles[i], h = ROW(A) * Math.max(1, Math.min(tl.n.len, 2)) * 0.98, yb = tileY(A, tl), yt = yb - h;
            if (yb < A.y - 4) break; if (yt > A.y + A.h) continue;
            const x = A.x + tl.lane * lw + 3, w = lw - 6;
            if (tl.hit) {
              const p = Math.min(1, (s.t - tl.hitAt) / 0.35);
              ctx.fillStyle = rgba('#9B7BFF', 0.5 * (1 - p)); PG.rrect(x - p * 4, yt - p * 4, w + p * 8, h + p * 8, 10); ctx.fill();
              continue;
            }
            const tg = ctx.createLinearGradient(0, yt, 0, yb); tg.addColorStop(0, '#2A2148'); tg.addColorStop(1, '#4B3B8F');
            ctx.fillStyle = tg; PG.rrect(x, yt, w, h, 10); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.14)'; PG.rrect(x + 6, yt + 5, w - 12, 5, 3); ctx.fill();
            if (i === s.next) { ctx.strokeStyle = rgba('#F5B12E', 0.6 + 0.4 * Math.sin(s.t * 10)); ctx.lineWidth = 2.5; PG.rrect(x, yt, w, h, 10); ctx.stroke(); if (!s.started || inst.progress === 0) txt('ТАП', x + w / 2, yt + h / 2, 14, '#FFFFFF', { font: FD }); }
          }
          if (s.miss) { ctx.fillStyle = rgba('#F2615E', 0.45 * (0.5 + 0.5 * Math.sin(s.t * 18))); ctx.fillRect(A.x + s.miss.lane * lw, A.y, lw, A.h); }
        }
      });
      return inst;
    }
  });
})();

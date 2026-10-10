// Turns collector logs into a play report.
//   node analyze.mjs 2026-10-09.jsonl [more.jsonl ...]
//   curl -sH "Authorization: Bearer $POLYGAME_LOG_TOKEN" "$POLYGAME_LOG_URL/logs?day=2026-10-09" | node analyze.mjs

import fs from 'node:fs';

const files = process.argv.slice(2);
const raw = files.length ? files.map(f => fs.readFileSync(f, 'utf8')).join('\n') : fs.readFileSync(0, 'utf8');

// Batches can arrive twice (fetch + beacon), so events are keyed by session id + sequence.
const seen = new Set(), events = [], devices = new Map();
let batches = 0;
for (const line of raw.split('\n')) {
  if (!line.trim()) continue;
  let b; try { b = JSON.parse(line); } catch { continue; }
  batches++;
  if (b.did && !devices.has(b.did)) devices.set(b.did, { ua: b.ua, builds: new Set() });
  if (b.did) devices.get(b.did).builds.add(b.build);
  for (const e of b.events || []) {
    const k = e.s + ':' + e.i;
    if (seen.has(k)) continue;
    seen.add(k); events.push({ ...e, did: b.did });
  }
}
events.sort((a, b) => a.t - b.t);

const by = type => events.filter(e => e.e === type);
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = v => Math.round(v * 10) / 10;
const count = (arr, f) => arr.reduce((m, e) => { const k = f(e); m[k] = (m[k] || 0) + 1; return m; }, {});
const line = (k, v) => console.log(`  ${k.padEnd(28)} ${v}`);
const head = t => console.log(`\n== ${t}`);
const platform = ua => /iPhone|iPad|iPod/.test(ua || '') ? 'iOS ' + ((ua.match(/OS (\d+)_/) || [])[1] || '?') : /Android/.test(ua || '') ? 'Android' : 'desktop';

head('Overview');
line('batches / events', `${batches} / ${events.length}`);
line('devices / sessions', `${devices.size} / ${new Set(events.map(e => e.s)).size}`);
if (events.length) line('time span', `${new Date(events[0].t).toISOString()} → ${new Date(events.at(-1).t).toISOString()}`);

head('Devices');
for (const s of by('start')) {
  line(s.did?.slice(0, 8) || '?', `${platform(s.ua)} · ${s.vw}x${s.vh}@${s.dpr} · ${s.standalone ? 'home-screen app' : 'browser'} · vibrate:${s.vibrate ? 'yes' : 'no'} · build ${s.build}`);
}

const games = by('game_over'), quits = by('game_quit');
head(`Games (${by('game_start').length} started, ${games.length} finished, ${quits.length} left midway)`);
if (games.length) {
  const sc = games.map(g => g.score), dur = games.map(g => g.sec);
  line('score avg / median / max', `${Math.round(avg(sc))} / ${pct(sc, 0.5)} / ${Math.max(...sc)}`);
  line('length, minutes avg / max', `${r1(avg(dur) / 60)} / ${r1(Math.max(...dur) / 60)}`);
  line('moves per game', r1(avg(games.map(g => g.places))));
  line('lines per game', r1(avg(games.map(g => g.lines))));
  line('chains / loops per game', `${r1(avg(games.map(g => g.chains)))} / ${r1(avg(games.map(g => g.loops)))}`);
  line('arcade rounds per game', r1(avg(games.map(g => g.rushes))));
  line('board fill at the end', `${Math.round(avg(games.map(g => g.fill)) * 100)}%`);
  line('energy left at the end', r1(avg(games.map(g => g.energy))));
}
if (quits.length) line('left midway: score avg / moves', `${Math.round(avg(quits.map(g => g.score)))} / ${r1(avg(quits.map(g => g.places)))}`);

head('Puzzle');
const places = by('place'), backs = by('drop_back');
line('pieces placed', places.length);
line('drops that bounced back', `${backs.length} (${Math.round(backs.length / Math.max(1, places.length + backs.length) * 100)}% of attempts)`);
line('median drag time, ms', pct(places.map(p => p.ms || 0), 0.5));
const clears = by('clear');
line('clear events', clears.length);
line('multi-clears (2+ groups)', clears.filter(c => c.k > 1).length);
line('mono clears', clears.reduce((s, c) => s + (c.mono || 0), 0));
line('best combo streak', Math.max(0, ...clears.map(c => c.streak || 0)));
line('rows / cols / boxes', `${clears.reduce((s, c) => s + (c.rows || 0), 0)} / ${clears.reduce((s, c) => s + (c.cols || 0), 0)} / ${clears.reduce((s, c) => s + (c.boxes || 0), 0)}`);
const chains = by('chain');
line('chains / loops', `${chains.filter(c => !c.loop).length} / ${chains.filter(c => c.loop).length}`);
line('chain tried with 0 energy', by('chain_fail').length);
line('"pieces do not fit" warnings', by('stuck').length);
const popular = Object.entries(count(places, p => p.p)).sort((a, b) => b[1] - a[1]).slice(0, 5);
line('most placed shapes', popular.map(([k, v]) => `${k}×${v}`).join(', '));

head('Level path');
const lstart = by('level_start'), lend = by('level_end');
line('levels started / finished', `${lstart.length} / ${lend.length}`);
if (lend.length) {
  const byN = {};
  for (const e of lend) { const k = e.n; byN[k] = byN[k] || { tries: 0, won: 0, moves: [], reasons: {} }; byN[k].tries++; if (e.won) { byN[k].won++; byN[k].moves.push(e.movesLeft); } else byN[k].reasons[e.reason || '?'] = (byN[k].reasons[e.reason || '?'] || 0) + 1; }
  for (const [n, v] of Object.entries(byN).sort((a, b) => a[0] - b[0])) {
    line(`level ${n}`, `${v.won}/${v.tries} won · moves left avg ${v.moves.length ? r1(avg(v.moves)) : '-'} · fails ${JSON.stringify(v.reasons)}`);
  }
  line('revives used', by('level_revive').length);
  line('furthest level reached', Math.max(0, ...lstart.map(e => e.n)));
}

head('Arcade games');
const ae = by('arcade_end');
const byGame = {};
for (const e of ae) { byGame[e.id] = byGame[e.id] || []; byGame[e.id].push(e); }
for (const [id, list] of Object.entries(byGame)) {
  const won = list.filter(e => e.won).length;
  line(id, `${won}/${list.length} won · max level ${Math.max(...list.map(e => e.level))} · progress ${r1(avg(list.map(e => e.progress / Math.max(1, e.goal))) * 100)}% of goal · ${r1(avg(list.map(e => e.sec)))} s · causes ${JSON.stringify(count(list.filter(e => !e.won), e => e.cause || '?'))}`);
}
if (!ae.length) console.log('  none');

head('Ad mini-games');
const shows = by('ad_show'), dones = by('ad_done'), closes = by('ad_close');
line('shown / finished / closed', `${shows.length} / ${dones.length} / ${closes.length}`);
const adBy = {};
for (const e of dones) { adBy[e.id] = adBy[e.id] || { won: 0, n: 0 }; adBy[e.id].n++; if (e.won) adBy[e.id].won++; }
for (const [id, v] of Object.entries(adBy)) line(id, `${v.won}/${v.n} won`);
line('closed before finishing', closes.filter(e => !e.won).length);
line('reasons', JSON.stringify(count(shows, e => e.reason)));

head('Spike Rush (old builds)');
const dt = by('dtts_end');
if (dt.length) {
  line('rounds / won', `${dt.length} / ${dt.filter(d => d.won).length}`);
  line('bounces avg / max', `${r1(avg(dt.map(d => d.touches)))} / ${Math.max(...dt.map(d => d.touches))}`);
  line('candies per round', r1(avg(dt.map(d => d.candies))));
  line('deaths by cause', JSON.stringify(count(dt.filter(d => !d.won), d => d.cause || '?')));
  line('rounds dead in < 2 bounces', dt.filter(d => !d.won && d.touches < 2).length);
}

head('Stack (old builds)');
const st = by('stack_end');
if (st.length) {
  line('rounds / won', `${st.length} / ${st.filter(d => d.won).length}`);
  line('floors avg / max', `${r1(avg(st.map(d => d.level)))} / ${Math.max(...st.map(d => d.level))}`);
  line('perfect drops per round', r1(avg(st.map(d => d.perfects))));
}

head('Performance');
const perf = by('perf');
if (perf.length) {
  const fps = perf.map(p => p.fps);
  line('fps p10 / median', `${pct(fps, 0.1)} / ${pct(fps, 0.5)}`);
  line('frames over 50 ms', perf.reduce((s, p) => s + (p.long || 0), 0));
}

head('Settings and lifecycle');
line('toggles', JSON.stringify(count(by('toggle'), t => `${t.what}:${t.on ? 'on' : 'off'}`)));
line('app hidden (backgrounded)', by('vis').filter(v => v.h).length);
line('self-updates applied', by('update').length);

head('Errors');
const errs = by('err');
if (!errs.length) console.log('  none');
for (const [m, n] of Object.entries(count(errs, e => `${e.m} @${e.src}:${e.l}`)).sort((a, b) => b[1] - a[1])) line(`${n}×`, m);
console.log('');

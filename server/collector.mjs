// PolyGame play-log collector. Node 22, no dependencies.
//
//   POST /e            batch of events from the game (text/plain JSON, no preflight)
//   GET  /health       liveness for the proxy
//   GET  /days         list of stored days            (Authorization: Bearer READ_TOKEN)
//   GET  /logs?day=…   one day as JSON lines          (Authorization: Bearer READ_TOKEN)
//
// Each stored line is one batch: { rt, ip (salted hash), ua, build, did, events: [...] }.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT) || 8080;
const DATA = process.env.DATA_DIR || '/data';
const READ_TOKEN = process.env.READ_TOKEN || '';
const SALT = process.env.IP_SALT || crypto.randomBytes(16).toString('hex');
const MAX_BODY = 256 * 1024;          // one batch
const MAX_DAY_BYTES = 200 * 1024 ** 2; // per day file, so a flood cannot fill the disk
const MAX_EVENTS = 500;

fs.mkdirSync(DATA, { recursive: true });
if (!READ_TOKEN) console.warn('READ_TOKEN is not set: /days and /logs will refuse every request');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
const send = (res, code, body = '', headers = {}) => { res.writeHead(code, { ...CORS, ...headers }); res.end(body); };
const today = () => new Date().toISOString().slice(0, 10);
const dayFile = d => path.join(DATA, d + '.jsonl');

// 120 batches per minute per address is far above what one player sends.
const hits = new Map();
function limited(ip) {
  const t = Date.now();
  let h = hits.get(ip);
  if (!h || t > h.reset) { h = { n: 0, reset: t + 60_000 }; hits.set(ip, h); }
  return ++h.n > 120;
}
setInterval(() => { const t = Date.now(); for (const [k, h] of hits) if (t > h.reset) hits.delete(k); }, 60_000).unref();

function authed(req) {
  if (!READ_TOKEN) return false;
  const got = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(READ_TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const clip = (v, n) => String(v ?? '').slice(0, n);

function ingest(req, res) {
  const ip = clientIp(req);
  if (limited(ip)) { req.resume(); return send(res, 429, 'slow down'); }
  const chunks = [];
  let size = 0, aborted = false;
  req.on('data', c => {
    size += c.length;
    if (size > MAX_BODY) { aborted = true; send(res, 413, 'too large'); req.destroy(); }
    else chunks.push(c);
  });
  req.on('error', () => {});
  req.on('end', () => {
    if (aborted) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, 'bad json'); }
    if (!body || !Array.isArray(body.events) || !body.events.length) return send(res, 400, 'no events');
    const events = body.events.filter(e => e && typeof e === 'object' && !Array.isArray(e)).slice(0, MAX_EVENTS);
    const rec = {
      rt: new Date().toISOString(),
      ip: crypto.createHash('sha256').update(SALT + ip).digest('hex').slice(0, 12),
      ua: clip(req.headers['user-agent'], 300),
      build: clip(body.build, 20),
      did: clip(body.did, 40),
      events
    };
    const file = dayFile(today());
    fs.stat(file, (_, st) => {
      if (st && st.size > MAX_DAY_BYTES) return send(res, 507, 'day full');
      fs.appendFile(file, JSON.stringify(rec) + '\n', err => send(res, err ? 500 : 204));
    });
  });
}

function readDays(req, res) {
  if (!authed(req)) return send(res, 401, 'unauthorized');
  const days = fs.readdirSync(DATA).filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()
    .map(f => ({ day: f.slice(0, 10), bytes: fs.statSync(path.join(DATA, f)).size }));
  send(res, 200, JSON.stringify(days), { 'Content-Type': 'application/json' });
}

function readLogs(req, res, url) {
  if (!authed(req)) return send(res, 401, 'unauthorized');
  const d = url.searchParams.get('day') || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return send(res, 400, 'bad day');
  const file = dayFile(d);
  if (!fs.existsSync(file)) return send(res, 200, '', { 'Content-Type': 'application/x-ndjson' });
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/x-ndjson' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method === 'POST' && url.pathname === '/e') return ingest(req, res);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, '{"ok":true}', { 'Content-Type': 'application/json' });
  if (req.method === 'GET' && url.pathname === '/days') return readDays(req, res);
  if (req.method === 'GET' && url.pathname === '/logs') return readLogs(req, res, url);
  send(res, 404, 'not found');
}).listen(PORT, () => console.log(`polygame collector on :${PORT}, data in ${DATA}`));

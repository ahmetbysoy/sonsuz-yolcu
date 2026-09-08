#!/usr/bin/env node
/* ============================================================
   SONSUZ YOLCU — Faz 2 Sunucusu (Firebase RTDB entegreli)
   - Statik client + REST API (tek port, sıfır bağımlılık)
   - Kalıcı depo: Firebase Realtime Database (REST üzerinden)
     * Oyun verisi İZOLE: /sonsuzYolcu/users/{uid}  (diğer verilere dokunmaz)
   - Yerel JSON dosya = offline yedek depo (Firebase erişilemezse oyun devam eder)
   - Uyku kazanci SUNUCU TARAFINDA (kural: %10 hız, 8 saat tavan)
   - Anti-hile: artış kelepçesi + bayrak
   Ortam değişkenleri:
     PORT=8000
     FIREBASE_DB=https://...firebasedatabase.app   (farklı db istenirse)
     FIREBASE_AUTH=<secret>                         (kilitli db için opsiyonel)
   ============================================================ */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8000);
const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ---------- Oyun sabitleri (TASARIM.md 4.3) ---------- */
const SLEEP_CAP_S = 8 * 3600;
const SLEEP_RATE = 0.10;
const ACTIVE_WINDOW_S = 60;
const MAX_INC_PER_S = 45;
const MAX_SPARK_INC_PER_S = 40;

/* ---------- Firebase RTDB (REST, sıfır SDK) ---------- */
const FIREBASE_DB = (process.env.FIREBASE_DB || 'https://liqidasyon-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/+$/, '');
const FB_NS = '/sonsuzYolcu'; // izolasyon: kullanıcının diğer düğümlerine dokunulmaz
const FB_AUTH = process.env.FIREBASE_AUTH || '';

function fbUrl(p) {
  return `${FIREBASE_DB}${FB_NS}${p}.json${FB_AUTH ? `?auth=${encodeURIComponent(FB_AUTH)}` : ''}`;
}
function rtdb(method, p, body) {
  return new Promise((resolve) => {
    try {
      const u = new URL(fbUrl(p));
      const data = body ? JSON.stringify(body) : null;
      const req = https.request(u, {
        method,
        headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0 },
        timeout: 3500
      }, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          let out = null;
          try { out = buf ? JSON.parse(buf) : null; } catch (e) { out = null; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: out });
        });
      });
      req.on('timeout', () => req.destroy(new Error('rtdb timeout')));
      req.on('error', () => resolve({ ok: false, data: null }));
      if (data) req.write(data);
      req.end();
    } catch (e) { resolve({ ok: false, data: null }); }
  });
}

/* ---------- Depo: bellek önbellek + RTDB + yerel dosya yedeği ---------- */
const mem = new Map();           // uid -> kullanıcı (canlı önbellek)
let fileDb = { users: {} };      // offline yedek
try { const raw = fs.readFileSync(DB_FILE, 'utf8'); fileDb = JSON.parse(raw); if (!fileDb.users) fileDb.users = {}; } catch (e) {}
function writeDbFile() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(fileDb));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('yerel db yazılamadı:', e.message); }
}

const defaultUser = () => ({
  totalDist: 0, sparks: 0, best: 0, level: 1,
  lastSpeed: 8, lastSeen: Date.now(), updatedAt: Date.now(),
  flagCount: 0, adopted: false, createdAt: Date.now()
});

/* Kalıcılık: bellek + yerel dosya + Firebase (await'li PUT — kayıt kaybı yarışı olmasın) */
async function persistUser(id, u) {
  mem.set(id, u);
  fileDb.users[id] = u;
  writeDbFile();
  const r = await rtdb('PUT', `/users/${encodeURIComponent(id)}`, u);
  if (!r.ok) console.warn('⚠ Firebase yazılamadı — yerel depoda devam');
  return r;
}

async function getUser(id) {
  if (mem.has(id)) return mem.get(id);
  // 1) Firebase
  const r = await rtdb('GET', `/users/${encodeURIComponent(id)}`);
  if (r.ok && r.data && typeof r.data === 'object' && Number.isFinite(r.data.createdAt)) {
    const u = Object.assign(defaultUser(), r.data);
    mem.set(id, u);
    return u;
  }
  // 2) yerel yedek
  if (fileDb.users[id]) {
    const u = Object.assign(defaultUser(), fileDb.users[id]);
    mem.set(id, u);
    return u;
  }
  // 3) yeni oyuncu
  const u = defaultUser();
  await persistUser(id, u);
  return u;
}

/* Uyku kazancı — kapanış sonrası ilk /load'da hesaplanır */
function applySleep(u) {
  const now = Date.now();
  const gapS = (now - u.lastSeen) / 1000;
  if (gapS < ACTIVE_WINDOW_S) return { gain: 0, sleptS: 0 };
  const cappedS = Math.min(gapS, SLEEP_CAP_S);
  const gain = Math.floor(cappedS * u.lastSpeed * SLEEP_RATE);
  u.totalDist += gain;
  u.lastSeen = now;
  u.updatedAt = now;
  return { gain, sleptS: Math.floor(cappedS) };
}

const clampNum = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) return a; return Math.max(a, Math.min(b, v)); };

/* ---------- API ---------- */
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function handleApi(req, res, pathname, query) {
  /* GET /api/load?userId=xxx */
  if (pathname === '/api/load' && req.method === 'GET') {
    const uid = String(query.userId || '').slice(0, 64);
    if (!uid) return json(res, 400, { ok: false, error: 'userId gerekli' });
    const u = await getUser(uid);
    const sleep = applySleep(u);
    await persistUser(uid, u);
    json(res, 200, {
      ok: true, serverTime: Date.now(),
      totalDist: Math.floor(u.totalDist), sparks: Math.floor(u.sparks),
      best: Math.floor(u.best), level: u.level,
      sleepGain: sleep.gain, sleptS: sleep.sleptS,
      flagged: u.flagCount > 0
    });
    return;
  }

  /* POST /api/save {userId,total,sparks,speed,level} */
  if (pathname === '/api/save' && req.method === 'POST') {
    const b = await readBody(req);
    const uid = String(b.userId || '').slice(0, 64);
    if (!uid) return json(res, 400, { ok: false, error: 'userId gerekli' });
    const u = await getUser(uid);
    const now = Date.now();
    const elapsedS = Math.max(0.001, (now - u.updatedAt) / 1000);

    let total = clampNum(b.total, 0, 1e12);
    let flaggedNow = false;

    if (!u.adopted) {
      // İlk temas: yerel geçmişi aynen benimse (kural #1)
      u.adopted = true;
      if (total > u.totalDist) u.totalDist = Math.floor(total);
      if (b.sparks > u.sparks) u.sparks = Math.floor(clampNum(b.sparks, 0, 1e9));
    } else {
      const inc = total - u.totalDist;
      const maxInc = Math.max(50, elapsedS * MAX_INC_PER_S);
      if (inc > maxInc) { total = u.totalDist + maxInc; u.flagCount++; flaggedNow = true; }
      if (total < u.totalDist) total = u.totalDist;
      const sparkInc = clampNum(b.sparks, 0, 1e9) - u.sparks;
      if (sparkInc > elapsedS * MAX_SPARK_INC_PER_S) { u.sparks += Math.floor(elapsedS * MAX_SPARK_INC_PER_S); u.flagCount++; flaggedNow = true; }
      else if (sparkInc > 0) u.sparks = Math.floor(clampNum(b.sparks, 0, 1e9));
    }

    u.totalDist = Math.floor(total);
    u.best = Math.max(u.best, u.totalDist);
    u.level = clampNum(b.level, 1, 10000) | 0;
    u.lastSpeed = clampNum(b.speed, 2, 40);
    u.lastSeen = now;
    u.updatedAt = now;
    await persistUser(uid, u);
    json(res, 200, { ok: true, total: u.totalDist, best: u.best, flagged: flaggedNow });
    return;
  }

  /* POST /api/heartbeat {userId} */
  if (pathname === '/api/heartbeat' && req.method === 'POST') {
    const b = await readBody(req);
    const uid = String(b.userId || '').slice(0, 64);
    if (!uid) return json(res, 400, { ok: false });
    const u = await getUser(uid);
    u.lastSeen = Date.now();
    u.updatedAt = u.lastSeen;
    await persistUser(uid, u);
    json(res, 200, { ok: true, serverTime: Date.now() });
    return;
  }

  json(res, 404, { ok: false, error: 'bilinmeyen endpoint' });
}

/* ---------- Statik dosya ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon'
};
function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(CLIENT_DIR, rel));
  if (!filePath.startsWith(CLIENT_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.png' || ext === '.ogg' ? 'public, max-age=86400' : 'no-cache'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  try {
    if (pathname.startsWith('/api/')) { await handleApi(req, res, pathname, query); return; }
    serveStatic(res, pathname);
  } catch (e) {
    console.error('istek hatası:', e);
    try { json(res, 500, { ok: false, error: 'sunucu hatası' }); } catch (_) {}
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Sonsuz Yolcu: http://0.0.0.0:${PORT}`);
  console.log(`🔥 Firebase: ${FIREBASE_DB}${FB_NS}`);
});

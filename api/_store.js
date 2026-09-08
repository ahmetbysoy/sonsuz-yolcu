#!/usr/bin/env node
/* ============================================================
   SONSUZ YOLCU — paylaşılan store (Vercel serverless + lokal)
   Firebase RTDB (REST) kalıcı depo · oyun verisi: /sonsuzYolcu/users/{uid}
   ============================================================ */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const FIREBASE_DB = (process.env.FIREBASE_DB || 'https://liqidasyon-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/+$/, '');
const FB_NS = '/sonsuzYolcu';
const FB_AUTH = process.env.FIREBASE_AUTH || '';

/* Oyun sabitleri (TASARIM.md 4.3) */
const SLEEP_CAP_S = 8 * 3600;
const SLEEP_RATE = 0.10;
const ACTIVE_WINDOW_S = 60;
const MAX_INC_PER_S = 45;
const MAX_SPARK_INC_PER_S = 40;

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

/* Bellek önbelleği (warm instance'lar için) + opsiyonel yerel dosya yedeği */
const mem = new Map();
const CAN_WRITE_FS = (() => {
  try { fs.mkdirSync(require('os').tmpdir(), { recursive: true }); return true; } catch (e) { return false; }
})();
function tryLocalBackup(id, u) {
  if (!CAN_WRITE_FS) return;
  try {
    const dir = process.env.SY_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'db.json');
    let db = {};
    try { db = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
    if (!db.users) db.users = {};
    db.users[id] = u;
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, f);
  } catch (e) { /* Vercel'de salt-okunur FS → sessizce geç, Firebase esas depo */ }
}

const defaultUser = () => ({
  totalDist: 0, sparks: 0, best: 0, level: 1,
  lastSpeed: 8, lastSeen: Date.now(), updatedAt: Date.now(),
  flagCount: 0, adopted: false, createdAt: Date.now()
});

async function getUser(id) {
  if (mem.has(id)) return mem.get(id);
  const r = await rtdb('GET', `/users/${encodeURIComponent(id)}`);
  if (r.ok && r.data && typeof r.data === 'object' && Number.isFinite(r.data.createdAt)) {
    const u = Object.assign(defaultUser(), r.data);
    mem.set(id, u);
    return u;
  }
  const u = defaultUser();
  mem.set(id, u);
  return u;
}

/* await'li kalıcılık: PUT tamamlanmadan handler dönmesin (kayıt kaybı yarışı bug'ıydı) */
async function persistUser(id, u) {
  mem.set(id, u);
  const r = await rtdb('PUT', `/users/${encodeURIComponent(id)}`, u);
  if (!r.ok) console.warn('⚠ Firebase yazılamadı — yerel yedeğe bakılıyor');
  tryLocalBackup(id, u);
  return r;
}

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

/* ---- HTTP yardımcıları ---- */
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}
function corsPreflight(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function parseQuery(req) {
  try { return Object.fromEntries(new URL(req.url, 'http://x').searchParams); }
  catch (e) { return {}; }
}

module.exports = {
  FIREBASE_DB, FB_NS,
  SLEEP_CAP_S, SLEEP_RATE, ACTIVE_WINDOW_S, MAX_INC_PER_S, MAX_SPARK_INC_PER_S,
  rtdb, getUser, persistUser, applySleep, clampNum,
  json, corsPreflight, readBody, parseQuery
};

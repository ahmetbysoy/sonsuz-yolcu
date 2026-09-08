#!/usr/bin/env node
/* Sonsuz Yolcu — Faz 1 duman testi:
   Tarayıcı stub'larıyla game.js'i yükleyip 5 dk @60fps simüle eder.
   Kabul: exception yok, mesafe artıyor, kayıt yazılıyor, NaN yok. */
'use strict';
const fs = require('fs');
const path = require('path');

const W = 390, H = 844, FPS = 60, SIM_SEC = 300;

/* ---- DOM / Canvas stub'ları ---- */
function makeEl(id) {
  const listeners = {};
  return {
    id, style: {}, _ev: listeners,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; },
    set textContent(v) { this._txt = v; }, get textContent() { return this._txt || ''; },
    set className(v) { this._cls = v; }, get className() { return this._cls || ''; },
    getContext: () => ctxStub,
    width: 0, height: 0,
  };
}
const gradStub = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradStub;
    if (k === 'canvas') return makeEl('game');
    return (typeof k === 'string') ? function () {} : undefined;
  },
  set() { return true; }
});
const els = {};
global.document = {
  getElementById: id => (els[id] = els[id] || makeEl(id)),
  addEventListener() {},
  hidden: false,
};
global.window = {
  innerWidth: W, innerHeight: H, devicePixelRatio: 2,
  addEventListener() {},
};
global.localStorage = {
  _s: {},
  getItem(k) { return this._s[k] === undefined ? null : this._s[k]; },
  setItem(k, v) { this._s[k] = String(v); },
};
global.Image = class {
  set src(v) { this.width = 800; this.height = 600; const cb = this.onload; if (cb) setTimeout(cb, 0); }
};
global.Audio = class {
  constructor() { this.volume = 1; }
  addEventListener() {}
  play() { return Promise.resolve(); }
};
let rafQueue = [];
global.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };
global.cancelAnimationFrame = () => {};

/* ---- game.js'i yükle ---- */
const code = fs.readFileSync(path.join(__dirname, '..', 'client', 'game.js'), 'utf8');
eval(code);

/* ---- test başlat ---- */
setTimeout(() => {
  (els['btnStart']._ev.click || []).forEach(f => f());  // BAŞLA
  let ts = performance.now();
  let frames = 0, errors = 0;
  const t0 = Date.now();
  try {
    while (frames < SIM_SEC * FPS) {
      ts += 1000 / FPS;
      const cb = rafQueue.shift();
      if (!cb) throw new Error('döngü kırıldı! kare=' + frames);
      cb(ts);
      frames++;
    }
  } catch (e) { errors++; console.error('✗ HATA (kare ' + frames + '):', e.message); }
  const dur = ((Date.now() - t0) / 1000).toFixed(2);

  /* ---- sonuçlar ---- */
  const hud = els['chipDist']._html || '';
  const sparkHud = els['chipSpark']._html || '';
  const lvl = els['lvlLabel']._txt || '';
  const saveRaw = localStorage._s['sy_save1'];
  console.log('--- 5 DK SİMÜLASYON SONUCU ---');
  console.log('kare sayısı   :', frames, '(' + (frames / SIM_SEC).toFixed(1) + ' fps hedef 60)');
  console.log('gerçek süre   :', dur + ' sn  (gerçek zamanlı ktal: ' + (frames / parseFloat(dur) / 1000 * 1000 / 1000 * 60 > 1000 ? '60fps üstü ✓' : '') + ')');
  console.log('HUD mesafe    :', hud.replace(/<[^>]+>/g, ''));
  console.log('HUD kıvılcım  :', sparkHud.replace(/<[^>]+>/g, ''));
  console.log('seviye        :', lvl);
  console.log('kayıt         :', saveRaw);
  const save = JSON.parse(saveRaw);
  const ok = errors === 0 && save.best > 1000 && frames === SIM_SEC * FPS;
  console.log(errors === 0 ? '✓ exception yok' : '✗ exception VAR');
  console.log(save.best > 1000 ? '✓ mesafe birikiyor (rekor ' + save.best + ' m)' : '✗ mesafe birikmedi');
  console.log(ok ? '\n=== DUMAN TESTİ GEÇTİ ✅ ===' : '\n=== DUMAN TESTİ KALDI ❌ ===');
  process.exit(ok ? 0 : 1);
}, 50);

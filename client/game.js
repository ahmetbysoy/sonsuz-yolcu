/* ============================================================
   SONSUZ YOLCU — Faz 1+2 (v4: kukla-rig + cross-fade)
   - VOLT: 5 parçalı skeletal animasyon (anchor-pivotlu, nötr uzuvlar)
   - Durum geçişleri 130ms cross-fade (pop yok)
   - Net modülü (Firebase sunucu senkronu + uyku kazancı raporu)
   ============================================================ */
(() => {
'use strict';

/* ---------- Telegram SDK (varsa) ---------- */
try {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#141c37'); }
} catch (e) { /* tarayıcıda çalışıyorsa sessizce geç */ }

/* ---------- Yardımcılar ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = arr => arr[(Math.random() * arr.length) | 0];

/* ---------- Varlık yükleyici ---------- */
const IMAGES = {};
const IMAGE_LIST = [
  ['bg',        'assets/biome/meadow_bg.png'],
  ['hills',     'assets/biome/far_hills.png'],
  ['roadTile',  'assets/biome/road_tile.png'],
  ['voltMain',  'assets/volt/volt_main.png'],
  ['runSheet',  'assets/volt/volt_run_sheet.png'],
  ['backJump',  'assets/volt/volt_back_jump.png'],
  ['backSlide', 'assets/volt/volt_back_slide.png'],
  ['faceCheer', 'assets/volt/face_cheer.png'],
  ['faceDizzy', 'assets/volt/face_dizzy.png'],
  ['faceBlink', 'assets/volt/face_blink.png'],
  ['jumpSheet',    'assets/volt/volt_jump_sheet.png'],
  ['slideSheet',   'assets/volt/volt_slide_sheet.png'],
  ['stumbleSheet', 'assets/volt/volt_stumble_sheet.png'],
  ['flameSheet',   'assets/volt/flame_sheet.png'],
  ['faces6Sheet',  'assets/volt/volt_faces6_sheet.png'],
  ['cheerSheet',   'assets/volt/volt_cheer_sheet.png'],
  // --- Biome: Kristal Mağara ---
  ['caveBg',    'assets/biome/cave/bg.png'],
  ['caveHills', 'assets/biome/cave/hills.png'],
  ['caveRoad',  'assets/biome/cave/road_tile.png'],
  ['c_mush',    'assets/biome/cave/props/0.png'],
  ['c_crystal', 'assets/biome/cave/props/1.png'],
  ['c_stal',    'assets/biome/cave/props/2.png'],
  ['c_boulder', 'assets/biome/cave/props/3.png'],
  ['c_orb',     'assets/biome/cave/props/4.png'],
  ['c_rocks',   'assets/biome/cave/props/5.png'],
  // --- Biome: Bulut Şehri ---
  ['cityBg',    'assets/biome/city/bg.png'],
  ['cityHills', 'assets/biome/city/hills.png'],
  ['cityRoad',  'assets/biome/city/road_tile.png'],
  ['s_cloud',   'assets/biome/city/props/0.png'],
  ['s_star',    'assets/biome/city/props/1.png'],
  ['s_rainbow', 'assets/biome/city/props/2.png'],
  ['s_balloon', 'assets/biome/city/props/3.png'],
  ['s_island',  'assets/biome/city/props/4.png'],
  ['s_chime',   'assets/biome/city/props/5.png'],
  ['faceSurprised','assets/volt/face_surprised.png'],
  ['spark',     'assets/pickups/spark.png'],
  ['boulder',   'assets/obstacles/obs_boulder.png'],
  ['fence',     'assets/obstacles/obs_fence.png'],
  ['branch',    'assets/obstacles/obs_branch.png'],
  ['crystal',   'assets/obstacles/obs_crystal.png'],
  ['p_bush',    'assets/biome/props/bush.png'],
  ['p_pebbles', 'assets/biome/props/pebbles.png'],
  ['p_tree',    'assets/biome/props/tree.png'],
  ['p_mush',    'assets/biome/props/mushrooms.png'],
  ['p_grass',   'assets/biome/props/grass.png'],
  ['p_lantern', 'assets/biome/props/lantern.png'],
];
let loadedCount = 0;
function loadImages(cb) {
  IMAGE_LIST.forEach(([key, src]) => {
    const img = new Image();
    img.onload = () => { loadedCount++; if (loadedCount === IMAGE_LIST.length) cb(); };
    img.onerror = () => { loadedCount++; console.warn('yüklenemedi:', src); if (loadedCount === IMAGE_LIST.length) cb(); };
    img.src = src;
    IMAGES[key] = img;
  });
}

/* ---------- RUN SHEET (12 karelik koşu döngüsü) ----------
   tools/pack_run_sheet.py üretimi — detaylar: docs/volt_run_sheet.json */
const SHEET = { cols: 10, rows: 1, count: 20, fw: 207, fh: 271, fpsBase: 21.7 };  // 20 kare = 12'nin iki katı akıcılık

// Aksiyon sheet'leri: her durum artık gerçek kare animasyon (statik sticker YOK)
const ACTION_SHEETS = {
  jump:    { key: 'jumpSheet',    n: 6, dur: 0.55, charH: 0.17, cellFrac: 0.533, ease: p => Math.pow(p, 0.8) },
  slide:   { key: 'slideSheet',   n: 5, dur: 0.60, charH: 0.135, cellFrac: 0.8 },
  stumble: { key: 'stumbleSheet', n: 5, dur: 0.80, charH: 0.170, cellFrac: 0.8 },
  cheer:   { key: 'cheerSheet',   n: 6, dur: 1.20, charH: 0.175, cellFrac: 0.8 },
};

function drawActionSheet(state, alpha) {
  const v = G.volt;
  const cfg = ACTION_SHEETS[state];
  if (!cfg) return false;
  const sheet = IMAGES[cfg.key];
  if (!sheet || !sheet.width || !sheet.height) return false;   // fallback: eski statik poz
  let p = state === 'jump' ? v.jumpT : v.stateT / cfg.dur;
  p = clamp(p, 0, 1);
  const fi = Math.min(cfg.n - 1, Math.floor((cfg.ease ? cfg.ease(p) : p) * cfg.n));
  const fw = sheet.width / cfg.n, fh = sheet.height;
  const scale = (H * cfg.charH) / (fh * cfg.cellFrac);
  const dw = fw * scale, dh = fh * scale;
  const jt = Math.min(v.jumpT, 1);
  // NOT: zıplama kavisi sheet'in İÇİNDE (ayaklar f3'te 0.151H yukarıda) — kod yOff'u YOK
  const rot = state === 'jump' ? Math.sin(jt * Math.PI) * 0.07 : 0;
  const shadowScale = state === 'jump' ? 1 - Math.sin(jt * Math.PI) * 0.4 : 1;
  ctx.fillStyle = `rgba(40,30,10,${0.25 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(v.x, voltY + 6, 46 * shadowScale, 12 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(v.x, voltY + 10);
  ctx.rotate(rot);
  ctx.drawImage(sheet, fi * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

/* ---------- Ses motoru ---------- */
const Sfx = {
  ctx: null, muted: false, files: {},
  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    const f = { collect: 'assets/audio/confirmation_001.ogg', stumble: 'assets/audio/error_004.ogg', click: 'assets/audio/click1.ogg' };
    for (const k in f) {
      const a = new Audio(); a.src = f[k]; a.volume = 0.5;
      a.addEventListener('error', () => { delete this.files[k]; });
      this.files[k] = a;
    }
  },
  tone(freq, dur, type, gain, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },
  play(name) {
    if (this.muted) return;
    const el = this.files[name];
    if (el) { try { el.currentTime = 0; el.play().catch(() => this.fallback(name)); } catch (e) { this.fallback(name); } }
    else this.fallback(name);
  },
  fallback(name) {
    if (name === 'collect') this.tone(660, 0.09, 'triangle', 0.10, 880);
    else if (name === 'stumble') this.tone(150, 0.25, 'square', 0.07, 90);
    else if (name === 'click') this.tone(800, 0.06, 'sine', 0.06);
  },
  jump()  { this.tone(300, 0.14, 'sine', 0.07, 520); },
  slide() { this.tone(240, 0.16, 'sawtooth', 0.035, 150); },
  step(left) { this.tone(left ? 82 : 74, 0.045, 'triangle', 0.028); },  // ayak sesi (kısa/kısık)
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.13, 'triangle', 0.09), i * 95)); },
  burst() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'triangle', 0.09), i * 80)); }
};

/* ---------- Kayıt (yerel) ---------- */
const Save = {
  data: { totalDist: 0, sparks: 0, best: 0 },
  load() { try { const raw = localStorage.getItem('sy_save1'); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) {} },
  write() { try { localStorage.setItem('sy_save1', JSON.stringify(this.data)); } catch (e) {} }
};

/* ---------- Ağ modülü (sunucu senkronu + uyku kazancı) ---------- */
const Net = {
  uid: null, online: false, hbTimer: null,
  async init() {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      const tu = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (tu && tu.id) this.uid = 'tg' + tu.id;
    } catch (e) {}
    if (!this.uid) {
      try {
        let v = localStorage.getItem('sy_uid');
        if (!v) { v = 'g' + Math.random().toString(36).slice(2, 12); localStorage.setItem('sy_uid', v); }
        this.uid = v;
      } catch (e) { this.uid = 'ganon'; }
    }
    return this.uid;
  },
  async req(url, opts, timeoutMs = 3500) {
    if (typeof fetch !== 'function') return null;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => { if (ctl) ctl.abort(); }, timeoutMs);
    try {
      const r = await fetch(url, Object.assign({ cache: 'no-store' }, opts, ctl ? { signal: ctl.signal } : {}));
      return await r.json();
    } catch (e) { return null; }
    finally { clearTimeout(to); }
  },
  async load() {
    await this.init();
    const r = await this.req('/api/load?userId=' + encodeURIComponent(this.uid));
    if (r && r.ok) {
      this.online = true;
      const sessionSoFar = Math.floor(G.distance);
      Save.data.totalDist = Math.max(Save.data.totalDist, (r.totalDist || 0) - sessionSoFar);
      Save.data.sparks = Math.max(Save.data.sparks, r.sparks || 0);
      Save.data.best = Math.max(Save.data.best, r.best || 0);
      Save.write();
      return (r.sleepGain > 0) ? r : null;
    }
    return null;
  },
  async save(total, sparks) {
    if (!this.online) return null;
    const r = await this.req('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.uid, total, sparks, speed: Math.round(curSpeed() * 10) / 10, level: G.level })
    });
    if (r && r.ok && typeof r.total === 'number') {
      const banked = r.total - Math.floor(G.distance);
      if (banked > Save.data.totalDist) Save.data.totalDist = banked;
      if (r.best > Save.data.best) Save.data.best = r.best;
      Save.write();
    }
    return r;
  },
  startHeartbeat() {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = setInterval(() => {
      if (this.online && G.running) {
        this.req('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: this.uid }) });
      }
    }, 15000);
  }
};

function commitSave() {
  const total = Math.floor(Save.data.totalDist + G.distance);
  if (total > Save.data.best) Save.data.best = total;
  Save.write();
  Net.save(total, Save.data.sparks + G.sparks);
}

/* ---------- Canvas ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
let horizonY = 0, voltY = 0, roadHalfBottom = 0, roadHalfHorizon = 0;

function resize() {
  DPR = clamp(window.devicePixelRatio || 1, 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  horizonY = H * 0.42;
  voltY = H * 0.80;
  roadHalfBottom = W * 0.46;
  roadHalfHorizon = W * 0.105;
}
window.addEventListener('resize', resize);

const easeT = t => t * t;
function roadHalfAt(t) { return lerp(roadHalfHorizon, roadHalfBottom, easeT(t)); }
function centerYAt(t)  { return lerp(horizonY, voltY, easeT(t)); }
function roadCurveX(t) {
  // S-kıvrımı: oyuncu hizasında (t=1) 0, ufka doğru büyür; mesafeyle yön değiştirir
  const amp = W * 0.12;
  const phase = G.distance * 0.004;
  return Math.sin(phase + (1 - t) * 2.2) * amp * easeT(1 - t);
}
function laneX(t, lane) {
  const laneW = roadHalfAt(t) * 0.62;
  return W / 2 + roadCurveX(t) + (lane - 1) * laneW;
}

/* ---------- Biome sistemi (TASARIM 4.4) ---------- */
const BIOMES = [
  { id: 'meadow', name: 'Fısıltı Çayırı', icon: '🌿', until: 2,
    bg: 'bg', hills: 'hills', road: 'roadTile', edge: 'rgba(106,190,86,.85)',
    sky: '#87ceeb', fall: ['#d9b980', '#f2dcae'],
    props: ['p_bush', 'p_pebbles', 'p_tree', 'p_mush', 'p_grass', 'p_lantern'] },
  { id: 'cave', name: 'Kristal Mağara', icon: '💎', until: 4,
    bg: 'caveBg', hills: 'caveHills', road: 'caveRoad', edge: 'rgba(80,66,120,.9)',
    sky: '#241d3d', fall: ['#4a3f77', '#6a5aa0'],
    props: ['c_mush', 'c_crystal', 'c_stal', 'c_boulder', 'c_orb', 'c_rocks'] },
  { id: 'city', name: 'Bulut Şehri', icon: '☁️', until: 99,
    bg: 'cityBg', hills: 'cityHills', road: 'cityRoad', edge: 'rgba(255,255,255,.92)',
    sky: '#9ed8ff', fall: ['#eef3fb', '#ffffff'],
    props: ['s_cloud', 's_star', 's_rainbow', 's_balloon', 's_island', 's_chime'] },
];
function biomeAt(level) { for (const b of BIOMES) if (level <= b.until) return b; return BIOMES[BIOMES.length - 1]; }

/* ---------- Oyun durumu ---------- */
const G = {
  running: false,
  time: 0,
  distance: 0,
  sparks: 0,
  speed: 8,
  level: 1,
  burstTimer: 0,
  stumbleMult: 1,
  combo: 0, comboTimer: 0,
  entities: [],
  props: [],          // yol kenarı dekorları {type, side, z, swaySeed}
  particles: [],
  patternCount: 0,
  nextPatternDist: 60,
  idleFunTimer: 16,
  volt: { lane: 1, x: 0, state: 'run', prevState: null, blend: 0, stateT: 0, jumpT: 0, targetLane: 1, bob: 0, runPhase: 0, flamePhase: 0, glanceFace: null, scareQueue: false, laughQueue: false },
  trailTimer: 0, saveTimer: 0,
  newRecord: false,
  // --- Dokunmatik bonus + canlılık (v8) ---
  heartTimer: 0,       // çift dokunuş ❤️ +%5 hız
  magnetTimer: 0,      // uzun basma: kıvılcım mıknatısı
  comboMultTimer: 0,   // takla sonrası x2 kıvılcım
  driftT: 0,           // takla animasyon süresi
  shake: 0,            // kamera sarsıntısı (stumble)
  tapCd: 0, magnetCd: 0, lastTapTime: 0, glanceCd: 0,
  biome: BIOMES[0],    // aktif biome (TASARIM 4.4)
  portalT: 0,          // biome geçiş portal flaşı (1.5 sn)
};

const LEVEL_LEN = 500;
const OBSTACLE_KINDS = ['fence', 'branch', 'boulder', 'crystal'];
const JUMP_SOLIDS = ['boulder', 'crystal'];

function curSpeed() {
  const levelBoost = 1 + (G.level - 1) * 0.045;
  const burst = G.burstTimer > 0 ? 1.6 : 1;
  const heart = G.heartTimer > 0 ? 1.05 : 1;
  return G.speed * levelBoost * burst * G.stumbleMult * heart;
}

/* ---------- Banner ---------- */
const bannerEl = document.getElementById('banner');
let bannerTO = null;
function showBanner(text, cls) {
  bannerEl.textContent = text;
  bannerEl.className = 'show ' + (cls || 'gold');
  clearTimeout(bannerTO);
  bannerTO = setTimeout(() => bannerEl.className = '', 1600);
}

/* ---------- Parçacıklar ---------- */
function addParticle(p) { if (G.particles.length < 90) G.particles.push(p); }
function burstParticles(x, y, color, n, spread) {
  for (let i = 0; i < n; i++) {
    addParticle({
      x, y, vx: rand(-spread, spread), vy: rand(-spread * 1.2, -10),
      life: rand(0.4, 0.9), age: 0, size: rand(2, 5), color, type: 'dot'
    });
  }
}

/* ---------- Kenar dekoru (props) ---------- */
// PROP_KEYS kaldırıldı -> G.biome.props (biome başına 6 dekor)
function spawnProps() {
  const n = 1 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    G.props.push({
      type: pick(G.biome.props),
      side: Math.random() < 0.5 ? -1 : 1,
      z: 0.02 + rand(0, 0.04),
      swaySeed: rand(0, Math.PI * 2)
    });
  }
}

/* ---------- Desen üretici ---------- */
function laneClear(lane, fromZ, toZ, ignore) {
  return !G.entities.some(e => e !== ignore && !e.taken && e.lane === lane && e.z > fromZ && e.z < toZ);
}
function spawnPattern() {
  G.patternCount++;
  if (G.patternCount <= 2) {              // ilk 2 desen garantili kıvılcım
    const lane = (Math.random() * 3) | 0;
    for (let i = 0; i < 6; i++) G.entities.push({ type: 'spark', lane, z: 0.02 + i * 0.045 });
    return;
  }
  const lv = G.level;                     // zorluk seviyeye bağlı (analiz md. 4)
  const weights = {
    single:         0.30,
    doubleBlock:    Math.min(0.18 + lv * 0.02, 0.32),
    sparkLine:      Math.max(0.20 - lv * 0.015, 0.08),
    fenceArc:       0.14,
    obstacleSparks: 0.18,
    chain:          lv >= 3 ? Math.min(0.04 + lv * 0.012, 0.14) : 0,   // art arda iki engel
    zigzag:         lv >= 5 ? Math.min(0.03 + lv * 0.012, 0.12) : 0,   // sağ-sol blok
  };
  let total = 0; for (const k in weights) total += weights[k];
  let r = Math.random() * total, kind = 'single';
  for (const k in weights) { r -= weights[k]; if (r <= 0) { kind = k; break; } }
  const farZ = 0.02;
  if (kind === 'single') {
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane: (Math.random() * 3) | 0, z: farZ });
  } else if (kind === 'doubleBlock') {
    const free = (Math.random() * 3) | 0;
    for (let l = 0; l < 3; l++) if (l !== free)
      G.entities.push({ type: pick(OBSTACLE_KINDS), lane: l, z: farZ + rand(0, 0.02) });
  } else if (kind === 'sparkLine') {
    const lane = (Math.random() * 3) | 0;
    for (let i = 0; i < 6; i++) G.entities.push({ type: 'spark', lane, z: farZ + i * 0.045 });
  } else if (kind === 'fenceArc') {
    const lane = (Math.random() * 3) | 0;
    G.entities.push({ type: 'fence', lane, z: farZ + 0.1 });
    for (let i = 0; i < 5; i++)
      G.entities.push({ type: 'spark', lane, z: farZ + 0.02 + i * 0.045, lift: Math.sin((i / 4) * Math.PI) * 90 });
  } else if (kind === 'obstacleSparks') {
    const oLane = (Math.random() * 3) | 0;
    const sLane = (oLane + 1 + ((Math.random() * 2) | 0)) % 3;
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane: oLane, z: farZ });
    for (let i = 0; i < 4; i++) G.entities.push({ type: 'spark', lane: sLane, z: farZ + i * 0.05 });
  } else if (kind === 'chain') {
    const lane = (Math.random() * 3) | 0;
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane, z: farZ });
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane, z: farZ + 0.14 });
    for (let i = 0; i < 3; i++) G.entities.push({ type: 'spark', lane: (lane + 1) % 3, z: farZ + i * 0.05 });
  } else { // zigzag
    const a = (Math.random() * 2) | 0;
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane: a, z: farZ });
    G.entities.push({ type: pick(OBSTACLE_KINDS), lane: 2 - a, z: farZ + 0.09 });
    for (let i = 0; i < 4; i++) G.entities.push({ type: 'spark', lane: 1, z: farZ + i * 0.05 });
  }
}

/* ---------- VOLT eylemleri (cross-fade'li geçişler) ---------- */
function setVoltState(s) {
  const v = G.volt;
  if (v.state === s) return;
  v.prevState = v.state;
  v.blend = 1;
  v.state = s;
  v.stateT = 0;
}
function doJump() {
  if (G.volt.state !== 'run' && G.volt.state !== 'slide') return;
  setVoltState('jump');
  Sfx.jump();
}
function doSlide() {
  if (G.volt.state !== 'run') return;
  setVoltState('slide');
  Sfx.slide();
}
function doStumble() {
  if (G.volt.state === 'stumble' || G.volt.state === 'lookback') return;
  setVoltState('stumble');
  G.stumbleMult = 0.72; G.combo = 0; G.shake = 0.45;
  Sfx.play('stumble');
  const v = G.volt;
  burstParticles(v.x, voltY - 40, '#ffd166', 14, 120);
  addParticle({ x: v.x, y: voltY - 110, vx: 0, vy: -40, life: 1.0, age: 0, size: 22, color: '#fff', type: 'text', text: 'Ay! 😅' });
}
function doCheer() { setVoltState('cheer'); }
function doGlance(face) {
  if (G.volt.state !== 'run' || G.glanceCd > 0) return;
  G.glanceCd = 3;
  G.volt.glanceFace = face || null;   // null = klasik şaşkın bakış
  setVoltState('lookback');
}

/* Yüz karesi çizimi (faces6 sheet): bakış anlarında duygu yüzü */
function drawFaceFrame(idx, alpha) {
  const sheet = IMAGES.faces6Sheet;
  const v = G.volt;
  if (!sheet || !sheet.width) return;
  const fw = sheet.width / 6, fh = sheet.height;
  const scale = (H * 0.17) / fh;
  const dw = fw * scale, dh = fh * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(v.x, voltY + 10);
  ctx.rotate(Math.sin(v.stateT * 10) * 0.05);
  ctx.drawImage(sheet, idx * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* Kuyruk alevi overlay: sekonder motion (hızla büyür, drift'te savrulur, zıplamada sarkar) */
function drawFlame() {
  const sheet = IMAGES.flameSheet;
  if (!sheet || !sheet.width) return;
  const v = G.volt;
  const spd = clamp(curSpeed() / 14, 0.6, 1.6);
  const fi = Math.floor(v.flamePhase) % 3;
  const fw = sheet.width / 3, fh = sheet.height;
  const h = H * 0.062 * (0.8 + spd * 0.35);
  const w = fw * h / fh;
  const jumping = v.state === 'jump';
  const jt = Math.min(v.jumpT || 0, 1);
  const laneLean = clamp((v.targetLane - v.lane) * -0.18, -0.25, 0.25);
  const x = v.x - w * 0.55 - 6;
  const y = voltY + 2 - h * 0.55 + (jumping ? Math.sin(jt * Math.PI) * 12 : 0);
  const rot = -laneLean * 1.4 + (jumping ? Math.sin(jt * Math.PI) * 0.3 : 0);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (G.burstTimer > 0) { ctx.shadowColor = '#ff9f43'; ctx.shadowBlur = 18; }
  ctx.drawImage(sheet, fi * fw, 0, fw, fh, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------- Oto-pilot ---------- */
function autopilot(dt) {
  const v = G.volt;
  if (v.state === 'stumble' || v.state === 'cheer' || v.state === 'lookback') return;

  let target = null;
  for (const e of G.entities) {
    if (e.taken || e.type === 'spark') continue;
    if (e.lane !== v.targetLane) continue;
    if (e.z > 0.25 && e.z < 0.75 && (!target || e.z < target.z)) target = e;
  }
  if (!target) return;

  const reactZ = 0.38 + Math.random() * 0.04;
  if (target.z > reactZ) return;

  if (target.type === 'fence') doJump();
  else if (target.type === 'branch') doSlide();
  else {
    const opts = [0, 1, 2].filter(l => l !== v.targetLane).sort((a, b) => Math.abs(a - v.lane) - Math.abs(b - v.lane));
    let moved = false;
    for (const l of opts) {
      if (laneClear(l, 0.1, 0.9, target)) { v.targetLane = l; moved = true; break; }
    }
    if (!moved) doJump();
  }
}

/* ---------- Çarpışma & toplama ---------- */
function checkCollisions() {
  const v = G.volt;
  const jumping = v.state === 'jump';
  const sliding = v.state === 'slide';

  for (const e of G.entities) {
    if (e.taken) continue;
    const passed = e.z >= 0.94 && e.z <= 1.10;
    if (!passed) continue;

    const laneTol = (G.magnetTimer > 0 && e.type === 'spark') ? 9 : 0.45;
    if (Math.abs(e.lane - v.lane) > laneTol) continue;

    if (e.type === 'spark') {
      e.taken = true;
      G.sparks += (G.comboMultTimer > 0 ? 2 : 1);
      G.combo++; G.comboTimer = 2;
      Sfx.play('collect');
      burstParticles(laneX(1, e.lane), voltY - 60 - (e.lift || 0), '#ffe27a', 6, 80);
      if (G.combo > 0 && G.combo % 10 === 0) doGlance('laugh');
      if (G.combo > 0 && G.combo % 5 === 0)
        addParticle({ x: v.x, y: voltY - 130, vx: 0, vy: -30, life: 0.9, age: 0, size: 18, color: '#7ef9ff', type: 'text', text: 'KOMBO x' + G.combo + '! ✨' });
      continue;
    }
    if (e.type === 'fence') { if (jumping) { e.taken = true; v.scareQueue = true; } else if (e.z > 1.0) doStumble(); continue; }
    if (e.type === 'branch') { if (sliding) { e.taken = true; v.laughQueue = true; } else if (e.z > 1.0) doStumble(); continue; }
    if (JUMP_SOLIDS.includes(e.type)) {
      if (jumping && v.jumpT > 0.25 && v.jumpT < 0.85) { e.taken = true; v.scareQueue = true; }
      else if (e.z > 1.0) doStumble();
      continue;
    }
  }
}

/* ---------- Seviye & olaylar ---------- */
function updateProgression(distDelta) {
  const before = G.level;
  G.level = 1 + Math.floor(G.distance / LEVEL_LEN);
  if (G.level > before) {
    doCheer(); Sfx.levelUp();
    showBanner('SEVİYE ' + G.level + '! ⚡');
    burstParticles(G.volt.x, voltY - 80, '#ffd166', 20, 160);
    const nb = biomeAt(G.level);
    if (nb !== G.biome) {                    // BIOME DEĞİŞİMİ: portal + anons
      G.biome = nb; G.portalT = 1.5;
      setTimeout(() => showBanner(nb.icon + ' ' + nb.name.toUpperCase() + '!'), 1700);
      setTimeout(() => burstParticles(G.volt.x, voltY - 90, '#7ef9ff', 24, 170), 1700);
      Sfx.levelUp();
    }
    if (G.level % 10 === 0) {
      G.burstTimer = 6; Sfx.burst();
      setTimeout(() => showBanner('IŞIK PATLAMASI! 🌈', 'rainbow'), 1700);
    }
  }
  if (!G.newRecord && Save.data.best > 0 && G.distance + Save.data.totalDist > Save.data.best) {
    G.newRecord = true;
    setTimeout(() => showBanner('YENİ REKOR! 🏆'), 1200);
  }
}

/* ---------- Güncelleme ---------- */
function update(dt) {
  G.time += dt;
  const spd = curSpeed();
  G.distance += spd * dt;
  G.stumbleMult = Math.min(1, G.stumbleMult + dt * 0.15);
  if (G.burstTimer > 0) G.burstTimer -= dt;
  if (G.comboTimer > 0) { G.comboTimer -= dt; if (G.comboTimer <= 0) G.combo = 0; }
  if (G.heartTimer > 0) G.heartTimer -= dt;
  if (G.magnetTimer > 0) G.magnetTimer -= dt;
  if (G.comboMultTimer > 0) G.comboMultTimer -= dt;
  if (G.driftT > 0) G.driftT -= dt;
  if (G.tapCd > 0) G.tapCd -= dt;
  if (G.magnetCd > 0) G.magnetCd -= dt;
  if (G.glanceCd > 0) G.glanceCd -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.3);
  if (G.portalT > 0) G.portalT = Math.max(0, G.portalT - dt);

  const v = G.volt;
  v.lane = lerp(v.lane, v.targetLane, clamp(dt * 6.5, 0, 1));
  v.stateT += dt;
  if (v.state === 'jump') { v.jumpT = v.stateT / 0.55; if (v.stateT >= 0.55) { setVoltState('run'); if (v.scareQueue) { v.scareQueue = false; doGlance('scared'); } } }
  else if (v.state === 'slide' && v.stateT >= 0.6) { setVoltState('run'); if (v.laughQueue) { v.laughQueue = false; doGlance('laugh'); } }
  else if (v.state === 'stumble' && v.stateT >= 0.8) setVoltState('lookback');
  else if (v.state === 'lookback' && v.stateT >= 0.45) { v.glanceFace = null; setVoltState('run'); }
  else if (v.state === 'cheer' && v.stateT >= 1.2) setVoltState('run');
  if (v.blend > 0) v.blend = Math.max(0, v.blend - dt / 0.13);   // 130ms cross-fade
  v.bob = Math.sin(G.time * 9) * 5;   // statik pozlarda minik canlılık (koşu bob'u rig'te faz-senkron)
  v.runPhase += dt;
  v.flamePhase += dt * (10 + spd * 2.2);   // alev titreme hızı (hızla artar)
  v.x = laneX(1, v.lane);

  // ADIM OLAYI: bacak fazı ekstremumunda (cos sıfır geçişi) toz pufu + ayak sesi
  const stepFreq = clamp(SHEET.fpsBase * clamp(curSpeed() / 14, 0.6, 1.6), 24, 35) * Math.PI / 10;   // kos-radyan: temas = fps/10
  const cNow = Math.cos(v.runPhase * stepFreq);
  if (v.state === 'run' && v.prevC !== undefined && ((cNow >= 0) !== (v.prevC >= 0))) {
    burstParticles(v.x + (cNow >= 0 ? -14 : 14), voltY + 2, '#d9c9a8', 2, 30);
    Sfx.step(cNow >= 0);
  }
  v.prevC = cNow;

  autopilot(dt);

  const zSpeed = spd * 0.042;
  for (const e of G.entities) e.z += zSpeed * dt;
  G.entities = G.entities.filter(e => e.z < 1.25 && !e.taken);
  for (const p of G.props) p.z += zSpeed * dt;
  G.props = G.props.filter(p => p.z < 1.2);

  if (G.distance > G.nextPatternDist) {
    spawnPattern();
    spawnProps();
    G.nextPatternDist = G.distance + clamp(spd * rand(1.0, 1.6), 90, 260);
  }

  checkCollisions();
  updateProgression(spd * dt);

  G.idleFunTimer -= dt;
  if (G.idleFunTimer <= 0) {
    G.idleFunTimer = rand(14, 24);
    if (v.state === 'run') {
      if (Math.random() < 0.5) { doCheer(); burstParticles(v.x, voltY - 60, '#7ef9ff', 10, 100); }
      else doGlance();
    }
  }

  G.trailTimer -= dt;
  if (G.trailTimer <= 0) {
    G.trailTimer = 0.05;
    if (Math.random() < 0.55)   // kuyruk alevinden kor/ember izi
      addParticle({ x: v.x - 26 + rand(-6, 6), y: voltY - 26 + rand(-8, 8),
        vx: rand(-46, -18), vy: rand(-14, 10), life: rand(0.2, 0.45), age: 0,
        size: rand(2, 4.5), color: pick(['#ff9f43', '#ffd166', '#ff6b6b']) });
    const hue = G.burstTimer > 0 ? (G.time * 300) % 360 : 45;
    addParticle({ x: v.x + rand(-10, 10), y: voltY - 14 + rand(-4, 4),
      vx: rand(-30, -10), vy: rand(-16, 6), life: rand(0.25, 0.5), age: 0,
      size: rand(3, 7), color: `hsl(${hue}, 95%, ${G.burstTimer > 0 ? 65 : 60}%)`, type: 'dot' });
  }

  for (const p of G.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
  G.particles = G.particles.filter(p => p.age < p.life);

  G.saveTimer -= dt;
  if (G.saveTimer <= 0) { G.saveTimer = 5; commitSave(); }
}

/* ---------- Çizim: dünya ---------- */
function drawBG() {
  const bgImg = IMAGES[G.biome.bg] || IMAGES.bg;
  if (!bgImg || !bgImg.width) { ctx.fillStyle = G.biome.sky || '#87ceeb'; ctx.fillRect(0, 0, W, H); return; }
  const img = bgImg;
  const scale = Math.max(W / img.width, H / img.height) * 1.06;
  const dw = img.width * scale, dh = img.height * scale;
  const dx = (W - dw) / 2 + Math.sin(G.time * 0.13) * 14 - Math.sin(G.distance * 0.004) * 16;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  // PARALLAX (5 KATMAN): 1 bg · 2 uzak tepeler · 3 yakın tepeler · 4 orta şerit · 5 ön plan
  const hills = IMAGES[G.biome.hills] || IMAGES.hills;
  if (hills && hills.width) {
    const hr = hills.height / hills.width;
    // KATMAN 2: uzak tepeler (yavaş, soluk)
    const hw2 = W * 1.35, hh2 = hw2 * hr;
    const hy2 = horizonY - hh2 * 0.55;
    const off2 = -((G.distance * 0.12) % hw2);
    ctx.globalAlpha = 0.9;
    for (let x = off2; x < W; x += hw2) ctx.drawImage(hills, x, hy2, hw2, hh2);
    ctx.globalAlpha = 1;
    // KATMAN 3: yakın tepe sırası (daha büyük, daha hızlı, dolgun)
    const hw3 = W * 1.6, hh3 = hw3 * hr;
    const hy3 = horizonY - hh3 * 0.34;
    const off3 = -((G.distance * 0.26) % hw3);
    for (let x = off3; x < W; x += hw3) ctx.drawImage(hills, x, hy3, hw3, hh3);
  }
  // KATMAN 4: orta dekor şeridi (biome objeleri ufuk hizasında, yol kenarlarında görünür)
  const seq = G.biome.props;
  const gap4 = W * 0.38, sp4 = G.distance * 0.45;
  const off4 = -(sp4 % gap4), base4 = Math.floor(sp4 / gap4);
  ctx.globalAlpha = 0.95;
  for (let k = 0; k < Math.ceil(W / gap4) + 1; k++) {
    const img = IMAGES[seq[(base4 + k) % seq.length]];
    if (!img || !img.width) continue;
    const h4 = H * 0.045, w4 = img.width * h4 / img.height;
    ctx.drawImage(img, off4 + k * gap4, horizonY - h4 * 0.72, w4, h4);
  }
  ctx.globalAlpha = 1;
}

/* KATMAN 5: ön plan — alt kenarda hızlı geçen biome objeleri (derinlik çerçevesi) */
function drawForeground() {
  const seq = G.biome.props;
  const gap = W * 0.55, sp = G.distance * 0.75;
  const off = -(sp % gap), base = Math.floor(sp / gap);
  for (let k = 0; k < Math.ceil(W / gap) + 1; k++) {
    const img = IMAGES[seq[(base + k) % seq.length]];
    if (!img || !img.width) continue;
    const h = H * 0.075, w = img.width * h / img.height;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, off + k * gap, H - h * 0.62, w, h);
  }
  ctx.globalAlpha = 1;
}

/* Yol: dikey seamless tile + perspektif scanline akışı (derinlik) */
function drawRoad() {
  const tile = IMAGES[G.biome.road] || IMAGES.roadTile;
  const BANDS = 72;
  const scroll = (G.distance * 0.042) % 1;

  if (tile && tile.width) {
    const leftTop = W / 2 - roadHalfHorizon, rightTop = W / 2 + roadHalfHorizon;
    for (let i = 0; i < BANDS; i++) {
      const t0 = i / BANDS, t1 = (i + 1) / BANDS;
      const e0 = easeT(t0), e1 = easeT(t1);
      const y0 = lerp(horizonY, H + 6, e0);
      const y1 = lerp(horizonY, H + 6, e1);
      const ty0 = ((((t0 - scroll) % 1) + 1) % 1) * tile.height;
      const ty1 = ((((t1 - scroll) % 1) + 1) % 1) * tile.height;
      const curve = roadCurveX(t0);
      const xL0 = lerp(leftTop, W / 2 - roadHalfBottom, e0) + curve;
      const xR0 = lerp(rightTop, W / 2 + roadHalfBottom, e0) + curve;
      const w0 = xR0 - xL0;
      const hBand = y1 - y0 + 1;
      let sy0 = ty0, sh = ty1 - ty0;
      if (sh < 0) sh += tile.height;
      sh = Math.min(sh, tile.height - sy0);
      if (sh <= 0) continue;
      ctx.drawImage(tile, 0, sy0, tile.width, sh, xL0 - 1, y0, w0 + 2, hBand);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(W / 2 - roadHalfHorizon, horizonY);
    ctx.lineTo(W / 2 + roadHalfHorizon, horizonY);
    ctx.lineTo(W / 2 + roadHalfBottom, H + 4);
    ctx.lineTo(W / 2 - roadHalfBottom, H + 4);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, horizonY, 0, H);
    const fall = G.biome.fall || ['#d9b980', '#f2dcae'];
    grad.addColorStop(0, fall[0]); grad.addColorStop(1, fall[1]);
    ctx.fillStyle = grad; ctx.fill();
  }

  // kenar çim: kıvrımı bant bant takip eden poliline (yoldan kopmaz)
  ctx.lineWidth = 10; ctx.strokeStyle = G.biome.edge;
  for (const sideSign of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= BANDS; i++) {
      const t = i / BANDS, e = easeT(t);
      const x = W / 2 + roadCurveX(t) + sideSign * lerp(roadHalfHorizon, roadHalfBottom, e);
      const y = lerp(horizonY, H + 4, e);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}

/* Kenar dekorları: perspektif ölçek + hafif salınım (canlılık) */
function drawProps() {
  const sorted = [...G.props].sort((a, b) => a.z - b.z);
  for (const p of sorted) {
    const img = IMAGES[p.type];
    if (!img || !img.width) continue;
    const t = easeT(clamp(p.z, 0, 1));
    const y = centerYAt(clamp(p.z, 0, 1));
    const scale = lerp(0.14, 1, t);
    const w = img.width * scale * 0.30;
    const h = img.height * scale * 0.30;
    const laneW = roadHalfAt(t) * 0.62;
    const x = W / 2 + roadCurveX(t) + p.side * (roadHalfAt(t) + w * 0.55 + laneW * 0.22);
    const sway = Math.sin(G.time * 1.6 + p.swaySeed) * 0.045;
    ctx.save();
    ctx.translate(x, y + h * 0.38);
    ctx.rotate(sway);
    ctx.drawImage(img, -w / 2, -h * 0.92, w, h);
    ctx.restore();
  }
}

function drawEntities() {
  const sorted = [...G.entities].sort((a, b) => a.z - b.z);
  for (const e of sorted) {
    const t = easeT(clamp(e.z, 0, 1.15));
    const x = laneX(e.z, e.lane);
    const y = centerYAt(clamp(e.z, 0, 1));
    const scale = lerp(0.16, 1, t);

    if (e.type === 'spark') {
      const img = IMAGES.spark; if (!img || !img.width) continue;
      const s = 46 * scale * 1.6;
      const bobY = Math.sin(G.time * 5 + e.z * 20) * 4 * scale;
      ctx.save();
      ctx.translate(x, y - 26 * scale - bobY - (e.lift || 0) * t);
      ctx.rotate(G.time * 1.6 + e.z * 9);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      continue;
    }

    const img = IMAGES[e.type];
    if (!img || !img.width) continue;
    const w = img.width * scale * 0.34;
    const h = img.height * scale * 0.34;
    let dy = y - h * 0.82;
    if (e.type === 'branch') dy = y - h * 1.05;
    ctx.drawImage(img, x - w / 2, dy, w, h);
  }
}

/* ---------- VOLT çizimi: kukla rig + cross-fade ---------- */
/* ---------- RUN SHEET oynatıcı (12 kare, hız-bağımlı fps) ---------- */
function drawRunFrame(px, baseY, alpha) {
  const v = G.volt;
  const sheet = IMAGES.runSheet;
  if (!sheet || !sheet.width) { ctx.globalAlpha = alpha; ctx.globalAlpha = 1; return; }
  const spd = clamp(curSpeed() / 14, 0.6, 1.6);
  const fps = clamp(SHEET.fpsBase * spd, 24, 35);
  const fi = Math.floor(v.runPhase * fps) % SHEET.count;
  const col = fi % SHEET.cols, row = (fi / SHEET.cols) | 0;
  const sx = col * SHEET.fw, sy = row * SHEET.fh;

  // adım fazıyla senkron squash&stretch (S: faz; vuruş anında çökme)
  const S = Math.sin(v.runPhase * fps);
  const dispH = H * 0.175 * (1 - Math.abs(S) * 0.05);
  const dispW = dispH * (SHEET.fw / SHEET.fh);
  let laneLean = clamp((v.targetLane - v.lane) * -0.18, -0.25, 0.25);
  if (G.driftT > 0) laneLean += Math.sin((1 - G.driftT / 0.45) * Math.PI) * 0.9;

  ctx.fillStyle = 'rgba(40,30,10,0.22)';
  ctx.beginPath();
  ctx.ellipse(px, baseY + 4, dispW * 0.40, dispW * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(px, baseY);
  ctx.rotate(laneLean);
  // taban-orta çapa: ayaklar zemin çizgisinde
  ctx.drawImage(sheet, sx, sy, SHEET.fw, SHEET.fh, -dispW / 2, -dispH, dispW, dispH);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* Tek bir state'in pozunu çizer (cross-fade için alpha ile) */
function drawPose(state, alpha) {
  const v = G.volt;
  ctx.globalAlpha = alpha;

  if (state === 'run') { drawRunFrame(v.x, voltY + 10, alpha); ctx.globalAlpha = 1; return; }
  if (drawActionSheet(state, alpha)) { ctx.globalAlpha = 1; return; }   // v8: kare animasyon

  let img, rot = 0, yOff = 0, hFrac = 0.165, spin = 0;
  if (state === 'jump') {
    img = IMAGES.backJump;
    yOff = -Math.sin(v.jumpT * Math.PI) * H * 0.14;
    rot = Math.sin(v.jumpT * Math.PI) * 0.07;
  } else if (state === 'slide') {
    img = IMAGES.backSlide; yOff = 4; hFrac = 0.14;
  } else if (state === 'stumble') {
    img = IMAGES.faceDizzy; rot = Math.sin(v.stateT * 26) * 0.15; hFrac = 0.17;
    spin = 1;   // kameraya dönüş hissi (scaleX animasyonu)
  } else if (state === 'lookback') {
    if (v.glanceFace) { drawFaceFrame({ love: 4, laugh: 1, scared: 5 }[v.glanceFace] || 3, alpha); ctx.globalAlpha = 1; return; }
    img = IMAGES.faceSurprised; rot = Math.sin(v.stateT * 10) * 0.05;
    spin = 1;
  } else if (state === 'cheer') {
    img = IMAGES.faceCheer; yOff = -Math.abs(Math.sin(v.stateT * 7)) * 20; hFrac = 0.175;
    spin = 1;
  } else {
    img = IMAGES.voltMain; yOff = v.bob * 0.5;
  }

  const dispH = H * hFrac;
  const w0 = dispH * (img.width && img.height ? img.width / img.height : 0.8);
  const byBottom = voltY + 10 + yOff;

  const shadowScale = state === 'jump' ? 1 - Math.sin(v.jumpT * Math.PI) * 0.4 : 1;
  ctx.fillStyle = `rgba(40,30,10,${0.25 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(v.x, voltY + 6, 46 * shadowScale, 12 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(v.x, byBottom);
  ctx.rotate(rot);
  if (spin) {
    // 180° dönüş hissi: ilk 120ms'de x-ekseni 0.25→1 açılır
    const t01 = clamp(v.stateT / 0.12, 0, 1);
    ctx.scale(0.25 + 0.75 * t01, 1);
  }
  ctx.drawImage(img, -w0 / 2, -dispH, w0, dispH);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawVolt() {
  const v = G.volt;
  drawFlame();   // sekonder motion: alev kuyruk (karakterin ARKASINDA)
  if (v.blend > 0 && v.prevState && v.prevState !== v.state) {
    drawPose(v.prevState, v.blend);          // eski poz soluyor
    drawPose(v.state, 1 - v.blend);          // yeni poz beliriyor
  } else {
    drawPose(v.state, 1);
  }
}

function drawParticles() {
  for (const p of G.particles) {
    const a = 1 - p.age / p.life;
    if (p.type === 'text') {
      ctx.globalAlpha = a;
      ctx.font = `900 ${p.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,20,0,.8)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBurstFx() {
  if (G.burstTimer <= 0) return;
  for (let i = 0; i < 3; i++) {
    const y = ((G.time * 900 + i * 331) % (H + 80)) - 40;
    const x = ((i * 7 + ((G.time * 3) % 1)) * 137) % W;
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 90, y); ctx.stroke();
  }
}

function render() {
  if (G.shake > 0) { ctx.save(); ctx.translate(rand(-8, 8) * G.shake, rand(-5, 5) * G.shake); }
  drawBG();
  drawRoad();
  drawProps();
  drawForeground();
  drawEntities();
  drawVolt();
  drawParticles();
  drawBurstFx();
  if (G.portalT > 0) {   // biome geçiş portal flaşı (ortası en yoğun)
    const a = Math.sin((1 - G.portalT / 1.5) * Math.PI) * 0.85;
    ctx.fillStyle = `rgba(190,230,255,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (G.shake > 0) ctx.restore();
}

/* ---------- HUD ---------- */
const chipDist = document.getElementById('chipDist');
const chipSpark = document.getElementById('chipSpark');
const lvlfill = document.getElementById('lvlfill');
const lvlLabel = document.getElementById('lvlLabel');
const spdLabel = document.getElementById('spdLabel');
function updateHUD() {
  const total = Math.floor(Save.data.totalDist + G.distance);
  chipDist.innerHTML = '⚡ <b>' + total.toLocaleString('tr-TR') + '</b> m';
  chipSpark.innerHTML = '✨ <b>' + (Save.data.sparks + G.sparks).toLocaleString('tr-TR') + '</b>';
  lvlLabel.textContent = 'SV.' + G.level;
  lvlfill.style.width = ((G.distance % LEVEL_LEN) / LEVEL_LEN * 100).toFixed(1) + '%';
  spdLabel.textContent = Math.round(curSpeed() * 3.6) + ' km/sa';
}

/* ---------- Ana döngü ---------- */
let lastT = 0, rafId = null;
function loop(ts) {
  if (!G.running) return;
  const dt = clamp((ts - lastT) / 1000, 0, 0.05);
  lastT = ts;
  update(dt);
  render();
  updateHUD();
  rafId = requestAnimationFrame(loop);
}
function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  G.running = true; lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}
function stopLoop() { G.running = false; if (rafId) cancelAnimationFrame(rafId); }

/* ---------- Başlatma ---------- */
let started = false;
const sleepOverlayEl = document.getElementById('sleepOverlay');

function showSleepReport(r) {
  stopLoop();
  document.getElementById('sleptM').textContent = r.sleepGain.toLocaleString('tr-TR');
  const h = Math.floor(r.sleptS / 3600), m = Math.floor((r.sleptS % 3600) / 60);
  document.getElementById('sleptTime').textContent = (h > 0 ? h + ' sa ' : '') + (m > 0 ? m + ' dk' : '') + ' boyunca 💤';
  sleepOverlayEl.classList.remove('hidden');
}
document.getElementById('btnSleepOk').addEventListener('click', () => {
  Sfx.play('click');
  sleepOverlayEl.classList.add('hidden');
  lastT = performance.now();
  startLoop();
});

function startGame() {
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  started = true;
  Sfx.init();
  if (Sfx.ctx && Sfx.ctx.state === 'suspended') Sfx.ctx.resume();
  Sfx.play('click');

  Net.load().then(rep => {
    Net.startHeartbeat();
    if (rep && started) showSleepReport(rep);
  });

  startLoop();
}

document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnMute').addEventListener('click', () => {
  Sfx.muted = !Sfx.muted;
  document.getElementById('btnMute').textContent = Sfx.muted ? '🔇' : '🔊';
});
window.addEventListener('keydown', e => { if (e.key === 'Enter' && !G.running && !started) startGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopLoop(); commitSave(); }
  else if (started && !G.running && sleepOverlayEl.classList.contains('hidden')) {
    lastT = performance.now(); startLoop();
  }
});
window.addEventListener('pagehide', () => {
  try {
    if (Net.online && navigator.sendBeacon) {
      navigator.sendBeacon('/api/save', new Blob([JSON.stringify({
        userId: Net.uid, total: Math.floor(Save.data.totalDist + G.distance),
        sparks: Save.data.sparks + G.sparks, speed: curSpeed(), level: G.level
      })], { type: 'application/json' }));
    }
  } catch (e) {}
});
window.addEventListener('beforeunload', commitSave);

/* ---------- Dokunmatik bonus (TASARIM 4.2: otomatik oyun + dokunuş BONUS) ---------- */
function bonusTap(x, y) {
  if (!G.running || G.tapCd > 0) return;
  G.tapCd = 0.35;
  burstParticles(x, y, '#ffe27a', 6, 90);
  try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
  Sfx.play('collect');
}
function bonusDoubleTap() {
  if (!G.running) return;
  G.heartTimer = 6;
  doGlance('love');
  burstParticles(G.volt.x, voltY - 80, '#ff8fa3', 10, 110);
  for (let i = 0; i < 4; i++)
    addParticle({ x: G.volt.x + rand(-30, 30), y: voltY - 100 - i * 16, vx: rand(-14, 14), vy: rand(-40, -14), life: rand(0.5, 0.9), age: 0, size: rand(14, 20), color: '#ff8fa3', type: 'text', text: '❤️' });
  addParticle({ x: G.volt.x, y: voltY - 150, vx: 0, vy: -40, life: 1.0, age: 0, size: 20, color: '#fff', type: 'text', text: '+❤️ %5 HIZ!' });
  try { navigator.vibrate && navigator.vibrate([18, 40, 18]); } catch (e) {}
  Sfx.play('collect');
}
function bonusSwipe() {
  if (!G.running || G.driftT > 0) return;
  G.driftT = 0.45; G.comboMultTimer = 3;
  burstParticles(G.volt.x, voltY - 20, '#7ef9ff', 12, 130);
  addParticle({ x: G.volt.x, y: voltY - 120, vx: 0, vy: -40, life: 0.9, age: 0, size: 19, color: '#fff', type: 'text', text: 'TAKLA! KIVILCIM ×2 ✨' });
  try { navigator.vibrate && navigator.vibrate(20); } catch (e) {}
  Sfx.play('jump');
}
function bonusMagnet() {
  if (!G.running || G.magnetCd > 0) return;
  G.magnetCd = 12; G.magnetTimer = 2.5;
  burstParticles(G.volt.x, voltY - 60, '#7ef9ff', 14, 120);
  addParticle({ x: G.volt.x, y: voltY - 140, vx: 0, vy: -40, life: 1.0, age: 0, size: 20, color: '#fff', type: 'text', text: 'MIKNATIS! 🧲' });
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
  Sfx.play('levelUp');
}
(function initTouchBonus() {
  const el = (typeof document.querySelector === 'function') ? document.querySelector('canvas') : null;
  if (!el || !el.addEventListener) return;   // smoke test güvenliği
  const PULL = 24;
  let sx = 0, sy = 0, st = 0, longTimer = null, longFired = false;
  const begin = (x, y) => { sx = x; sy = y; st = performance.now(); longFired = false;
    longTimer = setTimeout(() => { longFired = true; bonusMagnet(); }, 480); };
  const finish = (x, y) => {
    if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    if (longFired) return;
    const dx = x - sx, dy = y - sy, dt = performance.now() - st;
    if ((Math.abs(dx) > PULL || Math.abs(dy) > PULL) && dt < 600) { bonusSwipe(); return; }
    if (dt < 260) {
      const now = performance.now();
      if (now - G.lastTapTime < 320) { G.lastTapTime = 0; bonusDoubleTap(); }
      else { G.lastTapTime = now; bonusTap(x, y); }
    }
  };
  const toWorld = (cx, cy, el2) => {
    const r = el2.getBoundingClientRect();
    return [(cx - r.left) * (W / r.width), (cy - r.top) * (H / r.height)];
  };
  el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; begin(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchmove', e => {
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - sx) > PULL || Math.abs(t.clientY - sy) > PULL) {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const [wx, wy] = toWorld(t.clientX, t.clientY, el);
    finish(wx, wy);
  });
  el.addEventListener('mousedown', e => begin(e.clientX, e.clientY));
  el.addEventListener('mouseup', e => {
    const [wx, wy] = toWorld(e.clientX, e.clientY, el);
    finish(wx, wy);
  });
})();

/* ---------- Init ---------- */
Save.load();
resize();
loadImages(() => {
  const rec = Save.data.best;
  if (rec > 0) document.getElementById('recordLine').textContent = '🏆 Rekorun: ' + rec.toLocaleString('tr-TR') + ' m — kaldığın yerden devam!';
  else document.getElementById('recordLine').textContent = 'İlk koşun başlamak üzere ✨';

  // CANLI MENÜ: 12 kareli idle döngüsü (mimik + el kol + zıplama)
  const hero = document.getElementById('voltHero');
  const IDLE_N = 12;
  const idleFrames = Array.from({length: IDLE_N}, (_, i) => `assets/volt/idle/idle${i}.png`);
  idleFrames.forEach(src => { const im = new Image(); im.src = src; });  // ön yükle
  let mi = 0;
  setInterval(() => { if (!G.running) { mi = (mi + 1) % IDLE_N; hero.src = idleFrames[mi]; } }, 150);
});
resize();

})();

'use strict';
const store = require('./_store');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return store.corsPreflight(req, res);
  const b = await store.readBody(req);
  const uid = String(b.userId || '').slice(0, 64);
  if (!uid) return store.json(res, 400, { ok: false, error: 'userId gerekli' });
  const u = await store.getUser(uid);
  const now = Date.now();
  const elapsedS = Math.max(0.001, (now - u.updatedAt) / 1000);

  let total = store.clampNum(b.total, 0, 1e12);
  let flaggedNow = false;

  if (!u.adopted) {
    u.adopted = true;
    if (total > u.totalDist) u.totalDist = Math.floor(total);
    if (b.sparks > u.sparks) u.sparks = Math.floor(store.clampNum(b.sparks, 0, 1e9));
  } else {
    const inc = total - u.totalDist;
    const maxInc = Math.max(50, elapsedS * store.MAX_INC_PER_S);
    if (inc > maxInc) { total = u.totalDist + maxInc; u.flagCount++; flaggedNow = true; }
    if (total < u.totalDist) total = u.totalDist;
    const sparkInc = store.clampNum(b.sparks, 0, 1e9) - u.sparks;
    if (sparkInc > elapsedS * store.MAX_SPARK_INC_PER_S) { u.sparks += Math.floor(elapsedS * store.MAX_SPARK_INC_PER_S); u.flagCount++; flaggedNow = true; }
    else if (sparkInc > 0) u.sparks = Math.floor(store.clampNum(b.sparks, 0, 1e9));
  }

  u.totalDist = Math.floor(total);
  u.best = Math.max(u.best, u.totalDist);
  u.level = store.clampNum(b.level, 1, 10000) | 0;
  u.lastSpeed = store.clampNum(b.speed, 2, 40);
  u.lastSeen = now;
  u.updatedAt = now;
  await store.persistUser(uid, u);
  store.json(res, 200, { ok: true, total: u.totalDist, best: u.best, flagged: flaggedNow });
};

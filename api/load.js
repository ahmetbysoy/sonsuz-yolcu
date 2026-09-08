'use strict';
const store = require('./_store');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return store.corsPreflight(req, res);
  const q = store.parseQuery(req);
  const uid = String(q.userId || '').slice(0, 64);
  if (!uid) return store.json(res, 400, { ok: false, error: 'userId gerekli' });
  const u = await store.getUser(uid);
  const sleep = store.applySleep(u);
  await store.persistUser(uid, u);
  store.json(res, 200, {
    ok: true, serverTime: Date.now(),
    totalDist: Math.floor(u.totalDist), sparks: Math.floor(u.sparks),
    best: Math.floor(u.best), level: u.level,
    sleepGain: sleep.gain, sleptS: sleep.sleptS,
    flagged: u.flagCount > 0
  });
};

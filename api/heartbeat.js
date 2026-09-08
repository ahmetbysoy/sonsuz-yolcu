'use strict';
const store = require('./_store');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return store.corsPreflight(req, res);
  const b = await store.readBody(req);
  const uid = String(b.userId || '').slice(0, 64);
  if (!uid) return store.json(res, 400, { ok: false });
  const u = await store.getUser(uid);
  u.lastSeen = Date.now();
  u.updatedAt = u.lastSeen;
  await store.persistUser(uid, u);
  store.json(res, 200, { ok: true, serverTime: Date.now() });
};

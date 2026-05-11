'use strict';

/**
 * Offline state is stored in Redis so it survives across
 * multiple server instances (not just a local flag file).
 */

const { getClient } = require('../config/redis');

const REDIS_KEY = 'shepherd:forced_offline';

async function isForcedOffline() {
  const redis = getClient();
  const val = await redis.get(REDIS_KEY);
  return val !== null;
}

async function setForcedOffline(data = {}) {
  const redis = getClient();
  const payload = JSON.stringify({ ...data, setAt: new Date().toISOString() });
  // Expire after 24h — auto-resets daily so a transient quota hit doesn't
  // leave the system stuck in offline mode forever.
  await redis.set(REDIS_KEY, payload, 'EX', 24 * 60 * 60);
}

async function clearForcedOffline() {
  const redis = getClient();
  await redis.del(REDIS_KEY);
}

async function getOfflineState() {
  const redis = getClient();
  const val = await redis.get(REDIS_KEY);
  return val ? JSON.parse(val) : null;
}

module.exports = { isForcedOffline, setForcedOffline, clearForcedOffline, getOfflineState };

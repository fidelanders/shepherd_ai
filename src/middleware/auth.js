'use strict';

const env = require('../config/env');

const allowedKeys = new Set(
  (env.API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
);

/**
 * API key middleware.
 * - If no API_KEYS are configured: passes through (dev mode).
 * - If API_KEYS are set: requires a valid X-API-Key header.
 */
function apiKeyAuth(req, res, next) {
  if (allowedKeys.size === 0) return next(); // no keys configured — open access

  const key = req.headers['x-api-key'];
  if (!key || !allowedKeys.has(key)) {
    return res.status(401).json({ error: 'Invalid or missing X-API-Key header' });
  }

  next();
}

module.exports = { apiKeyAuth };

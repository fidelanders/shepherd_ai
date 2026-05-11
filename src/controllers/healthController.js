'use strict';

const env = require('../config/env');
const { hasInternet } = require('../utils/network');
const { isForcedOffline, getOfflineState, clearForcedOffline } = require('../utils/offlineState');

async function health(req, res) {
  const [online, forcedOffline] = await Promise.all([hasInternet(), isForcedOffline()]);

  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '3.0.0',
    mode: forcedOffline || !online ? 'offline' : 'online',
    services: {
      openai: !!env.OPENAI_API_KEY,
      gemini: !!env.GEMINI_API_KEY,
      huggingface: !!env.HF_TOKEN,
    },
  });
}

async function getOfflineMode(req, res) {
  const [online, state] = await Promise.all([hasInternet(), getOfflineState()]);

  return res.json({
    forcedOffline: !!state,
    reason: state?.reason ?? null,
    since: state?.since ?? null,
    autoResets: state ? 'within 24 hours' : null,
    envOffline: env.OFFLINE_MODE,
    hasInternet: online,
  });
}

async function clearOfflineMode(req, res) {
  await clearForcedOffline();
  return res.json({
    message: 'Forced offline mode cleared. Online transcription will be attempted on the next job.',
  });
}

module.exports = { health, getOfflineMode, clearOfflineMode };

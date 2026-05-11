'use strict';

const IORedis = require('ioredis');
const env = require('./env');

let _client = null;

/**
 * Returns a shared ioredis client.
 * Call createConnection() when BullMQ needs a dedicated connection.
 */
function getClient() {
  if (!_client) {
    _client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    _client.on('connect', () => console.log('✅ Redis connected'));
    _client.on('error', err => console.error('❌ Redis error:', err.message));
  }
  return _client;
}

/**
 * Creates a fresh independent connection (required by BullMQ workers/queues).
 */
function createConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

module.exports = { getClient, createConnection };

'use strict';

/**
 * JobRepository — all Redis reads/writes go through here.
 *
 * Jobs live in Redis under keys:  job:<id>
 * TTL: completed/failed jobs expire after 7 days automatically.
 *
 * This is the single source of truth — no disk JSON store.
 */

const { getClient } = require('../config/redis');

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const KEY = id => `job:${id}`;

class JobRepository {
  constructor() {
    this._redis = getClient();
  }

  /** Save a new job (queued state). */
  async create(jobData) {
    await this._redis.set(KEY(jobData.id), JSON.stringify(jobData));
    return jobData;
  }

  /** Fetch a job by id. Returns null if not found. */
  async findById(id) {
    const raw = await this._redis.get(KEY(id));
    return raw ? JSON.parse(raw) : null;
  }

  /** Partial update — merges fields into existing job. */
  async update(id, fields) {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Job ${id} not found`);

    const updated = { ...existing, ...fields, updatedAt: new Date().toISOString() };
    await this._redis.set(KEY(id), JSON.stringify(updated));
    return updated;
  }

  /** Mark job as completed and set TTL. */
  async complete(id, results) {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Job ${id} not found`);

    const completed = {
      ...existing,
      status: 'completed',
      progress: 100,
      step: 'Complete',
      results,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this._redis.set(KEY(id), JSON.stringify(completed), 'EX', JOB_TTL_SECONDS);
    return completed;
  }

  /** Mark job as failed and set TTL. */
  async fail(id, errorMessage) {
    const existing = await this.findById(id);
    const base = existing || { id };

    const failed = {
      ...base,
      status: 'failed',
      step: 'Failed',
      error: errorMessage,
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this._redis.set(KEY(id), JSON.stringify(failed), 'EX', JOB_TTL_SECONDS);
    return failed;
  }

  /** Update progress percentage and step label. */
  async setProgress(id, progress, step) {
    return this.update(id, { progress, step, status: 'processing' });
  }

  /** Count all jobs matching a status (requires SCAN — use sparingly). */
  async countByStatus(status) {
    let count = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this._redis.scan(cursor, 'MATCH', 'job:*', 'COUNT', 100);
      cursor = nextCursor;
      for (const key of keys) {
        const raw = await this._redis.get(key);
        if (raw) {
          const job = JSON.parse(raw);
          if (!status || job.status === status) count++;
        }
      }
    } while (cursor !== '0');
    return count;
  }

  /** Total job count (approximate via SCAN). */
  async count() {
    return this.countByStatus(null);
  }
}

// Singleton
let _instance = null;
function getJobRepository() {
  if (!_instance) _instance = new JobRepository();
  return _instance;
}

module.exports = { JobRepository, getJobRepository };

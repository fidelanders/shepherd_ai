'use strict';

const { Queue } = require('bullmq');
const { createConnection } = require('../config/redis');

const transcriptionQueue = new Queue('transcription', {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 }, // keep last 100 completed BullMQ records
    removeOnFail: { count: 50 },
  },
});

module.exports = transcriptionQueue;

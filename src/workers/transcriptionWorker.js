'use strict';

require('../../src/config/env'); // validate env on worker startup

const { Worker } = require('bullmq');
const { createConnection } = require('../config/redis');
const { getJobRepository } = require('../repositories/jobRepository');
const processTranscription = require('../pipelines/processTranscription');

const TranscriptionService = require('../services/transcriptionService');
const SpeakerDiarizationService = require('../services/speakerDiarization');
const BibleVerseService = require('../services/bibleVerseService');
const AIService = require('../services/aiService');

// Shared service instances
const services = {
  transcriptionService: new TranscriptionService(),
  speakerService: new SpeakerDiarizationService(),
  bibleService: new BibleVerseService(),
  aiService: new AIService(),
  jobRepository: getJobRepository(),
};

const worker = new Worker(
  'transcription',
  async (job) => {
    const { jobId, filePath, fileName } = job.data;
    const attempt = job.attemptsMade + 1;  // BullMQ attemptsMade is 0-indexed
    const maxAttempts = job.opts?.attempts ?? 3;

    return processTranscription(jobId, filePath, fileName, services, attempt, maxAttempts);
  },
  {
    connection: createConnection(),
    concurrency: 2,
  }
);

worker.on('completed', job => console.log(`✅ BullMQ job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`❌ BullMQ job ${job?.id} failed:`, err.message));
worker.on('error', err => console.error('Worker error:', err));

console.log('🔧 Transcription worker started');

module.exports = worker;
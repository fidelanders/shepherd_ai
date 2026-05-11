'use strict';

const { v4: uuidv4 } = require('uuid');
const { getJobRepository } = require('../repositories/jobRepository');
const transcriptionQueue = require('../queues/transcriptionQueue');

async function startTranscription(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided. Use field name "audio".' });
  }

  const jobId = uuidv4();
  const repo = getJobRepository();

  const jobData = {
    id: jobId,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    status: 'queued',
    progress: 0,
    step: 'Queued',
    createdAt: new Date().toISOString(),
  };

  await repo.create(jobData);

  await transcriptionQueue.add('process', {
    jobId,
    filePath: req.file.path,
    fileName: req.file.originalname,
  });

  return res.status(202).json({ jobId, status: 'queued' });
}

module.exports = { startTranscription };

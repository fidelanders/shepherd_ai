'use strict';

const { getJobRepository } = require('../repositories/jobRepository');

async function getJob(req, res) {
  const repo = getJobRepository();
  const job = await repo.findById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json(job);
}

module.exports = { getJob };

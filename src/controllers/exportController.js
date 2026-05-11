'use strict';

const path = require('path');
const { getJobRepository } = require('../repositories/jobRepository');
const ExportService = require('../services/exportService');

const exportService = new ExportService();
const SUPPORTED_FORMATS = ['txt', 'srt', 'docx', 'json'];

async function getFormats(req, res) {
  return res.json({
    formats: [
      { format: 'txt',  extension: 'txt',  description: 'Plain text transcript with summary and discussion questions' },
      { format: 'srt',  extension: 'srt',  description: 'SubRip subtitle file with timestamps' },
      { format: 'docx', extension: 'docx', description: 'Microsoft Word document with formatted sections' },
      { format: 'json', extension: 'json', description: 'Full raw JSON results' },
    ],
  });
}

async function exportJob(req, res) {
  const { jobId, format } = req.params;

  if (!SUPPORTED_FORMATS.includes(format)) {
    return res.status(400).json({
      error: `Unsupported format "${format}". Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    });
  }

  // Single source of truth — read from Redis
  const repo = getJobRepository();
  const job = await repo.findById(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(409).json({
      error: `Job is not completed yet (status: ${job.status})`,
    });
  }

  if (!job.results) {
    return res.status(404).json({ error: 'No results available for this job' });
  }

  try {
    const exportPath = await exportService.exportFormat(job.results, format, jobId);
    const baseName = path.basename(job.fileName || 'sermon', path.extname(job.fileName || ''));
    const downloadName = `${baseName}_${format}.${exportService.getExtension(format)}`;
    return res.download(exportPath, downloadName);
  } catch (err) {
    console.error(`Export error [${jobId}/${format}]:`, err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getFormats, exportJob };

'use strict';

const express = require('express');
const router = express.Router();
const { getFormats, exportJob } = require('../controllers/exportController');

/**
 * @swagger
 * /api/export/formats:
 *   get:
 *     summary: List supported export formats
 *     tags: [Export]
 *     responses:
 *       200:
 *         description: Available formats
 */
router.get('/export/formats', getFormats);

/**
 * @swagger
 * /api/export/{jobId}/{format}:
 *   get:
 *     summary: Download sermon results
 *     description: |
 *       **Supported formats:** txt · srt · docx · json
 *
 *       The job must have status `completed` before export is available.
 *     tags: [Export]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [txt, srt, docx, json]
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Unsupported format
 *       404:
 *         description: Job not found
 *       409:
 *         description: Job not yet completed
 *       500:
 *         description: Export generation failed
 */
router.get('/export/:jobId/:format', exportJob);

module.exports = router;

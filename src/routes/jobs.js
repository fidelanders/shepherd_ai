'use strict';

const express = require('express');
const router = express.Router();
const { getJob } = require('../controllers/jobController');

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get job status and results
 *     tags: [Jobs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatus'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/jobs/:id', getJob);

module.exports = router;

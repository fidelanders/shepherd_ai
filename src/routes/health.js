'use strict';

const express = require('express');
const router = express.Router();
const { health, getOfflineMode, clearOfflineMode } = require('../controllers/healthController');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Server health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 *                 uptime: { type: number }
 *                 version: { type: string }
 *                 mode: { type: string, enum: [online, offline] }
 *                 services:
 *                   type: object
 *                   properties:
 *                     openai: { type: boolean }
 *                     gemini: { type: boolean }
 *                     huggingface: { type: boolean }
 */
router.get('/health', health);

/**
 * @swagger
 * /api/offline-mode:
 *   get:
 *     summary: Get offline mode status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Offline mode details
 *   delete:
 *     summary: Clear forced offline mode
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Offline mode cleared
 */
router.get('/offline-mode', getOfflineMode);
router.delete('/offline-mode', clearOfflineMode);

module.exports = router;

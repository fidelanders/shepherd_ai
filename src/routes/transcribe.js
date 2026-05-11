'use strict';

const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { startTranscription } = require('../controllers/transcriptionController');

/**
 * @swagger
 * /api/transcribe:
 *   post:
 *     summary: Upload audio and start transcription
 *     tags: [Transcription]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (mp3, wav, m4a, aac, flac, ogg, mp4, mpeg — max 500 MB)
 *     responses:
 *       202:
 *         description: Job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId: { type: string, format: uuid }
 *                 status: { type: string, example: queued }
 *       400:
 *         description: No file or invalid file type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: File too large
 *       429:
 *         description: Too many requests
 */
router.post('/transcribe', uploadLimiter, upload.single('audio'), startTranscription);

module.exports = router;

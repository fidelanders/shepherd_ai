'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shepherd AI API',
      version: '3.0.0',
      description: `
## Shepherd AI – Sermon Intelligence Backend

A backend service that transcribes sermon audio, detects Bible verses, identifies speakers, and generates AI-powered insights.

### Key Features
- **Transcription** – Audio upload & transcription via OpenAI Whisper or local whisper.cpp
- **Speaker Diarization** – Identifies who is speaking and when via pyannote-audio
- **Bible Verse Detection** – Detects and links scripture references across all 66 books
- **AI Insights** – Summary, themes, discussion questions, delivery analysis via Gemini
- **Export** – Download as TXT, SRT, DOCX, or JSON

### Authentication
All endpoints (except \`/api/health\`) require the \`X-API-Key\` header when \`API_KEYS\` is configured.

### Offline Mode
If OpenAI quota is exceeded the backend auto-switches to local whisper.cpp.
      `,
      contact: { name: 'Shepherd AI Support', email: 'support@shepherd.ai' },
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local Development' }],
    tags: [
      { name: 'Health', description: 'Server health and status checks' },
      { name: 'Transcription', description: 'Upload audio and start transcription jobs' },
      { name: 'Jobs', description: 'Monitor and manage transcription jobs' },
      { name: 'Export', description: 'Download results in various formats' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        JobStatus: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fileName: { type: 'string', example: 'sunday-sermon.mp3' },
            fileSize: { type: 'number', example: 5242880 },
            status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            step: { type: 'string', example: 'Transcribing…' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SermonResults: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fileName: { type: 'string' },
            duration: { type: 'string', example: '14:32' },
            wordCount: { type: 'number' },
            confidence: { type: 'number' },
            transcript: { type: 'string' },
            segments: { type: 'array', items: { $ref: '#/components/schemas/Segment' } },
            speakers: { type: 'array', items: { $ref: '#/components/schemas/Speaker' } },
            verses: { type: 'array', items: { $ref: '#/components/schemas/BibleVerse' } },
            highlights: { type: 'array', items: { $ref: '#/components/schemas/Highlight' } },
            themes: { type: 'array', items: { $ref: '#/components/schemas/Theme' } },
            chapters: { type: 'array', items: { $ref: '#/components/schemas/Chapter' } },
            summary: { type: 'string' },
            newsletter: { type: 'string' },
            questions: { type: 'array', items: { type: 'string' } },
            delivery: { type: 'array', items: { type: 'object', properties: { k: { type: 'string' }, v: { type: 'string' } } } },
          },
        },
        Segment: {
          type: 'object',
          properties: {
            start: { type: 'number' }, end: { type: 'number' },
            text: { type: 'string' }, confidence: { type: 'number' },
            speaker: { type: 'string' }, speakerId: { type: 'number' },
          },
        },
        Speaker: {
          type: 'object',
          properties: {
            id: { type: 'number' }, name: { type: 'string' },
            color: { type: 'string' }, percentage: { type: 'number' },
            role: { type: 'string' },
          },
        },
        BibleVerse: {
          type: 'object',
          properties: {
            ref: { type: 'string', example: 'John 3:16' },
            trans: { type: 'string', example: 'ESV' },
            time: { type: 'string', example: '05:44' },
            type: { type: 'string' },
            text: { type: 'string' },
          },
        },
        Highlight: {
          type: 'object',
          properties: {
            id: { type: 'number' }, text: { type: 'string' },
            time: { type: 'string' }, type: { type: 'string' },
            speaker: { type: 'string' }, verse: { type: 'string' },
          },
        },
        Theme: {
          type: 'object',
          properties: { label: { type: 'string' }, pct: { type: 'number' }, color: { type: 'string' } },
        },
        Chapter: {
          type: 'object',
          properties: {
            label: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
            pS: { type: 'number' }, pE: { type: 'number' }, summary: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);

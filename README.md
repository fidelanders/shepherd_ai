# 🐑 Shepherd AI Backend v3.0

A production-ready Node.js backend for sermon transcription and AI-powered insights.

## What it does

1. **Accepts** audio uploads (MP3, WAV, M4A, AAC, FLAC, OGG, MP4 — up to 500 MB)
2. **Transcribes** using OpenAI Whisper (online) or local `whisper.cpp` (offline fallback)
3. **Diarizes** speakers using pyannote-audio (requires Python + HF token)
4. **Detects** Bible verse references across all 66 books
5. **Generates** AI insights (summary, themes, chapters, questions, newsletter) via Gemini
6. **Exports** results as TXT, SRT, DOCX, or JSON

---

## Architecture

```
server.js
└── src/
    ├── config/         env, redis, multer, swagger
    ├── middleware/     auth, rateLimiter, errorHandler
    ├── routes/         health, transcribe, jobs, export
    ├── controllers/    thin handlers — validate input, call services
    ├── repositories/   JobRepository (single Redis source of truth)
    ├── queues/         BullMQ transcription queue
    ├── workers/        BullMQ worker
    ├── pipelines/      processTranscription (orchestrates services)
    ├── services/       transcription, diarization, bibleVerse, ai, export
    └── utils/          network, offlineState, whisperCpp, cleanup
```

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start (worker runs in same process in dev)
npm run dev
```

Open **http://localhost:5000/api-docs** for the interactive API docs.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `REDIS_URL` | ✅ | Redis connection URL (local or Upstash) |
| `OPENAI_API_KEY` | ✓ online | OpenAI API key for Whisper transcription |
| `GEMINI_API_KEY` | ✓ insights | Google Gemini API key for AI insights |
| `HF_TOKEN` | ✓ diarize | HuggingFace token for pyannote speaker diarization |
| `API_KEYS` | recommended | Comma-separated API keys for X-API-Key auth |
| `WHISPER_BIN` | offline | Path to whisper-cli binary (auto-detected by OS) |
| `WHISPER_MODEL` | offline | Path to GGML model file |
| `OFFLINE_MODE` | optional | `true` to force local whisper.cpp always |
| `PORT` | optional | Server port (default: 5000) |
| `NODE_ENV` | optional | `development` or `production` |
| `ALLOWED_ORIGINS` | optional | Comma-separated CORS origins (default: `*`) |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check (no auth required) |
| GET | `/api/offline-mode` | Offline mode status |
| DELETE | `/api/offline-mode` | Clear forced offline mode |
| POST | `/api/transcribe` | Upload audio and start job |
| GET | `/api/jobs/:id` | Poll job status and results |
| GET | `/api/export/formats` | List export formats |
| GET | `/api/export/:jobId/:format` | Download results |

All endpoints except `/api/health` require `X-API-Key` header when `API_KEYS` is set.

---

## Running the worker separately (production)

In production, run the worker in a separate process:

```bash
# Terminal 1 — HTTP server (no worker)
node server.js

# Terminal 2 — worker
node src/workers/transcriptionWorker.js
```

To run inline (development), just `npm run dev` — the worker starts automatically.

---

## Offline / whisper.cpp setup

1. Clone and build whisper.cpp: https://github.com/ggerganov/whisper.cpp
2. Download a model: `bash models/download-ggml-model.sh base`
3. Set `WHISPER_BIN` and `WHISPER_MODEL` in `.env`, or rely on auto-detection

The system automatically falls back to whisper.cpp when:
- `OFFLINE_MODE=true` in env
- No internet connectivity detected
- OpenAI quota is exhausted (auto-resets after 24h)

---

## Speaker diarization (pyannote)

Requires Python 3.8+ with pyannote.audio installed:

```bash
pip install pyannote.audio torch
```

Set `HF_TOKEN` in `.env`. Without it, the system uses a mock diarization.

---

## What changed from v2.x

| Issue | Fix |
|---|---|
| Redis vs disk store out of sync | Single `JobRepository` — Redis only |
| `docx` export was just a `.txt` file | Real DOCX generation via `docx` npm package |
| Shell injection in pyannote exec | Replaced `exec()` with `spawn()` args array |
| Hardcoded Windows `.exe` path | Cross-platform binary resolution via `process.platform` |
| No auth or rate limiting | `X-API-Key` middleware + `express-rate-limit` |
| Only 7 Bible books detected | All 66 books with common abbreviations |
| Temp files not cleaned on failure | `finally` block always deletes temp files |
| OpenAI client created per-request | Single instance created in constructor |
| DNS-only connectivity check | Real HTTPS probe to api.openai.com |
| Offline flag in local file | Redis key with 24h TTL (multi-instance safe) |
| No request logging | Morgan middleware |
| No env validation | Zod schema with descriptive errors on startup |
| Business logic in routes | Controllers + repository pattern |

'use strict';

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');
const env = require('../config/env');
const { runWhisperCpp } = require('../utils/whisperCpp');
const { hasInternet } = require('../utils/network');
const { isForcedOffline, setForcedOffline } = require('../utils/offlineState');

// Use system ffmpeg — resolves cross-platform without ffmpeg-static
function resolveSystemFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ].filter(Boolean);

  for (const p of candidates) {
    try { execSync(`"${p}" -version`, { stdio: 'ignore' }); return p; } catch {}
  }
  // Last resort: let fluent-ffmpeg find it on PATH
  return 'ffmpeg';
}
ffmpeg.setFfmpegPath(resolveSystemFfmpeg());

class TranscriptionService {
  constructor() {
    // Instantiate OpenAI client once — not per request
    this._openai = null;
    if (env.OPENAI_API_KEY) {
      const { OpenAI } = require('openai');
      this._openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  // ─── Audio utilities ─────────────────────────────────────────

  async validateAudio(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(new Error(`Invalid audio file: ${err.message}`));
        else resolve(metadata);
      });
    });
  }

  async convertToWav(filePath) {
    const tempDir = path.join(process.cwd(), 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `${Date.now()}_converted.wav`);

    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(new Error(`Audio conversion failed: ${err.message}`)))
        .save(outputPath);
    });
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 0);
      });
    });
  }

  // ─── Transcription entry point ────────────────────────────────

  async transcribe(audioPath) {
    const forcedOffline = await isForcedOffline();
    const online = forcedOffline ? false : await hasInternet();
    const useOffline = env.OFFLINE_MODE || forcedOffline || !online || !this._openai;

    if (useOffline) {
      console.log('⚡ Using local whisper.cpp');
      return this._transcribeLocal(audioPath);
    }

    try {
      console.log('☁️  Using OpenAI Whisper');
      return await this._transcribeOpenAI(audioPath);
    } catch (err) {
      console.error('OpenAI transcription failed:', err.message);

      // Detect quota exhaustion — switch to offline for 24h
      if (err.status === 429 || err.code === 'insufficient_quota' || err.message?.includes('quota')) {
        console.warn('⚠️ OpenAI quota exceeded — switching to offline mode for 24h');
        await setForcedOffline({ reason: 'quota', since: Date.now() });
      }

      console.log('🔁 Falling back to local whisper.cpp…');
      return this._transcribeLocal(audioPath);
    }
  }

  // ─── OpenAI Whisper ───────────────────────────────────────────

  async _transcribeOpenAI(audioPath) {
    const transcription = await this._openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'gpt-4o-transcribe',
    });

    console.log('WHISPER RAW RESULT:', JSON.stringify(result, null, 2));

    const segments = Array.isArray(transcription.segments) ? transcription.segments : [];
    const confidence = this._avgConfidence(segments);

    return {
      fullText: transcription.text || '',
      duration: this.formatDuration(transcription.duration || 0),
      confidence,
      wordCount: (transcription.text || '').split(/\s+/).filter(Boolean).length,
      segments: segments.map(seg => ({
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        text: seg.text || '',
        confidence: Math.exp(seg.avg_logprob ?? -1),
      })),
    };
  }

  // ─── Local whisper.cpp ────────────────────────────────────────

  async _transcribeLocal(audioPath) {
    const tempDir = path.join(process.cwd(), 'temp');
    const result = await runWhisperCpp(audioPath, tempDir);
    const duration = await this.getAudioDuration(audioPath);

    const segments = Array.isArray(result.segments) ? result.segments : [];
    const confidence = this._avgConfidence(segments);

    const fullText = result.text || segments.map(s => s.text).join(' ');

    return {
      fullText,
      duration: this.formatDuration(duration),
      confidence,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      segments: segments.map(seg => ({
        start: seg.start ?? (seg.t0 ?? 0) / 100,
        end: seg.end ?? (seg.t1 ?? 0) / 100,
        text: seg.text || '',
        confidence: Math.exp(seg.avg_logprob ?? -1),
      })),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  _avgConfidence(segments) {
    if (!segments.length) return null;
    const avg = segments.reduce((acc, s) => acc + (s.avg_logprob ?? -1), 0) / segments.length;
    return Math.round(Math.exp(avg) * 10000) / 100; // e.g. 97.43
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

module.exports = TranscriptionService;

'use strict';

const { spawn } = require('child_process');
const env = require('../config/env');

const SPEAKER_COLORS = ['#1e3a5f', '#3a5a40', '#9c8e87', '#d8cfc0', '#b8860b', '#6b3a8b'];

class SpeakerDiarizationService {
  /**
   * Runs pyannote speaker diarization via spawn (no shell injection).
   * Falls back to mock diarization if pyannote or HF_TOKEN is unavailable.
   */
  async diarize(audioPath, segments) {
    if (!env.HF_TOKEN) {
      console.warn('No HF_TOKEN — skipping real diarization, using mock');
      return this._getMockDiarization(segments);
    }

    try {
      const stdout = await this._runPyannote(audioPath);
      return this._parseDiarizationOutput(stdout, segments);
    } catch (err) {
      console.warn('Speaker diarization failed, using fallback:', err.message);
      return this._getMockDiarization(segments);
    }
  }

  // ─── pyannote via spawn (safe) ────────────────────────────────

  _runPyannote(audioPath) {
    return new Promise((resolve, reject) => {
      // Pass args as array — spawn does NOT invoke a shell,
      // so audioPath and HF_TOKEN cannot inject shell commands.
      const script = `
import sys
import torch
from pyannote.audio import Pipeline
pipeline = Pipeline.from_pretrained(
    'pyannote/speaker-diarization-3.1',
    use_auth_token=sys.argv[2]
)
diarization = pipeline(sys.argv[1])
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f'{turn.start:.2f} {turn.end:.2f} {speaker}')
`.trim();

      const proc = spawn('python3', ['-c', script, audioPath, env.HF_TOKEN], {
        timeout: 300_000,
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', d => (stdout += d.toString()));
      proc.stderr.on('data', d => (stderr += d.toString()));

      proc.on('close', code => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`pyannote exited with code ${code}: ${stderr.slice(0, 300)}`));
      });

      proc.on('error', err => reject(new Error(`Failed to spawn python3: ${err.message}`)));
    });
  }

  // ─── Parse pyannote output ────────────────────────────────────

  _parseDiarizationOutput(stdout, segments) {
    const lines = stdout.trim().split('\n').filter(Boolean);
    const speakerRegistry = new Map();

    // Build speaker registry in order of first appearance
    for (const line of lines) {
      const [, , name] = line.split(' ');
      if (name && !speakerRegistry.has(name)) {
        const id = speakerRegistry.size;
        speakerRegistry.set(name, {
          id,
          name,
          color: SPEAKER_COLORS[id % SPEAKER_COLORS.length],
          totalTime: 0,
        });
      }
    }

    const intervals = lines.map(line => {
      const [start, end, name] = line.split(' ');
      return { start: parseFloat(start), end: parseFloat(end), name };
    });

    const assignedSegments = segments.map(seg => {
      const mid = (seg.start + seg.end) / 2;
      const match = intervals.find(iv => mid >= iv.start && mid <= iv.end);
      const speakerName = match?.name ?? 'Unknown';
      const speaker = speakerRegistry.get(speakerName) ?? { id: -1, name: 'Unknown', color: '#aaaaaa' };

      if (speakerRegistry.has(speakerName)) {
        speakerRegistry.get(speakerName).totalTime += seg.end - seg.start;
      }

      return { ...seg, speaker: speaker.name, speakerId: speaker.id };
    });

    const totalTime = assignedSegments.reduce((acc, s) => acc + (s.end - s.start), 0) || 1;

    const speakers = Array.from(speakerRegistry.values()).map(sp => ({
      id: sp.id,
      name: sp.name,
      color: sp.color,
      percentage: Math.round((sp.totalTime / totalTime) * 100),
      role: sp.id === 0 ? 'speaker' : 'other',
    }));

    return { segments: assignedSegments, speakers };
  }

  // ─── Mock fallback ────────────────────────────────────────────

  _getMockDiarization(segments) {
    const speakers = [
      { id: 0, name: 'Pastor', color: SPEAKER_COLORS[0], percentage: 87, role: 'speaker' },
      { id: 1, name: 'Congregation', color: SPEAKER_COLORS[1], percentage: 7, role: 'response' },
      { id: 2, name: 'Worship Team', color: SPEAKER_COLORS[2], percentage: 4, role: 'music' },
      { id: 3, name: 'Other', color: SPEAKER_COLORS[3], percentage: 2, role: 'other' },
    ];

    const assignedSegments = (segments || []).map((seg, idx) => {
      let speaker = speakers[0];
      if (idx % 12 === 7) speaker = speakers[1];
      else if (idx % 15 === 9) speaker = speakers[2];
      return { ...seg, speaker: speaker.name, speakerId: speaker.id };
    });

    return { segments: assignedSegments, speakers };
  }
}

module.exports = SpeakerDiarizationService;

'use strict';

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const env = require('../config/env');

/**
 * Resolve whisper.cpp binary
 */
function resolveWhisperBin() {
  // 1. Explicit env override
  if (env.WHISPER_BIN && fs.existsSync(env.WHISPER_BIN)) {
    return env.WHISPER_BIN;
  }

  const base = path.join(
    process.cwd(),
    'whisper.cpp',
    'build',
    'bin'
  );

  // 2. Try all possible binary names
  const candidates = [
    // Linux/macOS newer builds
    path.join(base, 'whisper-cli'),

    // Older whisper.cpp builds
    path.join(base, 'main'),

    // Windows
    path.join(base, 'Release', 'whisper-cli.exe'),
    path.join(base, 'Release', 'main.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 3. Helpful debug output
  throw new Error(
    'No whisper.cpp binary found.\n\nChecked:\n' +
    candidates.join('\n')
  );
  console.log('Resolved whisper binary:', whisperBin);
}

/**
 * Resolve ggml model path
 */
function resolveModelPath() {
  if (env.WHISPER_MODEL) {
    return env.WHISPER_MODEL;
  }

  return path.join(
    process.cwd(),
    'whisper.cpp',
    'models',
    'ggml-base.bin'
  );
}

/**
 * Normalize whisper.cpp JSON output
 * Supports multiple whisper.cpp versions/formats
 */
function normalizeWhisperResult(raw) {
  let segments = [];

  // Common formats
  if (Array.isArray(raw.segments)) {
    segments = raw.segments;
  } else if (Array.isArray(raw.result?.segments)) {
    segments = raw.result.segments;
  } else if (Array.isArray(raw.transcription)) {
    segments = raw.transcription;
  }

  // Extract text safely
  let text =
    raw.text ||
    raw.result?.text ||
    '';

  // Fallback: build text from segments
  if (!text && segments.length) {
    text = segments
      .map(s => s.text || '')
      .join(' ')
      .trim();
  }

  return {
    text: text || '',
    segments,
    raw,
  };
}

/**
 * Run whisper.cpp safely
 */
async function runWhisperCpp(audioPath, outputDir) {
  const whisperBin = resolveWhisperBin();
  const modelPath = resolveModelPath();

  // ─────────────────────────────────────────────
  // Validate binary
  // ─────────────────────────────────────────────

  if (!fs.existsSync(whisperBin)) {
    throw new Error(
      `whisper-cli binary not found:\n${whisperBin}\n\n` +
      `Set WHISPER_BIN in .env or build whisper.cpp first.`
    );
  }

  // ─────────────────────────────────────────────
  // Validate model
  // ─────────────────────────────────────────────

  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `Whisper model not found:\n${modelPath}\n\n` +
      `Download a ggml model or set WHISPER_MODEL in .env`
    );
  }

  // ─────────────────────────────────────────────
  // Validate audio
  // ─────────────────────────────────────────────

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file does not exist: ${audioPath}`);
  }

  const stats = fs.statSync(audioPath);

  if (stats.size < 1000) {
    throw new Error(
      `Audio file too small (${stats.size} bytes): ${audioPath}`
    );
  }

  // ─────────────────────────────────────────────
  // Prepare output
  // ─────────────────────────────────────────────

  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = path.basename(
    audioPath,
    path.extname(audioPath)
  );

  const outputBase = path.join(outputDir, baseName);

  const jsonPath = `${outputBase}.json`;

  // Remove stale file
  if (fs.existsSync(jsonPath)) {
    fs.unlinkSync(jsonPath);
  }

  // ─────────────────────────────────────────────
  // Build args
  // ─────────────────────────────────────────────

  const args = [
    '-m',
    modelPath,
    '-f',
    audioPath,
    '-oj',
    '-of',
    outputBase,
  ];

  console.log('🎙 whisper.cpp starting...');
  console.log('Binary:', whisperBin);
  console.log('Model:', modelPath);
  console.log('Audio:', audioPath);
  console.log('Output:', outputBase);
  console.log('Args:', args.join(' '));

  // ─────────────────────────────────────────────
  // Execute whisper.cpp
  // ─────────────────────────────────────────────

  await new Promise((resolve, reject) => {
    const proc = spawn(whisperBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');

      reject(
        new Error(
          'whisper.cpp timed out after 5 minutes'
        )
      );
    }, 300000);

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('close', code => {
      clearTimeout(timeout);

      console.log('──── whisper.cpp stdout ────');
      console.log(stdout || '(empty)');

      console.log('──── whisper.cpp stderr ────');
      console.log(stderr || '(empty)');

      console.log('whisper.cpp exit code:', code);

      if (code !== 0) {
        return reject(
          new Error(
            `whisper.cpp failed with code ${code}\n\n` +
            `STDERR:\n${stderr}\n\n` +
            `STDOUT:\n${stdout}`
          )
        );
      }

      resolve();
    });
  });

  // ─────────────────────────────────────────────
  // Validate JSON output
  // ─────────────────────────────────────────────

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `whisper.cpp completed but JSON output missing:\n${jsonPath}`
    );
  }

  // ─────────────────────────────────────────────
  // Read + parse JSON
  // ─────────────────────────────────────────────

  let rawText;

  try {
    rawText = fs.readFileSync(jsonPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read whisper JSON:\n${err.message}`
    );
  }

  console.log('──── whisper JSON output ────');
  console.log(rawText);

  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Invalid whisper JSON:\n${err.message}\n\n${rawText}`
    );
  }

  // ─────────────────────────────────────────────
  // Normalize result
  // ─────────────────────────────────────────────

  const normalized = normalizeWhisperResult(parsed);

  // ─────────────────────────────────────────────
  // Validate transcript
  // ─────────────────────────────────────────────

  if (!normalized.text.trim()) {
    throw new Error(
      'whisper.cpp returned empty transcription.\n\n' +
      `Parsed result:\n${JSON.stringify(parsed, null, 2)}`
    );
  }

  console.log(
    `✅ whisper.cpp transcription complete (${normalized.text.length} chars)`
  );

  return normalized;
}

module.exports = {
  runWhisperCpp,
  resolveWhisperBin,
  resolveModelPath,
};
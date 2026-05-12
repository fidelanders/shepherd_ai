'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { deleteFiles } = require('../utils/cleanup');

/**
 * Main processing pipeline for a transcription job.
 *
 * Retry-safe file handling:
 * - original upload: copied to a job-specific temp file
 *   so retries can access it safely
 * - converted WAV: always deleted in finally
 */
async function processTranscription(jobId, originalFilePath, fileName, services, jobAttempt = 1, maxAttempts = 3) {
  const { transcriptionService, speakerService, bibleService, aiService, jobRepository } = services;

  const update = (progress, step) => {
    console.log(`  [${jobId}] ${progress}% — ${step}`);
    return jobRepository.setProgress(jobId, progress, step);
  };

  let success = false;
  let convertedPath = null;

  // --- Retry-safe temp file ---
  const jobTempDir = path.join(os.tmpdir(), `transcription-${jobId}`);
  await fs.promises.mkdir(jobTempDir, { recursive: true });
  const tempFilePath = path.join(jobTempDir, fileName);

  if (!fs.existsSync(tempFilePath)) {
    if (!fs.existsSync(originalFilePath)) {
      throw new Error(
        `Original upload file no longer exists at "${originalFilePath}". Cannot create retry copy.`
      );
    }
    await fs.promises.copyFile(originalFilePath, tempFilePath);
  }

  // Use temp file for all processing
  const filePath = tempFilePath;

  try {
    // --- 1. Validate ---
    await update(5, 'Validating audio…');
    await transcriptionService.validateAudio(filePath);

    // --- 2. Convert to 16kHz mono WAV ---
    await update(10, 'Converting audio…');
    convertedPath = await transcriptionService.convertToWav(filePath);

    // --- 3. Transcribe ---
    await update(25, 'Transcribing…');
    const transcript = await transcriptionService.transcribe(convertedPath);

    if (!transcript.fullText || transcript.fullText.trim().length === 0) {
      throw new Error(
        'Transcription returned empty text. ' +
        'Check your OPENAI_API_KEY or whisper.cpp setup.'
      );
    }

    // --- 4. Speaker diarization ---
    await update(55, 'Detecting speakers…');
    const diarization = await speakerService.diarize(convertedPath, transcript.segments || []);

    // --- 5. Bible verse detection ---
    await update(70, 'Detecting Bible verses…');
    const verses = await bibleService.detectVerses(transcript.fullText);

    // --- 6. AI insights ---
    await update(80, 'Generating insights…');
    const insights = await aiService.generateInsights(transcript.fullText, verses);

    // --- 7. Finalize ---
    await update(95, 'Finalising…');

    const results = {
      id: jobId,
      fileName,
      transcript: transcript.fullText,
      duration: transcript.duration,
      wordCount: transcript.wordCount,
      confidence: transcript.confidence,
      segments: diarization.segments || [],
      speakers: diarization.speakers || [],
      verses,
      ...insights,
    };

    await jobRepository.complete(jobId, results);
    console.log(`✅ [${jobId}] Pipeline complete — "${fileName}"`);
    success = true;
    return results;

  } catch (err) {
    console.error(`❌ [${jobId}] Pipeline failed (attempt ${jobAttempt}/${maxAttempts}): ${err.message}`);

    const isFinalAttempt = jobAttempt >= maxAttempts;
    if (isFinalAttempt) {
      await jobRepository.fail(jobId, err.message);
      console.error(`❌ [${jobId}] All ${maxAttempts} attempts exhausted. Job permanently failed.`);
    }

    throw err;

  } finally {
    // Always delete converted WAV
    deleteFiles(convertedPath);

    // Delete temp copy only on success or final attempt
    if (success || jobAttempt >= maxAttempts) {
      deleteFiles(filePath);
    }
  }
}

module.exports = processTranscription;
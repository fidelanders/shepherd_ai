'use strict';

const fs = require('fs');
const { deleteFiles } = require('../utils/cleanup');

/**
 * Main processing pipeline for a transcription job.
 *
 * File cleanup strategy:
 *   - convertedPath (temp WAV): always deleted in finally — regenerated each attempt
 *   - filePath (original upload): only deleted on success or final attempt
 *     so BullMQ retries can still read the file
 */
async function processTranscription(jobId, filePath, fileName, services, jobAttempt = 1, maxAttempts = 3) {
  const { transcriptionService, speakerService, bibleService, aiService, jobRepository } = services;

  const update = (progress, step) => {
    console.log(`  [${jobId}] ${progress}% — ${step}`);
    return jobRepository.setProgress(jobId, progress, step);
  };

  let convertedPath = null;
  let success = false;

  try {
    // Guard: ensure upload still exists (could be cleaned after a previous final attempt)
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Upload file no longer exists at "${filePath}". ` +
        `It may have been deleted after a previous failed attempt.`
      );
    }

    // ── 1. Validate ───────────────────────────────────────────────
    await update(5, 'Validating audio…');
    await transcriptionService.validateAudio(filePath);

    // ── 2. Convert to 16kHz mono WAV ──────────────────────────────
    await update(10, 'Converting audio…');
    convertedPath = await transcriptionService.convertToWav(filePath);

    // ── 3. Transcribe ─────────────────────────────────────────────
    await update(25, 'Transcribing…');
    const transcript = await transcriptionService.transcribe(convertedPath);

    // Hard-fail if transcription returned nothing — do not silently proceed
    if (!transcript.fullText || transcript.fullText.trim().length === 0) {
      throw new Error(
        'Transcription returned empty text. ' +
        'Check your OPENAI_API_KEY or whisper.cpp setup. ' +
        'See server logs for details.'
      );
    }

    // ── 4. Speaker diarization ────────────────────────────────────
    await update(55, 'Detecting speakers…');
    const diarization = await speakerService.diarize(convertedPath, transcript.segments || []);

    // ── 5. Bible verse detection ──────────────────────────────────
    await update(70, 'Detecting Bible verses…');
    const verses = await bibleService.detectVerses(transcript.fullText);

    // ── 6. AI insights ────────────────────────────────────────────
    await update(80, 'Generating insights…');
    const insights = await aiService.generateInsights(transcript.fullText, verses);

    // ── 7. Finalize ───────────────────────────────────────────────
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

    throw err; // Re-throw so BullMQ records the failure and triggers retry

  } finally {
    // Always delete the converted WAV — regenerated fresh each attempt
    deleteFiles(convertedPath);

    // Only delete the original upload when fully done
    if (success || jobAttempt >= maxAttempts) {
      deleteFiles(filePath);
    }
  }
}

module.exports = processTranscription;

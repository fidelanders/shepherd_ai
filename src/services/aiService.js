'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');

class AIService {
  constructor() {
    this._genAI = env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
      : null;
  }

  async generateInsights(fullText, verses = []) {

    // Transcript too short
    if (!fullText || fullText.trim().length < 20) {

      console.warn(
        '[AIService] Transcript empty or too short'
      );

      return {
        ...this._emptyInsights(),
        aiStatus: 'Transcript too short for AI analysis',
      };
    }

    // No Gemini configured
    if (!this._genAI) {

      console.warn(
        '[AIService] No GEMINI_API_KEY configured'
      );

      return {
        ...this._emptyInsights(),
        aiStatus:
          'AI analysis unavailable (missing GEMINI_API_KEY)',
      };
    }

    try {

      const insights = await this._generateWithGemini(
        fullText,
        verses
      );

      return {
        ...insights,
        aiStatus: 'success',
      };

    } catch (err) {

      console.error(
        '[AIService] Gemini failed:',
        err
      );

      return {
        ...this._emptyInsights(),
        aiStatus:
          'AI analysis temporarily unavailable',
        aiError: err.message,
      };
    }
  }

  _emptyInsights() {
    return {
      highlights: [],
      themes: [],
      summary: null,
      newsletter: null,
      questions: [],
      delivery: [],
      chapters: [],
    };
  }

  async _generateWithGemini(fullText, verses) {

    const MODEL_PRIORITY = [
      env.GEMINI_MODEL,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-pro',
    ].filter(Boolean);

    let lastError;

    for (const modelName of MODEL_PRIORITY) {

      try {

        console.log(
          `[AIService] Trying Gemini model: ${modelName}`
        );

        const model = this._genAI.getGenerativeModel({
          model: modelName,
        });

        return await this._callGemini(
          model,
          fullText,
          verses
        );

      } catch (err) {

        console.warn(
          `[AIService] Model failed: ${modelName}`,
          err.message
        );

        lastError = err;
      }
    }

    throw lastError || new Error('No Gemini model available');
  }

  async _callGemini(model, fullText, verses) {

    const prompt = `
Analyse this sermon transcript and return ONLY valid JSON.

Transcript:
"""
${fullText.substring(0, 4000)}
"""

Verses:
${JSON.stringify(verses.map(v => v.ref || v))}

Return:
{
  "summary": "",
  "themes": [],
  "highlights": [],
  "newsletter": "",
  "questions": [],
  "delivery": [],
  "chapters": []
}
`;

    const result = await model.generateContent(prompt);

    const raw = result.response.text();

    const clean = raw
      .replace(/```json|```/g, '')
      .trim();

    const jsonMatch = clean.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        'Gemini returned invalid JSON'
      );
    }

    return JSON.parse(jsonMatch[0]);
  }
}

module.exports = AIService;
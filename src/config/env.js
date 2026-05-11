'use strict';

require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis — required
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // API auth — optional in dev, enforced in prod
  API_KEYS: z.string().optional(),

  // External APIs — all optional (system gracefully degrades)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  HF_TOKEN: z.string().optional(),

  // Whisper.cpp local binary — optional, auto-detected otherwise
  WHISPER_BIN: z.string().optional(),
  WHISPER_MODEL: z.string().optional(),

  // Force offline mode
  OFFLINE_MODE: z.string().optional().transform(v => v === 'true'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('\n❌ Invalid environment configuration:\n');
  result.error.issues.forEach(issue => {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('\nSee .env.example for required variables.\n');
  process.exit(1);
}

module.exports = result.data;

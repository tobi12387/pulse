import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  OPENROUTER_API_KEY: z.string().min(1),
  FAST_MODEL: z.string().default('anthropic/claude-haiku-4-5'),
  SMART_MODEL: z.string().default('anthropic/claude-sonnet-4-5'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GARMIN_EMAIL: z.string().email(),
  GARMIN_PASSWORD:        z.string().min(1),
  GARMIN_SIDECAR_URL:     z.string().url().default('http://localhost:8001'),
  STRAVA_CLIENT_ID:       z.string().optional(),
  STRAVA_CLIENT_SECRET:   z.string().optional(),
  STRAVA_REDIRECT_URI:    z.string().url().optional(),
  GOOGLE_CLIENT_ID:       z.string().optional(),
  GOOGLE_CLIENT_SECRET:   z.string().optional(),
  APPLE_WEBHOOK_SECRET:   z.string().optional(),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().default(50),
  OPENAI_API_KEY: z.string().optional().transform(v => v || undefined), // für Whisper
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Ungültige Umgebungsvariablen:');
    for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;

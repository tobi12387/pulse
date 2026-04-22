import { describe, it, expect } from 'vitest';

describe('env validation', () => {
  it('validates JWT_SECRET minimum length via zod schema', async () => {
    const { z } = await import('zod');
    const schema = z.string().min(32);
    expect(schema.safeParse('tooshort').success).toBe(false);
    expect(schema.safeParse('a'.repeat(32)).success).toBe(true);
  });

  it('DATABASE_URL is defined in test environment', () => {
    expect(process.env['DATABASE_URL']).toBeDefined();
    expect(process.env['DATABASE_URL']).toContain('postgres');
  });
});

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.js';

describe('hashPassword / verifyPassword', () => {
  it('hashes password and verifies correctly', async () => {
    const hash = await hashPassword('mySecretPassword123!');
    expect(hash).not.toBe('mySecretPassword123!');
    expect(await verifyPassword(hash, 'mySecretPassword123!')).toBe(true);
    expect(await verifyPassword(hash, 'wrongPassword')).toBe(false);
  });

  it('produces different hashes for same password', async () => {
    const hash1 = await hashPassword('same');
    const hash2 = await hashPassword('same');
    expect(hash1).not.toBe(hash2);
  });
});

describe('signToken / verifyToken', () => {
  it('signs and verifies a token', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});

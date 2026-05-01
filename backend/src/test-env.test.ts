import { describe, expect, it, vi } from 'vitest';
import { configureTestEnvironment } from './test-env.js';

describe('configureTestEnvironment', () => {
  it('loads .env.test before .env and keeps an explicit test database', () => {
    const env: NodeJS.ProcessEnv = {};
    const dotenvConfig = vi.fn(({ path }: { path: string }) => {
      if (path.endsWith('.env.test')) {
        env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2';
        env['DATABASE_URL_TEST'] = 'postgresql://postgres:postgres@localhost:5433/pulse_explicit_test';
        env['REDIS_URL'] = 'redis://localhost:6380';
      }
      if (path.endsWith('.env')) {
        env['DATABASE_URL_TEST'] = 'postgresql://postgres:postgres@localhost:5433/should_not_win';
      }
      return { parsed: {} };
    });
    const existsSync = vi.fn((path: string) => path.endsWith('.env.test') || path.endsWith('.env'));

    configureTestEnvironment({
      rootDir: '/repo',
      env,
      existsSync,
      dotenvConfig,
    });

    expect(dotenvConfig.mock.calls.map(call => call[0].path)).toEqual(['/repo/.env.test', '/repo/.env']);
    expect(env['NODE_ENV']).toBe('test');
    expect(env['DATABASE_URL_TEST']).toBe('postgresql://postgres:postgres@localhost:5433/pulse_explicit_test');
    expect(env['REDIS_URL']).toBe('redis://localhost:6380');
  });

  it('derives a separate test database when only DATABASE_URL is available', () => {
    const env: NodeJS.ProcessEnv = {};
    const dotenvConfig = vi.fn(({ path }: { path: string }) => {
      if (path.endsWith('.env')) {
        env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2';
      }
      return { parsed: {} };
    });
    const existsSync = vi.fn((path: string) => path.endsWith('.env'));

    configureTestEnvironment({
      rootDir: '/repo',
      env,
      existsSync,
      dotenvConfig,
    });

    expect(env['NODE_ENV']).toBe('test');
    expect(env['DATABASE_URL_TEST']).toBe('postgresql://postgres:postgres@localhost:5433/coaching_os_v2_test');
  });

  it('uses .env.test.example when no private .env.test exists', () => {
    const env: NodeJS.ProcessEnv = {};
    const dotenvConfig = vi.fn(({ path }: { path: string }) => {
      if (path.endsWith('.env.test.example')) {
        env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2';
        env['DATABASE_URL_TEST'] = 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2_test';
        env['REDIS_URL'] = 'redis://localhost:6380';
      }
      return { parsed: {} };
    });
    const existsSync = vi.fn((path: string) => path.endsWith('.env.test.example'));

    configureTestEnvironment({
      rootDir: '/repo',
      env,
      existsSync,
      dotenvConfig,
    });

    expect(dotenvConfig.mock.calls.map(call => call[0].path)).toEqual(['/repo/.env.test.example']);
    expect(env['DATABASE_URL_TEST']).toBe('postgresql://postgres:postgres@localhost:5433/coaching_os_v2_test');
    expect(env['REDIS_URL']).toBe('redis://localhost:6380');
  });
});

import { existsSync as defaultExistsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as defaultDotenvConfig } from 'dotenv';

type DotenvConfig = (options: { path: string; override?: boolean }) => { parsed?: Record<string, string> };

export interface ConfigureTestEnvironmentOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  existsSync?: (path: string) => boolean;
  dotenvConfig?: DotenvConfig;
}

const TEST_ENV_PRIORITY_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_TEST',
  'REDIS_URL',
  'JWT_SECRET',
  'OPENROUTER_API_KEY',
  'GARMIN_EMAIL',
  'GARMIN_PASSWORD',
  'GARMIN_SIDECAR_URL',
];

function deriveTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1);
  url.pathname = `/${dbName.endsWith('_test') ? dbName : `${dbName}_test`}`;
  return url.toString();
}

export function configureTestEnvironment(options: ConfigureTestEnvironmentOptions = {}): void {
  const rootDir = options.rootDir ?? fileURLToPath(new URL('../..', import.meta.url));
  const env = options.env ?? process.env;
  const existsSync = options.existsSync ?? defaultExistsSync;
  const dotenvConfig = options.dotenvConfig ?? defaultDotenvConfig;

  const testEnvPath = resolve(rootDir, '.env.test');
  const testExampleEnvPath = resolve(rootDir, '.env.test.example');
  const baseEnvPath = resolve(rootDir, '.env');

  if (existsSync(testEnvPath)) {
    dotenvConfig({ path: testEnvPath, override: false });
  } else if (existsSync(testExampleEnvPath)) {
    dotenvConfig({ path: testExampleEnvPath, override: false });
  }

  const valuesFromTestEnv = Object.fromEntries(
    TEST_ENV_PRIORITY_KEYS
      .filter(key => env[key] != null)
      .map(key => [key, env[key]]),
  );

  if (existsSync(baseEnvPath)) {
    dotenvConfig({ path: baseEnvPath, override: false });
  }

  for (const [key, value] of Object.entries(valuesFromTestEnv)) {
    env[key] = value;
  }

  env['NODE_ENV'] = 'test';

  if (!env['DATABASE_URL_TEST'] && env['DATABASE_URL']) {
    env['DATABASE_URL_TEST'] = deriveTestDatabaseUrl(env['DATABASE_URL']);
  }
}

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { env } from './env.js';
import * as schema from '../db/schema.js';

function getConnectionString(): string {
  if (env.NODE_ENV !== 'test') return env.DATABASE_URL;

  if (!env.DATABASE_URL_TEST) {
    throw new Error('DATABASE_URL_TEST is required when NODE_ENV=test');
  }

  const prodDb = new URL(env.DATABASE_URL).pathname;
  const testDb = new URL(env.DATABASE_URL_TEST).pathname;
  if (prodDb === testDb) {
    throw new Error('DATABASE_URL_TEST must not point at the production database');
  }

  return env.DATABASE_URL_TEST;
}

const connectionString = getConnectionString();

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export type DB = typeof db;

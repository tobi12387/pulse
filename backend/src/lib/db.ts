import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { env } from './env.js';
import * as schema from '../db/schema.js';

const connectionString = env.NODE_ENV === 'test'
  ? (env.DATABASE_URL_TEST ?? env.DATABASE_URL)
  : env.DATABASE_URL;

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export type DB = typeof db;

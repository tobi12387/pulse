import { config } from 'dotenv';
config({ path: '../.env' });
process.env['NODE_ENV'] = 'test';

if (!process.env['DATABASE_URL_TEST'] && process.env['DATABASE_URL']) {
  const url = new URL(process.env['DATABASE_URL']);
  const dbName = url.pathname.slice(1);
  url.pathname = `/${dbName.endsWith('_test') ? dbName : `${dbName}_test`}`;
  process.env['DATABASE_URL_TEST'] = url.toString();
}

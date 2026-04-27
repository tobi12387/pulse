import { buildApp } from './app.js';
import { env } from './lib/env.js';

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Pulse backend läuft auf Port ${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

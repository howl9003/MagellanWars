import { buildApp } from './app.js';
import { startScheduler } from './game/scheduler.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const app = buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Server listening at http://${HOST}:${PORT}`);

  if (process.env['NODE_ENV'] !== 'test') {
    startScheduler();
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

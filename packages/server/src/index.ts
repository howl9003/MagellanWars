import { buildApp } from './app.js';
import { prisma } from './db/index.js';
import { startScheduler, stopScheduler, waitForSchedulerIdle } from './game/scheduler.js';

let app: ReturnType<typeof buildApp> | null = null;
let shuttingDown = false;

try {
  const port = readPort();
  const host = process.env['HOST'] ?? '0.0.0.0';

  app = buildApp();
  registerProcessHandlers();

  await prisma.$connect();
  await app.listen({ port, host });
  app.log.info(`Server listening at http://${host}:${port}`);

  if (process.env['NODE_ENV'] !== 'test') {
    startScheduler();
  }
} catch (err) {
  logError(err, 'Server failed to start.');
  stopScheduler();
  await prisma.$disconnect().catch((disconnectErr: unknown) => {
    logError(disconnectErr, 'Failed to disconnect Prisma after startup error.');
  });
  process.exit(1);
}

function readPort(): number {
  const value = Number(process.env['PORT'] ?? '3000');

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return value;
}

function registerProcessHandlers() {
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM', 0);
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT', 0);
  });

  process.on('unhandledRejection', (reason) => {
    logError(reason, 'Unhandled promise rejection.');
    void shutdown('unhandledRejection', 1);
  });

  process.on('uncaughtException', (err) => {
    if (app) {
      app.log.fatal({ err }, 'Uncaught exception.');
    } else {
      console.error('Uncaught exception.', err);
    }
    void shutdown('uncaughtException', 1);
  });
}

async function shutdown(reason: string, exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (app) {
    app.log.info({ reason }, 'Shutting down server.');
  } else {
    console.info('Shutting down server.', { reason });
  }

  stopScheduler();

  const schedulerIdle = await waitForSchedulerIdle();
  if (!schedulerIdle) {
    if (app) {
      app.log.warn('Scheduler turn did not finish before shutdown timeout.');
    } else {
      console.warn('Scheduler turn did not finish before shutdown timeout.');
    }
  }

  if (app) {
    await app.close().catch((err: unknown) => {
      logError(err, 'Failed to close Fastify cleanly.');
    });
  }

  await prisma.$disconnect().catch((err: unknown) => {
    logError(err, 'Failed to disconnect Prisma cleanly.');
  });

  process.exit(exitCode);
}

function logError(err: unknown, message: string) {
  if (app) {
    app.log.error({ err }, message);
  } else {
    console.error(message, err);
  }
}

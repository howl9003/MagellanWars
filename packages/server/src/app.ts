import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth.js';
import { playerRoutes } from './routes/player.js';
import { fleetRoutes } from './routes/fleet.js';
import { battleRoutes } from './routes/battle.js';
import { diplomacyRoutes } from './routes/diplomacy.js';
import { techRoutes } from './routes/tech.js';
import { councilRoutes } from './routes/council.js';
import { empireRoutes } from './routes/empire.js';
import { blackmarketRoutes } from './routes/blackmarket.js';
import { bountyRoutes } from './routes/bounty.js';
import { adminRoutes } from './routes/admin.js';
import { shipRoutes } from './routes/ship.js';
import { spyRoutes } from './routes/spy.js';
import { warRoutes } from './routes/war.js';
import { projectRoutes } from './routes/project.js';
import { infoRoutes } from './routes/info.js';
import { prisma } from './db/index.js';
import { getSchedulerStatus } from './game/scheduler.js';

const DEFAULT_JWT_SECRET = 'change-me-in-production';
const READINESS_TIMEOUT_MS = 2_000;

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  void app.register(sensible);

  void app.register(cors, {
    origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  void app.register(jwt, {
    secret: getJwtSecret(),
    sign: { expiresIn: '7d' },
  });

  void app.register(websocket);

  app.get('/health', () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    scheduler: getSchedulerStatus(),
    ts: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    const db = await checkDatabase();
    const body = {
      status: db.status === 'ok' ? 'ready' : 'not_ready',
      db,
      scheduler: getSchedulerStatus(),
      ts: new Date().toISOString(),
    };

    if (db.status !== 'ok') {
      return reply.code(503).send(body);
    }

    return body;
  });

  // API routes
  void app.register(authRoutes,       { prefix: '/api/auth' });
  void app.register(playerRoutes,     { prefix: '/api/player' });
  void app.register(fleetRoutes,      { prefix: '/api/fleet' });
  void app.register(battleRoutes,     { prefix: '/api/battle' });
  void app.register(diplomacyRoutes,  { prefix: '/api/diplomacy' });
  void app.register(techRoutes,       { prefix: '/api/tech' });
  void app.register(councilRoutes,    { prefix: '/api/council' });
  void app.register(empireRoutes,     { prefix: '/api/empire' });
  void app.register(blackmarketRoutes,{ prefix: '/api/blackmarket' });
  void app.register(bountyRoutes,     { prefix: '/api/bounty' });
  void app.register(adminRoutes,      { prefix: '/api/admin' });
  void app.register(shipRoutes,       { prefix: '/api/ship' });
  void app.register(spyRoutes,        { prefix: '/api/spy' });
  void app.register(warRoutes,        { prefix: '/api/war' });
  void app.register(projectRoutes,    { prefix: '/api/project' });
  void app.register(infoRoutes,       { prefix: '/api/info' });

  return app;
}

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'] ?? DEFAULT_JWT_SECRET;

  if (process.env['NODE_ENV'] === 'production' && secret === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to a non-default value in production.');
  }

  return secret;
}

async function checkDatabase() {
  const startedAt = Date.now();

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, READINESS_TIMEOUT_MS, 'Database readiness check timed out.');
    return { status: 'ok' as const, latencyMs: Date.now() - startedAt };
  } catch (err: unknown) {
    return {
      status: 'error' as const,
      latencyMs: Date.now() - startedAt,
      error: formatHealthError(err),
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function formatHealthError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
    secret: process.env['JWT_SECRET'] ?? 'change-me-in-production',
    sign: { expiresIn: '7d' },
  });

  void app.register(websocket);

  // Health check
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

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

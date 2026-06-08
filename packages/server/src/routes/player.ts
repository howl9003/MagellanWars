import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { RACE_BY_ID } from '../game/data/races.js';

export const playerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/player/me — full empire snapshot
  app.get('/me', async (request, reply) => {
    const { playerId } = getPayload(request);

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        planets: true,
        fleets: { include: { admiral: true } },
        admirals: true,
        council: { select: { id: true, name: true, speakerId: true } },
        techs: true,
        effects: { where: { life: { gt: 0 } } },
        events: { where: { answered: false } },
      },
    });

    if (!player) {
      return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });
    }

    const raceInfo = RACE_BY_ID.get(player.race);
    return reply.send({ data: { ...player, raceInfo } });
  });

  // GET /api/player/:id — public player profile
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.player.findUnique({
      where: { id: parseInt(id, 10) },
      select: {
        id: true,
        name: true,
        race: true,
        honor: true,
        rating: true,
        production: true,
        turn: true,
        councilId: true,
        council: { select: { id: true, name: true } },
        planets: { select: { id: true, name: true, population: true } },
        isAi: true,
      },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });
    return reply.send({ data: player });
  });

  // GET /api/player/rankings — top 100 players by rating
  app.get('/rankings', async (_request, reply) => {
    const players = await prisma.player.findMany({
      where: { mode: { not: 4 } },
      select: {
        id: true,
        name: true,
        race: true,
        rating: true,
        honor: true,
        production: true,
        turn: true,
        council: { select: { name: true } },
      },
      orderBy: { rating: 'desc' },
      take: 100,
    });

    return reply.send({ data: players });
  });

  // GET /api/player/search — search players by name
  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return reply.status(400).send({ error: 'Query too short', code: 'INVALID' });

    const players = await prisma.player.findMany({
      where: { name: { contains: q } },
      select: { id: true, name: true, race: true, honor: true, rating: true },
      take: 20,
    });

    return reply.send({ data: players });
  });

  // GET /api/player/me/news — recent news items (events + battle results)
  app.get('/me/news', async (request, reply) => {
    const { playerId } = getPayload(request);

    const [events, battles] = await Promise.all([
      prisma.playerEvent.findMany({
        where: { ownerId: playerId },
        orderBy: { time: 'desc' },
        take: 20,
      }),
      prisma.battleRecord.findMany({
        where: { OR: [{ attackerId: playerId }, { defenderId: playerId }] },
        orderBy: { time: 'desc' },
        take: 20,
      }),
    ]);

    return reply.send({ data: { events, battles } });
  });
};

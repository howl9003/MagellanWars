import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { processTurn } from '../game/turn.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAdmin);

  // GET /api/admin/players — list all players
  app.get('/players', async (request, reply) => {
    const qs = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
      search: z.string().optional(),
      isAi: z.coerce.boolean().optional(),
    }).safeParse(request.query);

    if (!qs.success) return reply.status(400).send({ error: 'Invalid query', code: 'VALIDATION_ERROR' });
    const { page, pageSize, search, isAi } = qs.data;

    const where = {
      ...(search ? { name: { contains: search } } : {}),
      ...(isAi !== undefined ? { isAi } : {}),
    };

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        include: { user: { select: { username: true, email: true, userLevel: true } } },
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.player.count({ where }),
    ]);

    return reply.send({ data: { players, total, page, pageSize } });
  });

  // GET /api/admin/players/:id
  app.get('/players/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.player.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        user: true,
        planets: true,
        fleets: true,
        admirals: true,
        techs: true,
        council: true,
      },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });
    return reply.send({ data: player });
  });

  // PATCH /api/admin/players/:id — update player (mode, honor, etc.)
  app.patch('/players/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      mode: z.number().int().min(0).max(4).optional(),
      honor: z.number().int().min(0).max(100).optional(),
      rating: z.number().int().min(0).optional(),
      production: z.number().int().min(0).optional(),
      research: z.number().int().min(0).optional(),
      protectedMode: z.boolean().optional(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.update({
      where: { id: parseInt(id, 10) },
      data: body.data,
    });
    return reply.send({ data: player });
  });

  // POST /api/admin/players/:id/ban
  app.post('/players/:id/ban', async (request, reply) => {
    const player = await prisma.player.update({
      where: { id: parseInt((request.params as { id: string }).id, 10) },
      data: { mode: 4 },
    });
    return reply.send({ data: { banned: player.id } });
  });

  // POST /api/admin/players/:id/unban
  app.post('/players/:id/unban', async (request, reply) => {
    const player = await prisma.player.update({
      where: { id: parseInt((request.params as { id: string }).id, 10) },
      data: { mode: 0 },
    });
    return reply.send({ data: { unbanned: player.id } });
  });

  // POST /api/admin/players/:id/grant-tech
  app.post('/players/:id/grant-tech', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ techId: z.number().int() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    await prisma.playerTech.upsert({
      where: { playerId_techId: { playerId: parseInt(id, 10), techId: body.data.techId } },
      update: {},
      create: { playerId: parseInt(id, 10), techId: body.data.techId },
    });
    return reply.send({ data: { granted: body.data.techId } });
  });

  // GET /api/admin/game-status
  app.get('/game-status', async (_request, reply) => {
    const status = await prisma.gameStatus.findUnique({ where: { id: 1 } });
    const [playerCount, planetCount, fleetCount] = await Promise.all([
      prisma.player.count({ where: { isAi: false } }),
      prisma.planet.count(),
      prisma.fleet.count(),
    ]);
    return reply.send({ data: { status, playerCount, planetCount, fleetCount } });
  });

  // POST /api/admin/force-turn — manually trigger a game turn
  app.post('/force-turn', async (_request, reply) => {
    const result = await processTurn();
    return reply.send({ data: result });
  });

  // GET /api/admin/councils
  app.get('/councils', async (_request, reply) => {
    const councils = await prisma.council.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { production: 'desc' },
    });
    return reply.send({ data: councils });
  });

  // DELETE /api/admin/councils/:id
  app.delete('/councils/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.$transaction([
      prisma.player.updateMany({ where: { councilId: parseInt(id, 10) }, data: { councilId: null } }),
      prisma.council.delete({ where: { id: parseInt(id, 10) } }),
    ]);
    return reply.send({ data: { disbanded: true } });
  });

  // GET /api/admin/blackmarket — all auctions including closed
  app.get('/blackmarket', async (_request, reply) => {
    const auctions = await prisma.blackmarket.findMany({
      include: { _count: { select: { bids: true } } },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });
    return reply.send({ data: auctions });
  });

  // GET /api/admin/bounties — all bounties
  app.get('/bounties', async (_request, reply) => {
    const bounties = await prisma.bounty.findMany({
      orderBy: { expireTime: 'desc' },
      take: 200,
    });
    return reply.send({ data: bounties });
  });

  // POST /api/admin/message-player — create a player event/notification
  app.post('/message-player', async (request, reply) => {
    const body = z.object({
      playerId: z.number().int(),
      eventType: z.number().int().min(1),
      lifeSpan: z.number().int().min(1).default(48),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const event = await prisma.playerEvent.create({
      data: {
        ownerId: body.data.playerId,
        event: body.data.eventType,
        life: body.data.lifeSpan,
      },
    });
    return reply.status(201).send({ data: event });
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';

// Empire actions: tribute, sanctions, etc. (mirror of legacy empire_action table)
const EMPIRE_ACTION = {
  TRIBUTE: 1,
  SANCTION: 2,
  AID: 3,
  GRANT_TITLE: 4,
  REVOKE_TITLE: 5,
} as const;

const setRatioSchema = z.object({
  planetId: z.number().int().positive(),
  ratioFactory: z.number().int().min(0).max(100),
  ratioMilitaryBase: z.number().int().min(0).max(100),
  ratioResearchLab: z.number().int().min(0).max(100),
}).refine((d) => d.ratioFactory + d.ratioMilitaryBase + d.ratioResearchLab === 100, {
  message: 'Ratios must sum to 100',
});

const buildSchema = z.object({
  planetId: z.number().int().positive(),
  type: z.enum(['factory', 'military_base', 'research_lab']),
});

const empireActionSchema = z.object({
  action: z.number().int().min(1).max(5),
  target: z.number().int(),
  amount: z.number().int().min(0).default(0),
});

export const empireRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/empire — overview of my empire
  app.get('/', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        planets: true,
        fleets: true,
        admirals: true,
        techs: true,
        council: { select: { id: true, name: true } },
        effects: { where: { life: { gt: 0 } } },
        events: { where: { answered: false } },
      },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });

    const gameStatus = await prisma.gameStatus.findUnique({ where: { id: 1 } });

    return reply.send({
      data: {
        player,
        currentTurn: gameStatus?.currentTurn ?? 0,
        lastGameTime: gameStatus?.lastGameTime,
      },
    });
  });

  // GET /api/empire/planets — planet list with details
  app.get('/planets', async (request, reply) => {
    const { playerId } = getPayload(request);
    const planets = await prisma.planet.findMany({ where: { ownerId: playerId } });
    return reply.send({ data: planets });
  });

  // PUT /api/empire/planets/:id/ratios — adjust production ratios
  app.put('/planets/:id/ratios', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };
    const body = setRatioSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid', code: 'VALIDATION_ERROR' });
    }

    const planet = await prisma.planet.findUnique({ where: { id: parseInt(id, 10) } });
    if (!planet || planet.ownerId !== playerId) {
      return reply.status(404).send({ error: 'Planet not found', code: 'NOT_FOUND' });
    }

    const updated = await prisma.planet.update({
      where: { id: planet.id },
      data: {
        ratioFactory: body.data.ratioFactory,
        ratioMilitaryBase: body.data.ratioMilitaryBase,
        ratioResearchLab: body.data.ratioResearchLab,
      },
    });
    return reply.send({ data: updated });
  });

  // POST /api/empire/planets/:id/build — queue a building construction
  app.post('/planets/:id/build', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };
    const body = buildSchema.safeParse({ ...request.body, planetId: parseInt(id, 10) });
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const planet = await prisma.planet.findUnique({ where: { id: parseInt(id, 10) } });
    if (!planet || planet.ownerId !== playerId) {
      return reply.status(404).send({ error: 'Planet not found', code: 'NOT_FOUND' });
    }

    // Only one building can be queued at a time per planet
    if (planet.progressFactory > 0 || planet.progressMilitaryBase > 0 || planet.progressResearchLab > 0) {
      return reply.status(400).send({ error: 'Building already in progress', code: 'INVALID' });
    }

    const buildCost = 50; // production points
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { production: true } });
    if (!player || player.production < buildCost) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    const progressField = {
      factory: 'progressFactory',
      military_base: 'progressMilitaryBase',
      research_lab: 'progressResearchLab',
    }[body.data.type] as 'progressFactory' | 'progressMilitaryBase' | 'progressResearchLab';

    await prisma.$transaction([
      prisma.planet.update({ where: { id: planet.id }, data: { [progressField]: 1 } }),
      prisma.player.update({ where: { id: playerId }, data: { production: { decrement: buildCost } } }),
    ]);

    return reply.status(201).send({ data: { building: body.data.type, started: true } });
  });

  // POST /api/empire/invest/:planetId — invest production into a planet
  app.post('/invest/:planetId', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { planetId } = request.params as { planetId: string };
    const body = z.object({ amount: z.number().int().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const planet = await prisma.planet.findUnique({ where: { id: parseInt(planetId, 10) } });
    if (!planet || planet.ownerId !== playerId) {
      return reply.status(404).send({ error: 'Planet not found', code: 'NOT_FOUND' });
    }

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { production: true } });
    if (!player || player.production < body.data.amount) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    await prisma.$transaction([
      prisma.planet.update({ where: { id: planet.id }, data: { investment: { increment: body.data.amount } } }),
      prisma.player.update({ where: { id: playerId }, data: { production: { decrement: body.data.amount } } }),
    ]);

    return reply.send({ data: { invested: body.data.amount } });
  });

  // GET /api/empire/actions — empire actions log
  app.get('/actions', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true } });

    // Check if player has a council affiliation
    if (!player?.councilId) {
      return reply.send({ data: [] });
    }

    const actions = await prisma.councilAction.findMany({
      where: { ownerId: player.councilId },
      orderBy: { startTime: 'desc' },
      take: 50,
    });
    return reply.send({ data: actions });
  });

  // POST /api/empire/action — submit an empire action
  app.post('/action', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = empireActionSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const { action, target, amount } = body.data;

    // Most empire actions require production cost
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { production: true, empireRelation: true } });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });

    if (action === EMPIRE_ACTION.TRIBUTE) {
      if (player.production < amount) {
        return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
      }
      await prisma.$transaction([
        prisma.player.update({
          where: { id: playerId },
          data: { production: { decrement: amount }, empireRelation: { increment: Math.floor(amount / 100) } },
        }),
      ]);
    }

    return reply.send({ data: { action, target, amount } });
  });

  // GET /api/empire/events — unanswered player events
  app.get('/events', async (request, reply) => {
    const { playerId } = getPayload(request);
    const events = await prisma.playerEvent.findMany({
      where: { ownerId: playerId, answered: false },
      orderBy: { time: 'desc' },
    });
    return reply.send({ data: events });
  });

  // POST /api/empire/events/:id/answer
  app.post('/events/:id/answer', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };

    const event = await prisma.playerEvent.findUnique({ where: { id: parseInt(id, 10) } });
    if (!event || event.ownerId !== playerId) {
      return reply.status(404).send({ error: 'Event not found', code: 'NOT_FOUND' });
    }

    await prisma.playerEvent.update({ where: { id: event.id }, data: { answered: true } });
    return reply.send({ data: { answered: true } });
  });
};

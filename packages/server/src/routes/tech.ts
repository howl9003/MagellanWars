import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { TECH_DEFS, TECH_BY_ID, canLearnTech, researchCost } from '../game/data/tech.js';

export const techRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/tech — full tech tree with learned/available status
  app.get('/', async (request, reply) => {
    const { playerId } = getPayload(request);

    const ownedTechs = await prisma.playerTech.findMany({ where: { playerId } });
    const ownedIds = new Set(ownedTechs.map((t) => t.techId));

    const tree = TECH_DEFS.map((tech) => ({
      ...tech,
      learned: ownedIds.has(tech.id),
      available: canLearnTech(ownedIds, tech.id),
      cost: researchCost(tech.id),
    }));

    return reply.send({ data: tree });
  });

  // GET /api/tech/owned — just the IDs the player has learned
  app.get('/owned', async (request, reply) => {
    const { playerId } = getPayload(request);
    const techs = await prisma.playerTech.findMany({ where: { playerId } });
    return reply.send({ data: techs.map((t) => t.techId) });
  });

  // GET /api/tech/queue — currently queued tech for research
  app.get('/queue', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { researchTechId: true, research: true },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });

    const tech = player.researchTechId ? TECH_BY_ID.get(player.researchTechId) : null;
    const cost = tech ? researchCost(tech.id) : 0;

    return reply.send({
      data: {
        techId: player.researchTechId,
        tech,
        currentPool: player.research,
        needed: cost,
        progressPct: cost > 0 ? Math.min(100, Math.floor((player.research / cost) * 100)) : 0,
      },
    });
  });

  // PUT /api/tech/queue — set the tech to research next
  app.put('/queue', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({ techId: z.number().int() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const { techId } = body.data;

    if (techId === 0) {
      await prisma.player.update({ where: { id: playerId }, data: { researchTechId: 0 } });
      return reply.send({ data: { techId: 0 } });
    }

    const tech = TECH_BY_ID.get(techId);
    if (!tech) return reply.status(404).send({ error: 'Unknown tech', code: 'NOT_FOUND' });

    const ownedTechs = await prisma.playerTech.findMany({ where: { playerId } });
    const ownedIds = new Set(ownedTechs.map((t) => t.techId));

    if (ownedIds.has(techId)) {
      return reply.status(400).send({ error: 'Already learned', code: 'INVALID' });
    }

    if (!canLearnTech(ownedIds, techId)) {
      return reply.status(400).send({ error: 'Prerequisites not met', code: 'PREREQ' });
    }

    await prisma.player.update({ where: { id: playerId }, data: { researchTechId: techId } });
    return reply.send({ data: { techId, tech, cost: researchCost(techId) } });
  });

  // POST /api/tech/instant — instantly learn a tech (admin only, or costs production)
  // For now: spend production points equal to cost * 10
  app.post('/instant', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({ techId: z.number().int() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const { techId } = body.data;
    const tech = TECH_BY_ID.get(techId);
    if (!tech) return reply.status(404).send({ error: 'Unknown tech', code: 'NOT_FOUND' });

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { production: true },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });

    const ownedTechs = await prisma.playerTech.findMany({ where: { playerId } });
    const ownedIds = new Set(ownedTechs.map((t) => t.techId));

    if (ownedIds.has(techId)) {
      return reply.status(400).send({ error: 'Already learned', code: 'INVALID' });
    }

    if (!canLearnTech(ownedIds, techId)) {
      return reply.status(400).send({ error: 'Prerequisites not met', code: 'PREREQ' });
    }

    const productionCost = researchCost(techId) * 10;
    if (player.production < productionCost) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    await prisma.$transaction([
      prisma.playerTech.create({ data: { playerId, techId } }),
      prisma.player.update({
        where: { id: playerId },
        data: { production: { decrement: productionCost } },
      }),
    ]);

    return reply.status(201).send({ data: { techId, tech } });
  });
};

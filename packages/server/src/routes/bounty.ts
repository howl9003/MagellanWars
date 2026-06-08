import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';

const DEFAULT_BOUNTY_DURATION_HOURS = 72;

export const bountyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/bounty — list active bounties
  app.get('/', async (_request, reply) => {
    const now = new Date();
    const bounties = await prisma.bounty.findMany({
      where: { expireTime: { gt: now } },
      orderBy: { empirePoints: 'desc' },
    });
    return reply.send({ data: bounties });
  });

  // GET /api/bounty/on/:targetId — bounties on a specific player
  app.get('/on/:targetId', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const now = new Date();
    const bounties = await prisma.bounty.findMany({
      where: { targetPlayerId: parseInt(targetId, 10), expireTime: { gt: now } },
      orderBy: { empirePoints: 'desc' },
    });
    return reply.send({ data: bounties });
  });

  // POST /api/bounty — place a bounty on another player
  app.post('/', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({
      targetPlayerId: z.number().int().positive(),
      empirePoints: z.number().int().min(1),
      durationHours: z.number().int().min(1).max(168).default(DEFAULT_BOUNTY_DURATION_HOURS),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
    if (body.data.targetPlayerId === playerId) {
      return reply.status(400).send({ error: 'Cannot place bounty on yourself', code: 'INVALID' });
    }

    // Cost in production: 10x empire points
    const productionCost = body.data.empirePoints * 10;
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { production: true } });
    if (!player || player.production < productionCost) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    const target = await prisma.player.findUnique({ where: { id: body.data.targetPlayerId } });
    if (!target) return reply.status(404).send({ error: 'Target player not found', code: 'NOT_FOUND' });

    const expireTime = new Date(Date.now() + body.data.durationHours * 3600 * 1000);

    const bounty = await prisma.$transaction(async (tx) => {
      await tx.player.update({ where: { id: playerId }, data: { production: { decrement: productionCost } } });
      return tx.bounty.create({
        data: {
          sourcePlayerId: playerId,
          targetPlayerId: body.data.targetPlayerId,
          empirePoints: body.data.empirePoints,
          expireTime,
        },
      });
    });

    return reply.status(201).send({ data: bounty });
  });

  // DELETE /api/bounty/:id — cancel a bounty (source player only, before anyone claims)
  app.delete('/:id', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };

    const bounty = await prisma.bounty.findUnique({ where: { id: parseInt(id, 10) } });
    if (!bounty) return reply.status(404).send({ error: 'Bounty not found', code: 'NOT_FOUND' });
    if (bounty.sourcePlayerId !== playerId) {
      return reply.status(403).send({ error: 'Not your bounty', code: 'FORBIDDEN' });
    }

    // Refund 80% of production cost
    const refund = Math.floor(bounty.empirePoints * 10 * 0.8);
    await prisma.$transaction([
      prisma.bounty.delete({ where: { id: bounty.id } }),
      prisma.player.update({ where: { id: playerId }, data: { production: { increment: refund } } }),
    ]);

    return reply.send({ data: { refunded: refund } });
  });
};

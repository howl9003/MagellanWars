import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  playerId: z.coerce.number().int().optional(),
});

export const battleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'Invalid query', code: 'VALIDATION_ERROR' });
    }

    const { page, pageSize, playerId } = query.data;
    const skip = (page - 1) * pageSize;

    const where = playerId
      ? { OR: [{ attackerId: playerId }, { defenderId: playerId }] }
      : {};

    const [battles, total] = await Promise.all([
      prisma.battleRecord.findMany({
        where,
        orderBy: { time: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.battleRecord.count({ where }),
    ]);

    return reply.send({ data: { battles, total, page, pageSize } });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const battle = await prisma.battleRecord.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!battle) {
      return reply.status(404).send({ error: 'Battle not found', code: 'NOT_FOUND' });
    }

    return reply.send({ data: battle });
  });
};

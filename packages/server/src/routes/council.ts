import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';

const createCouncilSchema = z.object({
  name: z.string().min(2).max(40),
  slogan: z.string().max(255).default(''),
  autoAssign: z.boolean().default(true),
});

export const councilRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/council — list all councils
  app.get('/', async (_request, reply) => {
    const councils = await prisma.council.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { production: 'desc' },
    });
    return reply.send({ data: councils });
  });

  // GET /api/council/:id — single council with members
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const council = await prisma.council.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        members: {
          select: { id: true, name: true, race: true, honor: true, rating: true, production: true },
        },
      },
    });
    if (!council) return reply.status(404).send({ error: 'Council not found', code: 'NOT_FOUND' });
    return reply.send({ data: council });
  });

  // GET /api/council/me — my council
  app.get('/me', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { councilId: true },
    });
    if (!player?.councilId) {
      return reply.status(404).send({ error: 'Not in a council', code: 'NOT_FOUND' });
    }
    const council = await prisma.council.findUnique({
      where: { id: player.councilId },
      include: {
        members: {
          select: { id: true, name: true, race: true, honor: true, rating: true, production: true },
        },
        admissions: { where: { status: 0 } },
      },
    });
    return reply.send({ data: council });
  });

  // POST /api/council — create a new council (player becomes speaker)
  app.post('/', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = createCouncilSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { councilId: true, homeClusterId: true, production: true },
    });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });
    if (player.councilId) {
      return reply.status(400).send({ error: 'Already in a council', code: 'INVALID' });
    }

    const COUNCIL_CREATION_COST = 1000;
    if (player.production < COUNCIL_CREATION_COST) {
      return reply.status(400).send({ error: 'Insufficient production to create council', code: 'INSUFFICIENT' });
    }

    const council = await prisma.$transaction(async (tx) => {
      const c = await tx.council.create({
        data: {
          speakerId: playerId,
          name: body.data.name,
          slogan: body.data.slogan,
          autoAssign: body.data.autoAssign,
          homeClusterId: player.homeClusterId,
        },
      });
      await tx.player.update({
        where: { id: playerId },
        data: { councilId: c.id, production: { decrement: COUNCIL_CREATION_COST } },
      });
      return c;
    });

    return reply.status(201).send({ data: council });
  });

  // PUT /api/council/me — update council info (speaker only)
  app.put('/me', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({ slogan: z.string().max(255).optional(), autoAssign: z.boolean().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true } });
    if (!player?.councilId) return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });

    const council = await prisma.council.findUnique({ where: { id: player.councilId } });
    if (!council || council.speakerId !== playerId) {
      return reply.status(403).send({ error: 'Only the speaker can update the council', code: 'FORBIDDEN' });
    }

    const updated = await prisma.council.update({
      where: { id: council.id },
      data: body.data,
    });
    return reply.send({ data: updated });
  });

  // POST /api/council/:id/apply — apply to join a council
  app.post('/:id/apply', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };
    const body = z.object({ content: z.string().max(1000).optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true, admissionTimeLimit: true } });
    if (!player) return reply.status(404).send({ error: 'Player not found', code: 'NOT_FOUND' });
    if (player.councilId) return reply.status(400).send({ error: 'Already in a council', code: 'INVALID' });

    const councilId = parseInt(id, 10);
    const council = await prisma.council.findUnique({ where: { id: councilId } });
    if (!council) return reply.status(404).send({ error: 'Council not found', code: 'NOT_FOUND' });

    // Check admission time limit
    if (player.admissionTimeLimit !== -1 && Date.now() / 1000 < player.admissionTimeLimit) {
      return reply.status(429).send({ error: 'Admission cooldown active', code: 'COOLDOWN' });
    }

    await prisma.admission.upsert({
      where: { playerId_councilId: { playerId, councilId } },
      update: { status: 0, time: new Date(), content: body.data?.content },
      create: { playerId, councilId, status: 0, content: body.data?.content },
    });

    return reply.status(201).send({ data: { applied: true } });
  });

  // POST /api/council/me/admit/:playerId — accept a member application (speaker only)
  app.post('/me/admit/:applicantId', async (request, reply) => {
    const { playerId: speakerId } = getPayload(request);
    const { applicantId } = request.params as { applicantId: string };
    const applicant = parseInt(applicantId, 10);

    const speaker = await prisma.player.findUnique({ where: { id: speakerId }, select: { councilId: true } });
    if (!speaker?.councilId) return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });

    const council = await prisma.council.findUnique({ where: { id: speaker.councilId } });
    if (!council || council.speakerId !== speakerId) {
      return reply.status(403).send({ error: 'Only the speaker can admit members', code: 'FORBIDDEN' });
    }

    const admission = await prisma.admission.findUnique({
      where: { playerId_councilId: { playerId: applicant, councilId: council.id } },
    });
    if (!admission || admission.status !== 0) {
      return reply.status(404).send({ error: 'No pending application', code: 'NOT_FOUND' });
    }

    await prisma.$transaction([
      prisma.admission.update({
        where: { playerId_councilId: { playerId: applicant, councilId: council.id } },
        data: { status: 1 },
      }),
      prisma.player.update({ where: { id: applicant }, data: { councilId: council.id } }),
    ]);

    return reply.send({ data: { admitted: true } });
  });

  // DELETE /api/council/me/leave — leave the council
  app.delete('/me/leave', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true } });
    if (!player?.councilId) return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });

    const council = await prisma.council.findUnique({ where: { id: player.councilId } });
    if (council?.speakerId === playerId) {
      return reply.status(400).send({ error: 'Speaker must transfer leadership or disband first', code: 'INVALID' });
    }

    await prisma.player.update({ where: { id: playerId }, data: { councilId: null } });
    return reply.send({ data: { left: true } });
  });

  // POST /api/council/me/disband — disband the council (speaker only)
  app.post('/me/disband', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true } });
    if (!player?.councilId) return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });

    const council = await prisma.council.findUnique({ where: { id: player.councilId } });
    if (!council || council.speakerId !== playerId) {
      return reply.status(403).send({ error: 'Only the speaker can disband', code: 'FORBIDDEN' });
    }

    await prisma.$transaction([
      prisma.player.updateMany({ where: { councilId: council.id }, data: { councilId: null } }),
      prisma.council.delete({ where: { id: council.id } }),
    ]);

    return reply.send({ data: { disbanded: true } });
  });

  // POST /api/council/me/donate — donate production to council pool
  app.post('/me/donate', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({ amount: z.number().int().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { councilId: true, production: true } });
    if (!player?.councilId) return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });
    if (player.production < body.data.amount) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    await prisma.$transaction([
      prisma.player.update({ where: { id: playerId }, data: { production: { decrement: body.data.amount }, councilDonation: { increment: body.data.amount } } }),
      prisma.council.update({ where: { id: player.councilId }, data: { production: { increment: body.data.amount } } }),
    ]);

    return reply.send({ data: { donated: body.data.amount } });
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';

// Relation codes (match legacy enum)
const RELATION = {
  WAR: -2,
  HOSTILE: -1,
  NEUTRAL: 0,
  FRIENDLY: 1,
  TRUCE: 2,
  PACT: 3,
  ALLIANCE: 4,
} as const;

// Diplomatic action types
const ACTION = {
  DECLARE_WAR: 1,
  OFFER_TRUCE: 2,
  OFFER_PACT: 3,
  OFFER_ALLIANCE: 4,
  BREAK_ALLIANCE: 5,
  CANCEL_PACT: 6,
} as const;

// Cooldowns in milliseconds (matching archspace: major=4.8h, minor=1.6h)
const COOLDOWN_MAJOR_MS = 4.8 * 3600 * 1000;
const COOLDOWN_MINOR_MS = 1.6 * 3600 * 1000;

const sendMessageSchema = z.object({
  receiverId: z.number().int().positive(),
  type: z.number().int().min(1).max(10),
});

const setRelationSchema = z.object({
  targetPlayerId: z.number().int().positive(),
  action: z.number().int(),
});

export const diplomacyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/diplomacy/relations — my relations with other players
  app.get('/relations', async (request, reply) => {
    const { playerId } = getPayload(request);
    const relations = await prisma.playerRelation.findMany({
      where: { OR: [{ player1: playerId }, { player2: playerId }] },
    });
    return reply.send({ data: relations });
  });

  // GET /api/diplomacy/relations/:targetId — relation with a specific player
  app.get('/relations/:targetId', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { targetId } = request.params as { targetId: string };
    const tid = parseInt(targetId, 10);

    const relation = await prisma.playerRelation.findFirst({
      where: {
        OR: [
          { player1: playerId, player2: tid },
          { player1: tid, player2: playerId },
        ],
      },
    });

    return reply.send({ data: relation ?? { player1: playerId, player2: tid, relation: RELATION.NEUTRAL } });
  });

  // POST /api/diplomacy/action — take a diplomatic action
  app.post('/action', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = setRelationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
    }

    const { targetPlayerId, action } = body.data;
    if (targetPlayerId === playerId) {
      return reply.status(400).send({ error: 'Cannot target self', code: 'INVALID' });
    }

    // Check cooldown
    const recentAction = await prisma.playerAction.findFirst({
      where: {
        ownerId: playerId,
        action: { in: [ACTION.DECLARE_WAR, ACTION.OFFER_ALLIANCE, ACTION.BREAK_ALLIANCE] },
        startTime: { gte: new Date(Date.now() - COOLDOWN_MAJOR_MS) },
      },
    });
    if (recentAction) {
      return reply.status(429).send({ error: 'Diplomatic cooldown active', code: 'COOLDOWN' });
    }

    // Find or create relation
    const existingRel = await prisma.playerRelation.findFirst({
      where: {
        OR: [
          { player1: playerId, player2: targetPlayerId },
          { player1: targetPlayerId, player2: playerId },
        ],
      },
    });

    let newRelation = RELATION.NEUTRAL;
    switch (action) {
      case ACTION.DECLARE_WAR:       newRelation = RELATION.WAR;      break;
      case ACTION.OFFER_TRUCE:       newRelation = RELATION.TRUCE;    break;
      case ACTION.OFFER_PACT:        newRelation = RELATION.PACT;     break;
      case ACTION.OFFER_ALLIANCE:    newRelation = RELATION.ALLIANCE; break;
      case ACTION.BREAK_ALLIANCE:
      case ACTION.CANCEL_PACT:       newRelation = RELATION.NEUTRAL;  break;
    }

    if (existingRel) {
      await prisma.playerRelation.update({
        where: { id: existingRel.id },
        data: { relation: newRelation, time: new Date() },
      });
    } else {
      await prisma.playerRelation.create({
        data: {
          player1: playerId,
          player2: targetPlayerId,
          relation: newRelation,
        },
      });
    }

    // Log the action
    await prisma.playerAction.create({
      data: { ownerId: playerId, action, argument: targetPlayerId },
    });

    // Send a diplomatic message to the target
    await prisma.diplomaticMessage.create({
      data: { type: action, senderId: playerId, receiverId: targetPlayerId },
    });

    return reply.send({ data: { relation: newRelation } });
  });

  // GET /api/diplomacy/messages — inbox
  app.get('/messages', async (request, reply) => {
    const { playerId } = getPayload(request);
    const messages = await prisma.diplomaticMessage.findMany({
      where: { receiverId: playerId },
      orderBy: { time: 'desc' },
      take: 50,
    });
    return reply.send({ data: messages });
  });

  // POST /api/diplomacy/messages/:id/read — mark message as read (status=1)
  app.post('/messages/:id/read', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };

    const msg = await prisma.diplomaticMessage.findUnique({ where: { id: parseInt(id, 10) } });
    if (!msg || msg.receiverId !== playerId) {
      return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
    }

    await prisma.diplomaticMessage.update({ where: { id: msg.id }, data: { status: 1 } });
    return reply.send({ data: { ok: true } });
  });

  // ── Council diplomacy ──────────────────────────────────────────────────────

  // GET /api/diplomacy/council-relations — my council's relations
  app.get('/council-relations', async (request, reply) => {
    const { playerId } = getPayload(request);
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { councilId: true },
    });
    if (!player?.councilId) {
      return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });
    }

    const relations = await prisma.councilRelation.findMany({
      where: {
        OR: [{ council1: player.councilId }, { council2: player.councilId }],
      },
    });
    return reply.send({ data: relations });
  });

  // POST /api/diplomacy/council-action — take a council-level diplomatic action
  app.post('/council-action', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = z.object({ targetCouncilId: z.number().int().positive(), action: z.number().int() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { councilId: true },
    });
    if (!player?.councilId) {
      return reply.status(400).send({ error: 'Not in a council', code: 'INVALID' });
    }

    const council = await prisma.council.findUnique({ where: { id: player.councilId } });
    if (!council || council.speakerId !== playerId) {
      return reply.status(403).send({ error: 'Only the speaker can take council actions', code: 'FORBIDDEN' });
    }

    // Check council action cooldown
    const recentCouncilAction = await prisma.councilAction.findFirst({
      where: {
        ownerId: player.councilId,
        startTime: { gte: new Date(Date.now() - COOLDOWN_MINOR_MS) },
      },
    });
    if (recentCouncilAction) {
      return reply.status(429).send({ error: 'Council action cooldown active', code: 'COOLDOWN' });
    }

    let newRelation = RELATION.NEUTRAL;
    switch (body.data.action) {
      case ACTION.DECLARE_WAR:    newRelation = RELATION.WAR;      break;
      case ACTION.OFFER_TRUCE:    newRelation = RELATION.TRUCE;    break;
      case ACTION.OFFER_ALLIANCE: newRelation = RELATION.ALLIANCE; break;
      case ACTION.BREAK_ALLIANCE: newRelation = RELATION.NEUTRAL;  break;
    }

    const existingRel = await prisma.councilRelation.findFirst({
      where: {
        OR: [
          { council1: player.councilId, council2: body.data.targetCouncilId },
          { council1: body.data.targetCouncilId, council2: player.councilId },
        ],
      },
    });

    if (existingRel) {
      await prisma.councilRelation.update({ where: { id: existingRel.id }, data: { relation: newRelation, time: new Date() } });
    } else {
      await prisma.councilRelation.create({
        data: { council1: player.councilId, council2: body.data.targetCouncilId, relation: newRelation },
      });
    }

    await prisma.councilAction.create({
      data: { ownerId: player.councilId, action: body.data.action, argument: body.data.targetCouncilId },
    });

    return reply.send({ data: { relation: newRelation } });
  });
};

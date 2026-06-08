import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';

// Item type codes matching legacy enum
const ITEM_TYPE = {
  TECH: 1,
  PROJECT: 2,
  SHIP_COMPONENT: 3,
} as const;

export const blackmarketRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/blackmarket — list active auctions
  app.get('/', async (request, reply) => {
    const now = new Date();
    const auctions = await prisma.blackmarket.findMany({
      where: { expireAt: { gt: now }, closedAt: null },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
        },
        _count: { select: { bids: true } },
      },
      orderBy: { expireAt: 'asc' },
    });

    return reply.send({ data: auctions });
  });

  // GET /api/blackmarket/:id — single auction with bid history
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const auction = await prisma.blackmarket.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        bids: { orderBy: { amount: 'desc' } },
      },
    });
    if (!auction) return reply.status(404).send({ error: 'Auction not found', code: 'NOT_FOUND' });
    return reply.send({ data: auction });
  });

  // POST /api/blackmarket/:id/bid — place a bid
  app.post('/:id/bid', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { id } = request.params as { id: string };
    const body = z.object({ amount: z.number().int().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const auction = await prisma.blackmarket.findUnique({
      where: { id: parseInt(id, 10) },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    });

    if (!auction) return reply.status(404).send({ error: 'Auction not found', code: 'NOT_FOUND' });
    if (auction.closedAt || auction.expireAt <= new Date()) {
      return reply.status(400).send({ error: 'Auction has ended', code: 'INVALID' });
    }

    const topBid = auction.bids[0];
    const minBid = topBid ? topBid.amount + 1 : auction.price;

    if (body.data.amount < minBid) {
      return reply.status(400).send({ error: `Minimum bid is ${minBid}`, code: 'INVALID' });
    }

    // Ensure player has enough production
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { production: true } });
    if (!player || player.production < body.data.amount) {
      return reply.status(400).send({ error: 'Insufficient production', code: 'INSUFFICIENT' });
    }

    await prisma.$transaction([
      prisma.blackmarketBid.create({
        data: { auctionId: auction.id, bidderId: playerId, amount: body.data.amount },
      }),
      prisma.blackmarket.update({
        where: { id: auction.id },
        data: { winner: playerId, price: body.data.amount },
      }),
    ]);

    return reply.status(201).send({ data: { bid: body.data.amount } });
  });

  // POST /api/blackmarket — list a new item (admin or game engine only)
  app.post('/', async (request, reply) => {
    // Restrict to admin users
    const payload = request.user as { userLevel?: string };
    if (payload.userLevel !== 'ADMIN' && payload.userLevel !== 'DEV') {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const body = z.object({
      type: z.number().int().min(1).max(3),
      item: z.number().int(),
      price: z.number().int().min(1),
      durationHours: z.number().int().min(1).max(72).default(24),
      numberOfPlanet: z.number().int().min(0).default(0),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const expireAt = new Date(Date.now() + body.data.durationHours * 3600 * 1000);
    const auction = await prisma.blackmarket.create({
      data: {
        type: body.data.type,
        item: body.data.item,
        price: body.data.price,
        expireAt,
        numberOfPlanet: body.data.numberOfPlanet,
      },
    });

    return reply.status(201).send({ data: auction });
  });

  // POST /api/blackmarket/close-expired — settle ended auctions (called by turn engine)
  app.post('/close-expired', async (request, reply) => {
    const payload = request.user as { userLevel?: string };
    if (payload.userLevel !== 'ADMIN' && payload.userLevel !== 'DEV') {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const now = new Date();
    const expired = await prisma.blackmarket.findMany({
      where: { expireAt: { lte: now }, closedAt: null },
    });

    const results: { id: number; winner: number; item: number }[] = [];

    for (const auction of expired) {
      await prisma.blackmarket.update({
        where: { id: auction.id },
        data: { closedAt: now },
      });

      if (auction.winner > 0) {
        // Award the item to the winner (charge production)
        try {
          await prisma.player.update({
            where: { id: auction.winner },
            data: { production: { decrement: auction.price } },
          });

          // Grant the item based on type
          if (auction.type === ITEM_TYPE.TECH) {
            await prisma.playerTech.upsert({
              where: { playerId_techId: { playerId: auction.winner, techId: auction.item } },
              update: {},
              create: { playerId: auction.winner, techId: auction.item },
            });
          }
          // SHIP_COMPONENT and PROJECT grants handled separately (no schema for that yet)

          results.push({ id: auction.id, winner: auction.winner, item: auction.item });
        } catch {
          // Player may not have enough production; skip
        }
      }
    }

    return reply.send({ data: { closed: results.length, results } });
  });
};

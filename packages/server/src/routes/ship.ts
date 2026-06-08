// Ship design CRUD, building queue, and ship pool management
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma as db } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { COMPONENT_BY_ID, SHIP_CLASS_BASE_HP, SHIP_CLASS_NAMES } from '../game/data/components.js';
import { SHIP_BUILD_COST, MAX_INVESTED_SHIP_PP } from '../game/constants.js';
import { calcShipBuildAlloc, calcRealShipProduction } from '../game/production.js';
import { getRace } from '../game/data/races.js';

const DesignBody = z.object({
  name:        z.string().min(1).max(40),
  shipClass:   z.number().int().min(0).max(9),
  armorId:     z.number().int(),
  computerId:  z.number().int(),
  shieldId:    z.number().int().optional(),
  engineId:    z.number().int(),
  deviceIds:   z.array(z.number().int()).max(4).default([]),
  weaponSlots: z.array(z.object({ weaponId: z.number().int(), count: z.number().int().min(1) })),
});

const BuildBody = z.object({
  designId: z.number().int(),
  count:    z.number().int().min(1).max(10000),
  planetId: z.number().int(),
});

const AssignBody = z.object({
  fromFleetId: z.number().int(),
  toFleetId:   z.number().int(),
  designId:    z.number().int(),
  count:       z.number().int().min(1),
});

export const shipRoutes: FastifyPluginAsync = async (app) => {
  // ── Ship designs ────────────────────────────────────────────────────────────

  app.get('/designs', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const designs = await db.shipDesign.findMany({ where: { ownerId: playerId }, orderBy: { id: 'asc' } });
    return { data: designs };
  });

  app.get('/designs/:id', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { id } = req.params as { id: string };
    const design = await db.shipDesign.findFirst({ where: { id: Number(id), ownerId: playerId } });
    if (!design) throw app.httpErrors.notFound('Design not found');
    return { data: design };
  });

  app.post('/designs', { preHandler: requireAuth }, async (req, reply) => {
    const { playerId } = getPayload(req);
    const body = DesignBody.parse(req.body);

    const componentIds = [
      body.armorId, body.computerId, body.engineId,
      ...(body.shieldId ? [body.shieldId] : []),
      ...body.deviceIds,
      ...body.weaponSlots.map((w) => w.weaponId),
    ];
    for (const cid of componentIds) {
      if (!COMPONENT_BY_ID.has(cid)) throw app.httpErrors.badRequest(`Unknown component id: ${cid}`);
    }

    const count = await db.shipDesign.count({ where: { ownerId: playerId } });
    if (count >= 50) throw app.httpErrors.badRequest('Maximum 50 designs allowed');

    const design = await db.shipDesign.create({
      data: {
        ownerId:     playerId,
        name:        body.name,
        shipClass:   body.shipClass,
        armorId:     body.armorId,
        computerId:  body.computerId,
        shieldId:    body.shieldId ?? 0,
        engineId:    body.engineId,
        deviceIds:   JSON.stringify(body.deviceIds),
        weaponSlots: JSON.stringify(body.weaponSlots),
      },
    });
    reply.code(201);
    return { data: design };
  });

  app.put('/designs/:id', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { id } = req.params as { id: string };
    const body = DesignBody.parse(req.body);

    const existing = await db.shipDesign.findFirst({ where: { id: Number(id), ownerId: playerId } });
    if (!existing) throw app.httpErrors.notFound('Design not found');

    const updated = await db.shipDesign.update({
      where: { id: Number(id) },
      data: {
        name:        body.name,
        shipClass:   body.shipClass,
        armorId:     body.armorId,
        computerId:  body.computerId,
        shieldId:    body.shieldId ?? 0,
        engineId:    body.engineId,
        deviceIds:   JSON.stringify(body.deviceIds),
        weaponSlots: JSON.stringify(body.weaponSlots),
      },
    });
    return { data: updated };
  });

  app.delete('/designs/:id', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { id } = req.params as { id: string };
    const existing = await db.shipDesign.findFirst({ where: { id: Number(id), ownerId: playerId } });
    if (!existing) throw app.httpErrors.notFound('Design not found');
    await db.shipDesign.delete({ where: { id: Number(id) } });
    return { ok: true };
  });

  // ── Ship class info (public) ────────────────────────────────────────────────

  app.get('/classes', async () => {
    return {
      data: SHIP_CLASS_NAMES.map((name, i) => ({
        index: i,
        name,
        baseHp: SHIP_CLASS_BASE_HP[i],
      })),
    };
  });

  // ── Components catalog ─────────────────────────────────────────────────────

  app.get('/components', async () => {
    return { data: Object.fromEntries(COMPONENT_BY_ID) };
  });

  // ── Building queue ──────────────────────────────────────────────────────────

  app.get('/queue', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const [queue, player] = await Promise.all([
      db.shipBuildingQueue.findMany({ where: { ownerId: playerId }, include: { design: true }, orderBy: { id: 'asc' } }),
      db.player.findUniqueOrThrow({
        where: { id: playerId },
        select: { race: true, production: true, shipProduction: true, investedShipProduction: true },
      }),
    ]);
    const militaryCM = getRace(player.race).control.military ?? 0;
    // Use current production as approximation of last-turn income for display purposes
    const base = calcShipBuildAlloc(player.production, militaryCM);
    const real = calcRealShipProduction(base, player.investedShipProduction);
    return {
      data: queue,
      buildInfo: {
        shipPool: player.shipProduction,
        investedPool: player.investedShipProduction,
        estimatedBaseAlloc: base,
        estimatedRealAlloc: real,
        costByClass: SHIP_BUILD_COST,
      },
    };
  });

  // Manually move general PP into the investment pool (investedShipProduction).
  // This augments the next build turn's ship production by up to +50%.
  app.post('/pool/contribute', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { amount } = z.object({ amount: z.number().int().min(1) }).parse(req.body);

    const player = await db.player.findUniqueOrThrow({
      where: { id: playerId },
      select: { production: true, investedShipProduction: true },
    });

    if (player.production < amount) {
      throw app.httpErrors.badRequest(`Insufficient production: have ${player.production}, requested ${amount}`);
    }

    const canAdd = Math.max(0, MAX_INVESTED_SHIP_PP - player.investedShipProduction);
    const actualAdd = Math.min(amount, canAdd);

    if (actualAdd <= 0) {
      throw app.httpErrors.badRequest('Investment pool is already at maximum capacity');
    }

    await db.player.update({
      where: { id: playerId },
      data: {
        production: { decrement: actualAdd },
        investedShipProduction: { increment: actualAdd },
      },
    });

    return { data: { contributed: actualAdd, investedPool: player.investedShipProduction + actualAdd } };
  });

  app.post('/queue', { preHandler: requireAuth }, async (req, reply) => {
    const { playerId } = getPayload(req);
    const body = BuildBody.parse(req.body);

    const [design, planet] = await Promise.all([
      db.shipDesign.findFirst({ where: { id: body.designId, ownerId: playerId } }),
      db.planet.findFirst({ where: { id: body.planetId, ownerId: playerId } }),
    ]);
    if (!design) throw app.httpErrors.notFound('Design not found');
    if (!planet) throw app.httpErrors.notFound('Planet not found');

    // Ships are built over time using per-turn production budget — no upfront cost
    const entry = await db.shipBuildingQueue.create({
      data: {
        ownerId:   playerId,
        designId:  body.designId,
        planetId:  body.planetId,
        count:     body.count,
        progress:  0,
        turnsLeft: body.count,
      },
    });
    reply.code(201);
    return { data: { ...entry, costPerShip: SHIP_BUILD_COST[design.shipClass] ?? 200 } };
  });

  app.delete('/queue/:id', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { id } = req.params as { id: string };
    const entry = await db.shipBuildingQueue.findFirst({ where: { id: Number(id), ownerId: playerId } });
    if (!entry) throw app.httpErrors.notFound('Queue entry not found');
    await db.shipBuildingQueue.delete({ where: { id: Number(id) } });
    return { ok: true };
  });

  // ── Docked ships / ship pool ────────────────────────────────────────────────

  app.get('/pool', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const ships = await db.dockedShip.findMany({
      where: { ownerId: playerId },
      include: { design: true },
      orderBy: { designId: 'asc' },
    });
    return { data: ships };
  });

  // Transfer ships between fleets
  app.post('/assign', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const body = AssignBody.parse(req.body);

    const from = await db.fleet.findFirst({ where: { ownerId: playerId, id: body.fromFleetId } });
    if (!from) throw app.httpErrors.notFound('Source fleet not found');
    const to = await db.fleet.findFirst({ where: { ownerId: playerId, id: body.toFleetId } });
    if (!to) throw app.httpErrors.notFound('Target fleet not found');

    const srcDocked = await db.dockedShip.findFirst({
      where: { ownerId: playerId, designId: body.designId, fleetId: body.fromFleetId },
    });
    if (!srcDocked || srcDocked.count < body.count) {
      throw app.httpErrors.badRequest('Not enough ships in source fleet');
    }

    await db.$transaction(async (tx) => {
      if (srcDocked.count === body.count) {
        await tx.dockedShip.delete({ where: { id: srcDocked.id } });
      } else {
        await tx.dockedShip.update({ where: { id: srcDocked.id }, data: { count: { decrement: body.count } } });
      }
      const dstDocked = await tx.dockedShip.findFirst({
        where: { ownerId: playerId, designId: body.designId, fleetId: body.toFleetId },
      });
      if (dstDocked) {
        await tx.dockedShip.update({ where: { id: dstDocked.id }, data: { count: { increment: body.count } } });
      } else {
        await tx.dockedShip.create({
          data: { ownerId: playerId, designId: body.designId, fleetId: body.toFleetId, count: body.count },
        });
      }
    });

    return { ok: true };
  });
};

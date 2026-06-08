import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { MISSION, startTraining, startPatrol, recallFleet } from '../game/fleet-missions.js';

const createFleetSchema = z.object({
  name: z.string().min(1).max(40),
  admiralId: z.bigint().optional(),
  maxShips: z.number().int().min(1).max(500).default(50),
});

const setMissionSchema = z.object({
  mission: z.number().int().min(0).max(6),
  target: z.number().int().optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export const fleetRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/fleet — list all fleets
  app.get('/', async (request, reply) => {
    const { playerId } = getPayload(request);
    const fleets = await prisma.fleet.findMany({
      where: { ownerId: playerId },
      include: { admiral: true },
    });
    return reply.send({ data: fleets });
  });

  // GET /api/fleet/:fleetId
  app.get('/:fleetId', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { fleetId } = request.params as { fleetId: string };

    const fleet = await prisma.fleet.findUnique({
      where: { ownerId_id: { ownerId: playerId, id: parseInt(fleetId, 10) } },
      include: { admiral: true },
    });
    if (!fleet) return reply.status(404).send({ error: 'Fleet not found', code: 'NOT_FOUND' });
    return reply.send({ data: fleet });
  });

  // POST /api/fleet — create a new fleet
  app.post('/', async (request, reply) => {
    const { playerId } = getPayload(request);
    const body = createFleetSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    // Assign next fleet ID
    const existing = await prisma.fleet.findMany({
      where: { ownerId: playerId },
      select: { id: true },
      orderBy: { id: 'desc' },
      take: 1,
    });
    const nextId = (existing[0]?.id ?? 0) + 1;

    const fleet = await prisma.fleet.create({
      data: {
        ownerId: playerId,
        id: nextId,
        name: body.data.name,
        admiralId: body.data.admiralId ?? null,
        maxShips: body.data.maxShips,
        mission: MISSION.STANDBY,
      },
    });
    return reply.status(201).send({ data: fleet });
  });

  // PUT /api/fleet/:fleetId/name — rename fleet
  app.put('/:fleetId/name', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { fleetId } = request.params as { fleetId: string };
    const body = z.object({ name: z.string().min(1).max(40) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const fleet = await prisma.fleet.findUnique({
      where: { ownerId_id: { ownerId: playerId, id: parseInt(fleetId, 10) } },
    });
    if (!fleet) return reply.status(404).send({ error: 'Fleet not found', code: 'NOT_FOUND' });

    const updated = await prisma.fleet.update({
      where: { ownerId_id: { ownerId: playerId, id: fleet.id } },
      data: { name: body.data.name },
    });
    return reply.send({ data: updated });
  });

  // PUT /api/fleet/:fleetId/admiral — assign/reassign admiral
  app.put('/:fleetId/admiral', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { fleetId } = request.params as { fleetId: string };
    const body = z.object({ admiralId: z.bigint().nullable() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    if (body.data.admiralId !== null) {
      const admiral = await prisma.admiral.findUnique({ where: { id: body.data.admiralId } });
      if (!admiral || admiral.ownerId !== playerId) {
        return reply.status(404).send({ error: 'Admiral not found', code: 'NOT_FOUND' });
      }
    }

    const updated = await prisma.fleet.update({
      where: { ownerId_id: { ownerId: playerId, id: parseInt(fleetId, 10) } },
      data: { admiralId: body.data.admiralId },
    });
    return reply.send({ data: updated });
  });

  // PUT /api/fleet/:fleetId/mission — set fleet mission
  app.put('/:fleetId/mission', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { fleetId } = request.params as { fleetId: string };
    const fid = parseInt(fleetId, 10);
    const body = setMissionSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });

    const fleet = await prisma.fleet.findUnique({
      where: { ownerId_id: { ownerId: playerId, id: fid } },
    });
    if (!fleet) return reply.status(404).send({ error: 'Fleet not found', code: 'NOT_FOUND' });

    const nowSeconds = Math.floor(Date.now() / 1000);

    let updated;
    switch (body.data.mission) {
      case MISSION.TRAINING:
        updated = await startTraining(playerId, fid, nowSeconds);
        break;
      case MISSION.PATROL:
        updated = await startPatrol(playerId, fid);
        break;
      case MISSION.STANDBY:
        updated = await recallFleet(playerId, fid);
        break;
      default:
        updated = await prisma.fleet.update({
          where: { ownerId_id: { ownerId: playerId, id: fid } },
          data: {
            mission: body.data.mission,
            missionTarget: body.data.target ?? 0,
            missionTerminateTime: body.data.durationSeconds
              ? nowSeconds + body.data.durationSeconds
              : 0,
          },
        });
    }

    return reply.send({ data: updated });
  });

  // DELETE /api/fleet/:fleetId — disband fleet
  app.delete('/:fleetId', async (request, reply) => {
    const { playerId } = getPayload(request);
    const { fleetId } = request.params as { fleetId: string };

    const fleet = await prisma.fleet.findUnique({
      where: { ownerId_id: { ownerId: playerId, id: parseInt(fleetId, 10) } },
    });
    if (!fleet) return reply.status(404).send({ error: 'Fleet not found', code: 'NOT_FOUND' });
    if (fleet.mission !== MISSION.STANDBY) {
      return reply.status(400).send({ error: 'Recall fleet before disbanding', code: 'INVALID' });
    }

    await prisma.fleet.delete({
      where: { ownerId_id: { ownerId: playerId, id: fleet.id } },
    });
    return reply.send({ data: { disbanded: true } });
  });
};

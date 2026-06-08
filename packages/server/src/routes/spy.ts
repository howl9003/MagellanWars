// Spy operations
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma as db } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { SPY_OPS, SPY_OP_BY_ID, spySuccessChance, spyDetectionChance } from '../game/data/spy-ops.js';

const LaunchBody = z.object({
  opId:     z.number().int(),
  targetId: z.number().int(),
});

const SetAlertBody = z.object({
  alertness: z.number().int().min(0).max(10),
});

const SetSecurityBody = z.object({
  securityLevel: z.number().int().min(0).max(10),
});

export const spyRoutes: FastifyPluginAsync = async (app) => {
  // List all spy operations (with unlock state)
  app.get('/ops', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const learned = await db.playerTech.findMany({ where: { playerId } });
    const techIds = new Set(learned.map((t) => t.techId));

    const ops = SPY_OPS.map((op) => ({
      ...op,
      available: op.prereqs.every((p) => techIds.has(p)),
    }));
    return { data: ops };
  });

  // Get player's alertness & security settings
  app.get('/settings', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, select: { alertness: true, securityLevel: true } });
    return { data: player };
  });

  app.put('/settings/alertness', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const body = SetAlertBody.parse(req.body);
    const updated = await db.player.update({ where: { id: playerId }, data: { alertness: body.alertness } });
    return { data: { alertness: updated.alertness } };
  });

  app.put('/settings/security', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const body = SetSecurityBody.parse(req.body);
    const updated = await db.player.update({ where: { id: playerId }, data: { securityLevel: body.securityLevel } });
    return { data: { securityLevel: updated.securityLevel } };
  });

  // Launch a spy operation
  app.post('/launch', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const body = LaunchBody.parse(req.body);

    const op = SPY_OP_BY_ID.get(body.opId);
    if (!op) throw app.httpErrors.badRequest('Unknown spy operation');

    const [attacker, target] = await Promise.all([
      db.player.findUniqueOrThrow({ where: { id: playerId } }),
      db.player.findUnique({ where: { id: body.targetId } }),
    ]);
    if (!target) throw app.httpErrors.notFound('Target player not found');
    if (target.id === playerId) throw app.httpErrors.badRequest('Cannot spy on yourself');

    // Check tech prereqs
    const learned = await db.playerTech.findMany({ where: { playerId } });
    const techIds = new Set(learned.map((t) => t.techId));
    if (op.prereqs.some((p) => !techIds.has(p))) {
      throw app.httpErrors.forbidden('Missing prerequisite technology');
    }

    // Check production cost
    if (attacker.production < op.cost) {
      throw app.httpErrors.badRequest(`Insufficient production. Need ${op.cost}, have ${attacker.production}`);
    }

    const successChance = spySuccessChance(attacker.alertness, op.difficulty, target.securityLevel);
    const detectionChance = spyDetectionChance(target.securityLevel, op.type);

    const success = Math.random() * 100 < successChance;
    const detected = Math.random() * 100 < detectionChance;

    // Deduct cost
    await db.player.update({ where: { id: playerId }, data: { production: { decrement: op.cost } } });

    let result: Record<string, unknown> = { success, detected };

    if (success) {
      result = { ...result, ...(await applySpyOp(op.id, playerId, body.targetId, techIds)) };
    }

    if (detected) {
      // Notify target via event
      await db.playerEvent.create({
        data: {
          ownerId: body.targetId,
          event: 9000 + op.id - 8000, // spy detection event codes
          life: 5,
        },
      });
      // Diplomacy hit
      await db.playerRelation.upsert({
        where: { player1_player2: { player1: Math.min(playerId, body.targetId), player2: Math.max(playerId, body.targetId) } },
        update: { relation: { decrement: op.type === 'ATRO' ? 30 : op.type === 'HOST' ? 15 : 5 } },
        create: { player1: Math.min(playerId, body.targetId), player2: Math.max(playerId, body.targetId), relation: -15 },
      });
    }

    return { data: { ...result, successChance, detectionChance } };
  });
};

async function applySpyOp(
  opId: number,
  attackerId: number,
  targetId: number,
  attackerTechs: Set<number>,
): Promise<Record<string, unknown>> {
  switch (opId) {
    case 8001: {
      // General info gathering
      const p = await db.player.findUniqueOrThrow({
        where: { id: targetId },
        select: { name: true, race: true, production: true, research: true, rating: true },
      });
      const fleetCount = await db.fleet.count({ where: { ownerId: targetId } });
      return { info: { ...p, fleetCount } };
    }
    case 8002: {
      // Detailed info gathering
      const techs = await db.playerTech.findMany({ where: { playerId: targetId } });
      const planets = await db.planet.count({ where: { ownerId: targetId } });
      return { info: { techIds: techs.map((t) => t.techId), planetCount: planets } };
    }
    case 8003: {
      // Steal secret info — reveals research queue and active effects
      const [researchQueue, effects] = await Promise.all([
        db.player.findUniqueOrThrow({
          where: { id: targetId },
          select: { researchTechId: true, research: true, rating: true, honor: true },
        }),
        db.playerEffect.findMany({ where: { ownerId: targetId, life: { gt: 0 } } }),
      ]);
      return { info: { ...researchQueue, activeEffects: effects.map((e) => e.type) } };
    }
    case 8004:
    case 8005: {
      // Computer virus / network worm — apply research debuff
      const duration = opId === 8005 ? 8 : 4;
      await db.playerEffect.create({
        data: { ownerId: targetId, type: 201, life: duration, apply: 0, arg1: opId === 8005 ? 20 : 10 },
      });
      return { effectApplied: 'research_debuff', duration };
    }
    case 8006: {
      // Sabotage — production debuff
      await db.playerEffect.create({
        data: { ownerId: targetId, type: 202, life: 5, apply: 0, arg1: 15 },
      });
      return { effectApplied: 'production_debuff', duration: 5 };
    }
    case 8007: {
      // Incite riot
      await db.playerEffect.create({
        data: { ownerId: targetId, type: 203, life: 4, apply: 0, arg1: 25 },
      });
      return { effectApplied: 'riot', duration: 4 };
    }
    case 8008:
    case 8009: {
      // Steal tech
      const targetTechs = await db.playerTech.findMany({ where: { playerId: targetId } });
      const stealable = targetTechs.filter((t) => !attackerTechs.has(t.techId) && (opId === 8008 ? t.techId < 1200 : true));
      if (stealable.length === 0) return { stolen: null };
      const pick = stealable[Math.floor(Math.random() * stealable.length)];
      if (!pick) return { stolen: null };
      await db.playerTech.upsert({
        where: { playerId_techId: { playerId: attackerId, techId: pick.techId } },
        update: {},
        create: { playerId: attackerId, techId: pick.techId },
      });
      return { stolen: pick.techId };
    }
    case 8010: {
      // Assassinate admiral
      const admiral = await db.admiral.findFirst({ where: { ownerId: targetId } });
      if (!admiral) return { killed: null };
      await db.admiral.delete({ where: { id: admiral.id } });
      return { killed: admiral.name };
    }
    case 8011: {
      // Incite rebellion
      await db.player.update({ where: { id: targetId }, data: { empireRelation: { decrement: 30 } } });
      return { effectApplied: 'rebellion' };
    }
    case 8012: {
      // Destroy military base
      const planet = await db.planet.findFirst({ where: { ownerId: targetId, buildingMilitaryBase: { gt: 0 } } });
      if (!planet) return { destroyed: null };
      await db.planet.update({ where: { id: planet.id }, data: { buildingMilitaryBase: { decrement: 1 } } });
      return { destroyed: { planetId: planet.id } };
    }
    default:
      return {};
  }
}

// Empire warfare — raids, sieges, blockades, defense plans, privateers
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma as db } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { simulateBattle } from '../game/battle/combat.js';
import { buildBattleRecord } from '../game/battle/report.js';
import type { BattleFleet } from '../game/battle/types.js';
import { COMPONENT_BY_ID, SHIP_CLASS_BASE_HP } from '../game/data/components.js';

const RaidBody = z.object({
  targetPlayerId: z.number().int(),
  targetPlanetId: z.number().int(),
  attackerFleetId: z.number().int(),
});

const BlockadeBody = z.object({
  targetPlayerId: z.number().int(),
  attackerFleetId: z.number().int(),
});

const DefensePlanBody = z.object({
  planetId: z.number().int(),
  fleetIds: z.array(z.number().int()),
  autoReply: z.boolean().default(false),
});

const PrivateerBody = z.object({
  targetPlayerId: z.number().int(),
  fleetId: z.number().int(),
});

export const warRoutes: FastifyPluginAsync = async (app) => {
  // ── Defense plans ───────────────────────────────────────────────────────────

  app.get('/defense', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const plans = await db.defensePlan.findMany({
      where: { ownerId: playerId },
      include: { fleets: true },
      orderBy: { planetId: 'asc' },
    });
    return { data: plans };
  });

  app.post('/defense', { preHandler: requireAuth }, async (req, reply) => {
    const { playerId } = getPayload(req);
    const body = DefensePlanBody.parse(req.body);

    const planet = await db.planet.findFirst({ where: { id: body.planetId, ownerId: playerId } });
    if (!planet) throw app.httpErrors.notFound('Planet not found');

    const plan = await db.defensePlan.upsert({
      where: { ownerId_planetId: { ownerId: playerId, planetId: body.planetId } },
      update: { autoReply: body.autoReply },
      create: { ownerId: playerId, planetId: body.planetId, autoReply: body.autoReply },
    });

    // Sync defense fleets
    await db.defenseFleet.deleteMany({ where: { planId: plan.id } });
    if (body.fleetIds.length > 0) {
      await db.defenseFleet.createMany({
        data: body.fleetIds.map((fid) => ({ planId: plan.id, fleetId: fid })),
      });
    }
    reply.code(201);
    return { data: plan };
  });

  app.delete('/defense/:planetId', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const { planetId } = req.params as { planetId: string };
    await db.defensePlan.deleteMany({ where: { ownerId: playerId, planetId: Number(planetId) } });
    return { ok: true };
  });

  // ── Raid (attack planet) ────────────────────────────────────────────────────

  app.post('/raid', { preHandler: requireAuth }, async (req) => {
    const { playerId } = requireAuthPayload(req);
    const body = RaidBody.parse(req.body);

    const [attacker, defender, planet, atkFleet] = await Promise.all([
      db.player.findUniqueOrThrow({ where: { id: playerId }, include: { admirals: true } }),
      db.player.findUnique({ where: { id: body.targetPlayerId } }),
      db.planet.findFirst({ where: { id: body.targetPlanetId, ownerId: body.targetPlayerId } }),
      db.fleet.findFirst({ where: { id: body.attackerFleetId, ownerId: playerId } }),
    ]);

    if (!defender) throw app.httpErrors.notFound('Target player not found');
    if (!planet) throw app.httpErrors.notFound('Target planet not found');
    if (!atkFleet) throw app.httpErrors.notFound('Attacker fleet not found');
    if (defender.protectedMode) throw app.httpErrors.forbidden('Target is in protected mode');

    // Build attacker fleet for simulation — use the admiral assigned to this fleet specifically
    const atkAdmiral = atkFleet.admiralId
      ? (attacker.admirals.find((a) => a.id === atkFleet.admiralId) ?? null)
      : null;
    const attackerBattleFleet = await buildBattleFleet(playerId, attacker.name, body.attackerFleetId, atkAdmiral);

    // Defender fleet from defense plan (all assigned fleets merged), or generic defense
    const defPlan = await db.defensePlan.findFirst({
      where: { ownerId: body.targetPlayerId, planetId: body.targetPlanetId },
      include: { fleets: true },
    });
    const defFleetIds = defPlan?.fleets.map((f) => f.fleetId) ?? [];
    const defenderBattleFleet = defFleetIds.length > 0
      ? await buildMergedBattleFleet(body.targetPlayerId, defender.name, defFleetIds)
      : buildPlanetaryDefense(body.targetPlayerId, defender.name, planet.buildingMilitaryBase);

    const result = simulateBattle(attackerBattleFleet, defenderBattleFleet);
    const record = buildBattleRecord(result, {
      attackerId: playerId,
      defenderId: body.targetPlayerId,
      attackerRace: attacker.race,
      defenderRace: defender.race,
      attackerCouncil: attacker.councilId ?? 0,
      defenderCouncil: defender.councilId ?? 0,
      warType: 1,
      planetId: body.targetPlanetId,
      battleFieldName: planet.name,
    });

    const saved = await db.battleRecord.create({ data: { ...record, time: new Date() } });

    if (result.attackerWon) {
      // Transfer planet ownership
      await db.planet.update({ where: { id: body.targetPlanetId }, data: { ownerId: playerId } });
    }

    // Grant exp
    await db.fleet.update({
      where: { ownerId_id: { ownerId: playerId, id: body.attackerFleetId } },
      data: { exp: { increment: result.attackerExpGained }, killedShips: { increment: result.defenderShipsLost } },
    });

    return { data: { battleId: saved.id, attackerWon: result.attackerWon, log: result.log } };
  });

  // ── Blockade ────────────────────────────────────────────────────────────────

  app.post('/blockade', { preHandler: requireAuth }, async (req) => {
    const { playerId } = requireAuthPayload(req);
    const body = BlockadeBody.parse(req.body);

    const [, defender] = await Promise.all([
      db.player.findUniqueOrThrow({ where: { id: playerId } }),
      db.player.findUnique({ where: { id: body.targetPlayerId } }),
    ]);
    if (!defender) throw app.httpErrors.notFound('Target player not found');
    if (defender.protectedMode) throw app.httpErrors.forbidden('Target is in protected mode');

    // Blockade reduces commerce of defender for 5 turns
    await db.playerEffect.create({
      data: { ownerId: body.targetPlayerId, type: 210, life: 5, apply: 0, arg1: 25 },
    });

    // Honour cost for aggressor
    await db.player.update({ where: { id: playerId }, data: { honor: { decrement: 5 } } });

    return { data: { ok: true, effect: 'commerce_debuff', duration: 5 } };
  });

  // ── Privateers ──────────────────────────────────────────────────────────────

  app.post('/privateer', { preHandler: requireAuth }, async (req) => {
    const { playerId } = requireAuthPayload(req);
    const body = PrivateerBody.parse(req.body);

    const [, target] = await Promise.all([
      db.player.findUniqueOrThrow({ where: { id: playerId } }),
      db.player.findUnique({ where: { id: body.targetPlayerId } }),
    ]);
    if (!target) throw app.httpErrors.notFound('Target not found');

    const fleet = await db.fleet.findFirst({ where: { id: body.fleetId, ownerId: playerId } });
    if (!fleet) throw app.httpErrors.notFound('Fleet not found');

    // Privateers steal production proportional to fleet strength
    const stolen = Math.floor(target.production * 0.05);
    await db.$transaction([
      db.player.update({ where: { id: body.targetPlayerId }, data: { production: { decrement: stolen } } }),
      db.player.update({ where: { id: playerId }, data: { production: { increment: stolen } } }),
    ]);

    // Honour loss
    await db.player.update({ where: { id: playerId }, data: { honor: { decrement: 2 } } });

    return { data: { stolen } };
  });
};

function requireAuthPayload(req: Parameters<typeof getPayload>[0]) {
  return getPayload(req);
}

async function buildBattleFleet(
  playerId: number,
  playerName: string,
  fleetId: number,
  admiral: { offense: number; defense: number; maneuver: number } | null,
): Promise<BattleFleet> {
  const ships = await db.dockedShip.findMany({
    where: { ownerId: playerId, fleetId },
    include: { design: true },
  });

  const battleShips = ships.map((s) => {
    const design = s.design;
    const armor = COMPONENT_BY_ID.get(design.armorId);
    const computer = COMPONENT_BY_ID.get(design.computerId);
    const maxHp = (SHIP_CLASS_BASE_HP[design.shipClass] ?? 80) * ((armor as { hpMult?: number })?.hpMult ?? 1);
    const ar = (computer as { ar?: number })?.ar ?? 100;
    const dr = (armor as { dr?: number })?.dr ?? 30;
    const weaponSlots: Array<{ weaponId: number; count: number }> = JSON.parse(design.weaponSlots ?? '[]') as Array<{ weaponId: number; count: number }>;
    const attack = weaponSlots.reduce((sum, ws) => {
      const w = COMPONENT_BY_ID.get(ws.weaponId);
      return sum + ((w as { power?: number })?.power ?? 0) * ws.count;
    }, 0);

    return {
      designId: design.id,
      shipClass: design.shipClass,
      count: s.count,
      hp: s.count * maxHp,
      maxHpPerShip: maxHp,
      ar,
      dr,
      attack,
      speed: 1,
      armorId: design.armorId,
      computerId: design.computerId,
      weaponIds: weaponSlots.map((ws) => ws.weaponId),
    };
  });

  return {
    fleetId,
    playerId,
    playerName,
    ships: battleShips,
    admiralOffense: admiral?.offense ?? 0,
    admiralDefense: admiral?.defense ?? 0,
    admiralManeuver: admiral?.maneuver ?? 0,
  };
}

async function buildMergedBattleFleet(
  playerId: number,
  playerName: string,
  fleetIds: number[],
): Promise<BattleFleet> {
  // Fetch all ships from all defense fleets and merge into a single fleet
  const ships = await db.dockedShip.findMany({
    where: { ownerId: playerId, fleetId: { in: fleetIds } },
    include: { design: true },
  });

  const battleShips = ships.map((s) => {
    const design = s.design;
    const armor = COMPONENT_BY_ID.get(design.armorId);
    const computer = COMPONENT_BY_ID.get(design.computerId);
    const maxHp = (SHIP_CLASS_BASE_HP[design.shipClass] ?? 80) * ((armor as { hpMult?: number })?.hpMult ?? 1);
    const ar = (computer as { ar?: number })?.ar ?? 100;
    const dr = (armor as { dr?: number })?.dr ?? 30;
    const weaponSlots: Array<{ weaponId: number; count: number }> = JSON.parse(design.weaponSlots ?? '[]') as Array<{ weaponId: number; count: number }>;
    const attack = weaponSlots.reduce((sum, ws) => {
      const w = COMPONENT_BY_ID.get(ws.weaponId);
      return sum + ((w as { power?: number })?.power ?? 0) * ws.count;
    }, 0);
    return {
      designId: design.id, shipClass: design.shipClass, count: s.count,
      hp: s.count * maxHp, maxHpPerShip: maxHp, ar, dr, attack, speed: 1,
      armorId: design.armorId, computerId: design.computerId,
      weaponIds: weaponSlots.map((ws) => ws.weaponId),
    };
  });

  return {
    fleetId: fleetIds[0] ?? 0,
    playerId,
    playerName,
    ships: battleShips,
    admiralOffense: 0,
    admiralDefense: 0,
    admiralManeuver: 0,
  };
}

function buildPlanetaryDefense(playerId: number, playerName: string, militaryBases: number): BattleFleet {
  const baseShips = militaryBases * 10;
  return {
    fleetId: 0,
    playerId,
    playerName,
    ships: baseShips > 0 ? [{
      designId: 0,
      shipClass: 2,
      count: baseShips,
      hp: baseShips * 180,
      maxHpPerShip: 180,
      ar: 130,
      dr: 40,
      attack: 200,
      speed: 0,
      armorId: 5101,
      computerId: 5201,
      weaponIds: [6101],
    }] : [],
    admiralOffense: 0,
    admiralDefense: 0,
    admiralManeuver: 0,
  };
}

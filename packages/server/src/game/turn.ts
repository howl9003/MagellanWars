import { prisma } from '../db/index.js';
import {
  totalPlayerProduction,
  totalPlayerResearch,
  calcShipBuildAlloc,
  calcRealShipProduction,
  populationGrowth,
  advanceBuildProgress,
  honourDecay,
} from './production.js';
import { processResearch } from './research.js';
import { processFleetMissions } from './fleet-missions.js';
import { getRace } from './data/races.js';
import { RELATION_TIMEOUT_TURNS, SHIP_BUILD_COST, MAX_INVESTED_SHIP_PP } from './constants.js';

export interface TurnResult {
  turn: number;
  processedAt: Date;
  playersProcessed: number;
  fleetsProcessed: number;
}

export async function processTurn(): Promise<TurnResult> {
  const processedAt = new Date();
  const nowSeconds = Math.floor(processedAt.getTime() / 1000);

  const fleetResults = await processFleetMissions(nowSeconds);

  const players = await prisma.player.findMany({
    where: { mode: { in: [0, 1, 2] } },
    include: { planets: true },
  });

  let playersProcessed = 0;
  for (const player of players) {
    try {
      await processPlayerTurn(player, player.planets, nowSeconds);
      playersProcessed++;
    } catch (err) {
      console.error(`Error processing turn for player ${player.id}:`, err);
    }
  }

  const cutoff = new Date(processedAt.getTime() - RELATION_TIMEOUT_TURNS * 60 * 1000);
  await prisma.playerRelation.deleteMany({
    where: { relation: { lt: 0 }, time: { lt: cutoff } },
  });

  await prisma.playerEffect.updateMany({ where: {}, data: { life: { decrement: 1 } } });
  await prisma.playerEffect.deleteMany({ where: { life: { lte: 0 } } });

  const status = await prisma.gameStatus.upsert({
    where: { id: 1 },
    update: { lastGameTime: processedAt, currentTurn: { increment: 1 } },
    create: { id: 1, lastGameTime: processedAt, currentTurn: 1 },
  });

  return { turn: status.currentTurn, processedAt, playersProcessed, fleetsProcessed: fleetResults.length };
}

async function processPlayerTurn(
  player: Awaited<ReturnType<typeof prisma.player.findMany>>[number],
  planets: Awaited<ReturnType<typeof prisma.planet.findMany>>,
  nowSeconds: number,
) {
  const race = getRace(player.race);
  const growthBonus = race.control.growth ?? 0;
  const efficiencyBonus = race.control.efficiency ?? 0;
  const militaryCM = race.control.military ?? 0;

  // ── 1. Income this turn ──────────────────────────────────────────────────
  const productionIncome = totalPlayerProduction(planets, player.race);
  const researchIncome = totalPlayerResearch(planets);

  // ── 2. Planet updates ────────────────────────────────────────────────────
  for (const planet of planets) {
    const growthDelta = populationGrowth(planet, growthBonus);
    const buildUpdate = advanceBuildProgress(planet, efficiencyBonus);
    await prisma.planet.update({
      where: { id: planet.id },
      data: {
        population: { increment: growthDelta },
        progressFactory: buildUpdate.progressFactory,
        progressMilitaryBase: buildUpdate.progressMilitaryBase,
        progressResearchLab: buildUpdate.progressResearchLab,
        ...(buildUpdate.buildingFactory !== undefined && { buildingFactory: buildUpdate.buildingFactory }),
        ...(buildUpdate.buildingMilitaryBase !== undefined && { buildingMilitaryBase: buildUpdate.buildingMilitaryBase }),
        ...(buildUpdate.buildingResearchLab !== undefined && { buildingResearchLab: buildUpdate.buildingResearchLab }),
      },
    });
  }

  // ── 3. Research ──────────────────────────────────────────────────────────
  const newResearchPool = player.research + researchIncome;
  const { remainingPool, learnedTechId } = await processResearch(
    player.id, newResearchPool, player.researchTechId,
  );

  // ── 4. Ship building ─────────────────────────────────────────────────────
  // Step A: Compute base allocation (taken from PP income) and real production
  // (augmented by investment pool).
  const base = calcShipBuildAlloc(productionIncome, militaryCM);
  const real = calcRealShipProduction(base, player.investedShipProduction);

  // Step B: Deduct base from general PP, add real to the ship pool accumulator.
  const ppAfterShipAlloc = player.production + productionIncome - base;
  const shipPoolBeforeBuild = player.shipProduction + real;

  // Step C: Build ships from pool, update investment pool.
  const { newShipPool, newInvestedPool, ppSpentOnShips } = await runBuildShip(
    player.id,
    shipPoolBeforeBuild,
    player.investedShipProduction,
    productionIncome,
  );

  // ── 5. Honor decay ───────────────────────────────────────────────────────
  const { honor, honorTimer } = honourDecay(player);

  // ── 6. Admiral timer ─────────────────────────────────────────────────────
  let admiralTimer = player.admiralTimer + 1;
  if (admiralTimer > 720) admiralTimer = 720;

  // ── 7. Expire protected mode ─────────────────────────────────────────────
  let protectedMode = player.protectedMode;
  if (player.protectedUntil && player.protectedUntil.getTime() / 1000 <= nowSeconds) {
    protectedMode = false;
  }

  // ── 8. Write player state ────────────────────────────────────────────────
  await prisma.player.update({
    where: { id: player.id },
    data: {
      production: Math.max(0, ppAfterShipAlloc),
      shipProduction: newShipPool,
      investedShipProduction: Math.min(MAX_INVESTED_SHIP_PP, Math.max(0, newInvestedPool)),
      research: remainingPool,
      turn: { increment: 1 },
      honor,
      honorTimer,
      admiralTimer,
      protectedMode,
      ...(learnedTechId !== null && { researchTechId: 0 }),
    },
  });

  void ppSpentOnShips; // tracked via investedShipProduction changes
}

// Mirrors player.cc build_ship():
//  - If no ships queued: move ship pool into investment pool, clear ship pool.
//  - If ships queued: build as many as pool allows, then drain investment pool
//    by PP*30/100 (the baseline drain rate). If queue empties, leftover goes to
//    investment pool.
// Returns updated pool values.
async function runBuildShip(
  playerId: number,
  shipPool: number,
  investedPool: number,
  productionIncome: number,
): Promise<{ newShipPool: number; newInvestedPool: number; ppSpentOnShips: number }> {
  const queues = await prisma.shipBuildingQueue.findMany({
    where: { ownerId: playerId, count: { gt: 0 } },
    include: { design: true },
    orderBy: { id: 'asc' },
  });

  if (queues.length === 0) {
    // Idle: unused ship pool goes into investment pool
    return {
      newShipPool: 0,
      newInvestedPool: investedPool + shipPool,
      ppSpentOnShips: 0,
    };
  }

  // Build as many ships as the pool allows
  let remaining = shipPool;
  let ppSpent = 0;

  for (const entry of queues) {
    if (remaining <= 0) break;

    const costPerShip = SHIP_BUILD_COST[entry.design.shipClass] ?? 200;
    if (remaining <= costPerShip) continue;

    const canBuild = Math.min(Math.floor(remaining / costPerShip), entry.count);
    if (canBuild <= 0) continue;

    remaining -= canBuild * costPerShip;
    ppSpent += canBuild * costPerShip;

    const existing = await prisma.dockedShip.findFirst({
      where: { ownerId: playerId, designId: entry.designId, fleetId: 0 },
    });
    if (existing) {
      await prisma.dockedShip.update({ where: { id: existing.id }, data: { count: { increment: canBuild } } });
    } else {
      await prisma.dockedShip.create({ data: { ownerId: playerId, designId: entry.designId, fleetId: 0, count: canBuild } });
    }

    const stillQueued = entry.count - canBuild;
    if (stillQueued <= 0) {
      await prisma.shipBuildingQueue.delete({ where: { id: entry.id } });
    } else {
      await prisma.shipBuildingQueue.update({
        where: { id: entry.id },
        data: { count: stillQueued, progress: { increment: canBuild }, turnsLeft: stillQueued },
      });
    }
  }

  // Drain the investment pool by the baseline amount (PP * 30/100) each build turn
  const baseDrain = Math.floor(productionIncome * 30 / 100);
  let newInvestedPool = investedPool - baseDrain;

  // Check if queue is now empty — if so, leftover ship pool goes to investment pool
  const remainingQueue = await prisma.shipBuildingQueue.count({ where: { ownerId: playerId, count: { gt: 0 } } });
  if (remainingQueue === 0) {
    newInvestedPool += remaining;
    remaining = 0;
  }

  return {
    newShipPool: remaining,
    newInvestedPool,
    ppSpentOnShips: ppSpent,
  };
}

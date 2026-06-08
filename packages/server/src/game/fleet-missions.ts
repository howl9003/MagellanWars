import { prisma } from '../db/index.js';
import type { Fleet } from '@prisma/client';

// Mission codes matching legacy C++ enum
export const MISSION = {
  STANDBY: 0,
  TRAINING: 1,
  PATROL: 2,
  EXPEDITION: 3,
  ATTACK: 4,
  DEFENSE: 5,
  ALLIANCE_DISPATCH: 6,
} as const;

// XP per turn per mission type
const XP_PER_TURN: Record<number, number> = {
  [MISSION.STANDBY]: 0,
  [MISSION.TRAINING]: 3,
  [MISSION.PATROL]: 1,
  [MISSION.EXPEDITION]: 2,
  [MISSION.ATTACK]: 0, // XP from battles only
  [MISSION.DEFENSE]: 0,
  [MISSION.ALLIANCE_DISPATCH]: 1,
};

export interface FleetTurnResult {
  id: number;
  ownerId: number;
  expGained: number;
  missionCompleted: boolean;
  newMission: number;
}

export async function processFleetMissions(
  nowSeconds: number,
): Promise<FleetTurnResult[]> {
  const activeFleets = await prisma.fleet.findMany({
    where: { mission: { not: MISSION.STANDBY } },
  });

  const results: FleetTurnResult[] = [];

  for (const fleet of activeFleets) {
    const result = await processFleet(fleet, nowSeconds);
    results.push(result);
  }

  return results;
}

async function processFleet(fleet: Fleet, nowSeconds: number): Promise<FleetTurnResult> {
  const expGained = XP_PER_TURN[fleet.mission] ?? 0;
  let missionCompleted = false;
  let newMission = fleet.mission;

  // Check if the mission timer has expired
  if (
    fleet.missionTerminateTime > 0 &&
    nowSeconds >= fleet.missionTerminateTime
  ) {
    missionCompleted = true;
    newMission = MISSION.STANDBY;
  }

  const updateData: Partial<Fleet> = {
    exp: fleet.exp + expGained,
  };

  if (missionCompleted) {
    updateData.mission = MISSION.STANDBY;
    updateData.missionTerminateTime = 0;
    updateData.missionTarget = 0;
  }

  // Advance admiral XP for the fleet's assigned admiral
  if (fleet.admiralId && expGained > 0) {
    await prisma.admiral.update({
      where: { id: fleet.admiralId },
      data: { exp: { increment: Math.floor(expGained / 2) } },
    });
  }

  await prisma.fleet.update({
    where: { ownerId_id: { ownerId: fleet.ownerId, id: fleet.id } },
    data: updateData,
  });

  return {
    id: fleet.id,
    ownerId: fleet.ownerId,
    expGained,
    missionCompleted,
    newMission,
  };
}

// Training mission: set fleet on training for N turns
export const TRAINING_DURATION_SECONDS = 3600; // 1 hour

export async function startTraining(ownerId: number, fleetId: number, nowSeconds: number) {
  return prisma.fleet.update({
    where: { ownerId_id: { ownerId, id: fleetId } },
    data: {
      mission: MISSION.TRAINING,
      missionTerminateTime: nowSeconds + TRAINING_DURATION_SECONDS,
      missionTarget: 0,
    },
  });
}

// Patrol: indefinite, no terminate time
export async function startPatrol(ownerId: number, fleetId: number) {
  return prisma.fleet.update({
    where: { ownerId_id: { ownerId, id: fleetId } },
    data: { mission: MISSION.PATROL, missionTerminateTime: 0, missionTarget: 0 },
  });
}

export async function recallFleet(ownerId: number, fleetId: number) {
  return prisma.fleet.update({
    where: { ownerId_id: { ownerId, id: fleetId } },
    data: { mission: MISSION.STANDBY, missionTerminateTime: 0, missionTarget: 0 },
  });
}

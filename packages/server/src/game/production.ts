import type { Planet, Player } from '@prisma/client';
import { raceProductionMultiplier } from './data/races.js';

// Planet production per turn:
//   base = population * (factoryRatio/100) * buildingFactories
//   modified by race bonus and planet resource quality
export function planetProduction(planet: Planet, raceId: number): number {
  const base =
    Math.floor((planet.population * planet.ratioFactory) / 100) *
    planet.buildingFactory;
  const resourceMod = 0.8 + planet.resource * 0.1; // resource 1-4 => 0.9-1.2
  const raceMod = raceProductionMultiplier(raceId);
  return Math.max(0, Math.floor(base * resourceMod * raceMod));
}

// Total production for a player across all planets
export function totalPlayerProduction(planets: Planet[], raceId: number): number {
  return planets.reduce((sum, p) => sum + planetProduction(p, raceId), 0);
}

// Planet research per turn
export function planetResearch(planet: Planet): number {
  return Math.floor(
    (planet.population * planet.ratioResearchLab) / 100 * planet.buildingResearchLab
  );
}

// Total research across all planets
export function totalPlayerResearch(planets: Planet[]): number {
  return planets.reduce((sum, p) => sum + planetResearch(p), 0);
}

// Military Points (MP) per planet per turn.
// Formula from planet.cc compute_upkeep_and_output():
//   MilitaryPoint = buildingMilitaryBase × (10 + get_uncapped_military())
// The ratio affects which bases are active via the nogada labour system (not modelled here).
// Uses uncapped militaryCM (no [-6,+10] clamp), matching get_uncapped_military().
export function planetMilitaryPoints(planet: Planet, militaryCM: number): number {
  const pointsPerBase = Math.max(1, 10 + militaryCM);
  return planet.buildingMilitaryBase * pointsPerBase;
}

export function totalMilitaryPoints(planets: Planet[], militaryCM: number): number {
  return planets.reduce((sum, p) => sum + planetMilitaryPoints(p, militaryCM), 0);
}

// Clamps militaryCM to [-6, +10] as per CControlModel::get_military().
// Use for ship production formulas. MP-per-base uses the uncapped value.
export function clampMilitaryCM(raw: number): number {
  return Math.max(-6, Math.min(10, raw));
}

// Base ship-build PP allocation taken from general PP income each turn.
// Formula from player.cc calc_ship_production():
//   = productionIncome × (30 + clamp(militaryCM, -6, 10) × 5) / 100
export function calcShipBuildAlloc(productionIncome: number, militaryCM: number): number {
  const cm = clampMilitaryCM(militaryCM);
  const pct = 30 + cm * 5;
  return Math.max(0, Math.floor(productionIncome * pct / 100));
}

// Actual PP added to the ship pool this turn (100–150% of base).
// Formula from player.cc: calc_real_ship_production()
//   BonusRatio = min(1, investedPool / base)
//   real = base * (100 + 50 * BonusRatio) / 100
export function calcRealShipProduction(base: number, investedPool: number): number {
  if (base <= 0) return 0;
  const bonusRatio = Math.min(1, investedPool / base);
  return Math.floor(base * (100 + 50 * bonusRatio) / 100);
}

// Population growth per turn (affected by growth control stat)
export function populationGrowth(planet: Planet, growthBonus: number): number {
  const baseGrowthRate = 0.02; // 2% per turn base
  const effectiveRate = baseGrowthRate * (1 + growthBonus / 100);
  // Carrying capacity roughly: planet.size * 100_000
  const capacity = planet.size * 100_000;
  const room = Math.max(0, capacity - planet.population);
  return Math.floor(planet.population * effectiveRate * (room / capacity));
}

// Building progress increments per turn (buildings cost investmentPerLevel turns to build)
const BUILD_COST_PER_LEVEL = 20; // turns to build one level

export interface BuildProgress {
  progressFactory: number;
  progressMilitaryBase: number;
  progressResearchLab: number;
  buildingFactory?: number;
  buildingMilitaryBase?: number;
  buildingResearchLab?: number;
}

export function advanceBuildProgress(planet: Planet, efficiencyBonus: number): BuildProgress {
  const speedMod = 1 + efficiencyBonus / 100;
  // Use stochastic rounding so fractional bonuses (e.g. +5%) average out correctly
  const base = Math.floor(speedMod);
  const increment = base + (Math.random() < speedMod - base ? 1 : 0);
  const result: BuildProgress = {
    progressFactory: planet.progressFactory,
    progressMilitaryBase: planet.progressMilitaryBase,
    progressResearchLab: planet.progressResearchLab,
  };

  if (planet.progressFactory > 0) {
    result.progressFactory = Math.min(
      BUILD_COST_PER_LEVEL,
      planet.progressFactory + increment
    );
    if (result.progressFactory >= BUILD_COST_PER_LEVEL) {
      result.buildingFactory = planet.buildingFactory + 1;
      result.progressFactory = 0;
    }
  }

  if (planet.progressMilitaryBase > 0) {
    result.progressMilitaryBase = Math.min(
      BUILD_COST_PER_LEVEL,
      planet.progressMilitaryBase + increment
    );
    if (result.progressMilitaryBase >= BUILD_COST_PER_LEVEL) {
      result.buildingMilitaryBase = planet.buildingMilitaryBase + 1;
      result.progressMilitaryBase = 0;
    }
  }

  if (planet.progressResearchLab > 0) {
    result.progressResearchLab = Math.min(
      BUILD_COST_PER_LEVEL,
      planet.progressResearchLab + increment
    );
    if (result.progressResearchLab >= BUILD_COST_PER_LEVEL) {
      result.buildingResearchLab = planet.buildingResearchLab + 1;
      result.progressResearchLab = 0;
    }
  }

  return result;
}

// Honor decays by 1 every honorTimer turns unless at cap (100)
export function honourDecay(player: Player): { honor: number; honorTimer: number } {
  const DECAY_INTERVAL = 48; // turns between decay ticks
  let { honor, honorTimer } = player;
  honorTimer++;
  if (honorTimer >= DECAY_INTERVAL) {
    honorTimer = 0;
    if (honor > 50) honor = Math.max(50, honor - 1);
    else if (honor < 50) honor = Math.min(50, honor + 1);
  }
  return { honor, honorTimer };
}

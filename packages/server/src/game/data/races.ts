// Race definitions derived from src/script/race.en
// Control values are percentage modifiers applied to the base stat.

export type Society = 'Classism' | 'Personalism' | 'Totalism';

export interface RaceControl {
  environment?: number;
  growth?: number;
  efficiency?: number;
  genius?: number;
  production?: number;
  facilityCost?: number;
  military?: number;
  shipMobility?: number;
  commerce?: number;
  spy?: number;
  diplomacy?: number;
  shipDefense?: number;
  shipAttack?: number;
  researchSocial?: number;
  researchLife?: number;
  researchMatter?: number;
  researchInfo?: number;
}

export interface RaceFleet {
  morale?: number;
  berserk?: number;
  survival?: number;
}

export interface RaceDefinition {
  id: number;
  name: string;
  society: Society;
  control: RaceControl;
  fleet: RaceFleet;
  startingTechs: number[];
  empireRelation?: number;
  abilities: string[];
}

export const RACES: readonly RaceDefinition[] = [
  {
    id: 1,
    name: 'Human',
    society: 'Classism',
    control: { environment: -1, growth: 2, efficiency: -1, genius: 2, researchSocial: 3 },
    fleet: { survival: 5 },
    startingTechs: [1104, 1105, 1106, 1107, 1112],
    abilities: [],
  },
  {
    id: 2,
    name: 'Targoid',
    society: 'Totalism',
    control: { growth: 2, production: 2, facilityCost: 4 },
    fleet: { berserk: 5, survival: -5 },
    startingTechs: [1404, 1405, 1406, 1413],
    abilities: ['Genetic Engineering Specialist', 'Fragile Mind Structure', 'Great Spawning Pool'],
  },
  {
    id: 3,
    name: 'Buckaneer',
    society: 'Personalism',
    control: { growth: -1, military: -1, commerce: 3 },
    fleet: { morale: 5, survival: 5 },
    startingTechs: [1208, 1112],
    abilities: ['Fast Maneuver', 'Stealth'],
  },
  {
    id: 4,
    name: 'Tecanoid',
    society: 'Classism',
    control: { environment: 2, spy: 2, researchSocial: -2, researchInfo: 4 },
    fleet: { morale: 5 },
    startingTechs: [1204, 1205, 1206],
    abilities: ['Information Network Specialist', 'Scavenger'],
  },
  {
    id: 5,
    name: 'Evintos',
    society: 'Totalism',
    control: { production: 1, efficiency: 2, diplomacy: -2 },
    fleet: { morale: -5, berserk: -5 },
    startingTechs: [1204, 1205, 1206, 1306, 1307, 1308, 1309],
    abilities: ['No Breath', 'Efficient Investment', 'Downloadable Commander Experience'],
  },
  {
    id: 6,
    name: 'Agerus',
    society: 'Totalism',
    control: { military: 4, commerce: -3, diplomacy: -3, researchLife: 3 },
    fleet: { berserk: -5, survival: -10 },
    startingTechs: [1404, 1405, 1406],
    abilities: ['No Spy', 'Asteroid Management', 'Stealth'],
  },
  {
    id: 7,
    name: 'Bosalian',
    society: 'Personalism',
    control: { military: -2, diplomacy: 4, researchLife: 2, researchSocial: 2 },
    fleet: { berserk: -5, survival: 10 },
    startingTechs: [1419],
    empireRelation: 75,
    abilities: ['PSI', 'Enhanced PSI', 'Diplomat', 'Trained Mind', 'Pacifist'],
  },
  {
    id: 8,
    name: 'Xeloss',
    society: 'Totalism',
    control: { military: 2, diplomacy: -2 },
    fleet: { morale: -5, berserk: 5, survival: -5 },
    startingTechs: [1419],
    empireRelation: 20,
    abilities: ['PSI', 'Fanatic Fleet'],
  },
] as const;

export const RACE_BY_ID = new Map(RACES.map((r) => [r.id, r]));

export function getRace(id: number): RaceDefinition {
  const race = RACE_BY_ID.get(id);
  if (!race) throw new Error(`Unknown race id: ${id}`);
  return race;
}

// Applies race production modifier. Returns the multiplier (e.g. 1.02 for +2%).
export function raceProductionMultiplier(raceId: number): number {
  const race = RACE_BY_ID.get(raceId);
  if (!race) return 1;
  const pct = race.control.production ?? 0;
  return 1 + pct / 100;
}

export function raceResearchMultiplier(raceId: number, tree: 'social' | 'life' | 'matter' | 'info'): number {
  const race = RACE_BY_ID.get(raceId);
  if (!race) return 1;
  const map: Record<string, keyof RaceControl> = {
    social: 'researchSocial',
    life: 'researchLife',
    matter: 'researchMatter',
    info: 'researchInfo',
  };
  const key = map[tree];
  if (!key) return 1;
  const pct = (race.control[key] as number | undefined) ?? 0;
  return 1 + pct / 100;
}

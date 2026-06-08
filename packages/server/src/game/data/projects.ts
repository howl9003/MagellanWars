// Planetary project definitions derived from src/script/project.en
// Projects are one-time investments that grant permanent empire bonuses.

export type ProjectType = 'Planet' | 'Fixed' | 'Council' | 'Secret';

export interface ProjectEffect {
  production?: number;
  research?: number;
  military?: number;
  commerce?: number;
  efficiency?: number;
  diplomacy?: number;
  spy?: number;
  growth?: number;
  populationDestroy?: number;
  militaryBaseDamageRate?: number;
  eventRate?: number;
}

export interface ProjectDefinition {
  id: number;
  name: string;
  type: ProjectType;
  cost: number;        // production cost
  prereqs: number[];   // tech prereqs
  effects: ProjectEffect;
  societyReq?: 'Classism' | 'Personalism' | 'Totalism';
  raceReq?: number;    // specific race ID requirement
  description: string;
}

export const PROJECTS: readonly ProjectDefinition[] = [
  {
    id: 7002,
    name: 'Earth Elevator',
    type: 'Planet',
    cost: 35000,
    prereqs: [1320],
    effects: { production: 1 },
    description: 'Gravitational elevator for efficient planetary transport. +1% production.',
  },
  {
    id: 7004,
    name: 'Weather Control System',
    type: 'Planet',
    cost: 40000,
    prereqs: [1402],
    effects: { growth: 1, production: 1 },
    description: 'Controls planetary weather for optimal conditions. +1% growth and production.',
  },
  {
    id: 7005,
    name: 'Galactic Stock Market',
    type: 'Fixed',
    cost: 80000,
    prereqs: [1112],
    effects: { commerce: 3 },
    description: 'Empire-wide financial network. +3% commerce income.',
  },
  {
    id: 7006,
    name: 'Transcendent University',
    type: 'Planet',
    cost: 45000,
    prereqs: [1106],
    effects: { research: 2 },
    description: 'Galaxy-renowned university. +2% research output.',
  },
  {
    id: 7007,
    name: 'Mind Control Center',
    type: 'Planet',
    cost: 55000,
    prereqs: [1107],
    effects: { spy: 3, military: 1 },
    description: 'Psi-enhanced interrogation and control facility.',
  },
  {
    id: 7008,
    name: 'Clone Family',
    type: 'Planet',
    cost: 50000,
    prereqs: [1409],
    effects: { growth: 3 },
    description: 'Mass cloning program for rapid population growth. +3% population growth.',
  },
  {
    id: 7009,
    name: 'Imperial Palace',
    type: 'Fixed',
    cost: 100000,
    prereqs: [1118],
    effects: { diplomacy: 5, production: 2 },
    description: 'Seat of imperial power. +5% diplomacy, +2% production.',
  },
  {
    id: 7010,
    name: 'Advanced Research Institute',
    type: 'Planet',
    cost: 60000,
    prereqs: [1207],
    effects: { research: 3, efficiency: 1 },
    description: 'State-of-the-art research complex. +3% research, +1% efficiency.',
  },
  {
    id: 7011,
    name: 'Mega Factory',
    type: 'Planet',
    cost: 70000,
    prereqs: [1309],
    effects: { production: 3 },
    description: 'Automated mega-scale factory complex. +3% production.',
  },
  {
    id: 7012,
    name: 'Organic Plant',
    type: 'Planet',
    cost: 65000,
    prereqs: [1406],
    effects: { production: 2, growth: 2 },
    description: 'Bio-engineered production facility.',
  },
  {
    id: 7013,
    name: 'Galactic Agreement of Free Commerce',
    type: 'Fixed',
    cost: 120000,
    prereqs: [1123],
    effects: { commerce: 5, diplomacy: 3 },
    description: 'Empire-wide free trade agreement. Major commerce and diplomacy boost.',
  },
  {
    id: 7014,
    name: 'Symbol of Liberation',
    type: 'Fixed',
    cost: 90000,
    prereqs: [1122],
    effects: { diplomacy: 4, growth: 2, military: 1 },
    description: 'Iconic symbol inspiring empire-wide morale.',
  },
  {
    id: 7015,
    name: 'Saga Archive',
    type: 'Fixed',
    cost: 75000,
    prereqs: [1113],
    effects: { research: 2, efficiency: 2 },
    description: 'Repository of galactic history and science.',
  },
  {
    id: 7016,
    name: 'The One Unified Mind',
    type: 'Fixed',
    cost: 150000,
    prereqs: [1215],
    effects: { efficiency: 5, research: 3 },
    description: 'Network-linked consciousness for unified decision making.',
    societyReq: 'Totalism',
  },
  {
    id: 7017,
    name: 'Galactic Liberalism Movement',
    type: 'Fixed',
    cost: 110000,
    prereqs: [1121],
    effects: { commerce: 4, diplomacy: 4, spy: -2 },
    description: 'Galactic political movement reducing borders and tariffs.',
    societyReq: 'Personalism',
  },
  {
    id: 7018,
    name: 'Humanoid Plant',
    type: 'Planet',
    cost: 55000,
    prereqs: [1411],
    effects: { growth: 4, production: 1 },
    description: 'Bio-engineered humanoid production facility.',
  },
  {
    id: 7019,
    name: 'Archmage',
    type: 'Fixed',
    cost: 200000,
    prereqs: [1419],
    effects: { military: 5, spy: 3, diplomacy: 2 },
    description: 'Supreme psionic entity in service to the empire.',
  },
  {
    id: 7020,
    name: 'Nova Plant',
    type: 'Planet',
    cost: 150000,
    prereqs: [1314],
    effects: { production: 5, research: 2 },
    description: 'Anti-matter energy production facility.',
  },
  // Council-exclusive projects
  {
    id: 7038,
    name: 'Grand Temple',
    type: 'Council',
    cost: 50000,
    prereqs: [1104],
    effects: { diplomacy: 3, growth: 2 },
    description: 'Spiritual center for the council. +3 diplomacy, +2 growth.',
  },
  {
    id: 7039,
    name: 'Council War Academy',
    type: 'Council',
    cost: 80000,
    prereqs: [1304],
    effects: { military: 4, efficiency: 2 },
    description: 'Elite military academy shared across the council.',
  },
  {
    id: 7040,
    name: 'Council Research Nexus',
    type: 'Council',
    cost: 100000,
    prereqs: [1205],
    effects: { research: 4, efficiency: 2 },
    description: 'Shared research network for all council members.',
  },
] as const;

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

export function getProject(id: number): ProjectDefinition {
  const p = PROJECT_BY_ID.get(id);
  if (!p) throw new Error(`Unknown project id: ${id}`);
  return p;
}

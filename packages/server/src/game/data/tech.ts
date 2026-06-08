// Tech tree data derived from src/script/tech.en
// Only the most important metadata is captured here; full descriptions
// are not needed for game logic.

export type TechTree = 'SOCL' | 'INFO' | 'MATR' | 'LIFE' | 'UPG' | 'SCH' | 'AMA';

export interface TechEffect {
  commerce?: number;
  diplomacy?: number;
  efficiency?: number;
  growth?: number;
  production?: number;
  military?: number;
  spy?: number;
  shipAttack?: number;
  shipDefense?: number;
  shipMobility?: number;
  researchBonus?: number;
}

export interface TechDefinition {
  id: number;
  name: string;
  tree: TechTree;
  level: number;
  prerequisites: number[];
  effects: TechEffect;
  // base research cost in research points (higher level = more expensive)
  baseCost: number;
}

// Cost formula: level^2 * 50
const cost = (level: number) => level * level * 50;

export const TECH_DEFS: readonly TechDefinition[] = [
  // ── SOCIAL (11xx) ──────────────────────────────────────────────────────────
  { id: 1101, name: 'Metaphysics',         tree: 'SOCL', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1102, name: 'Logic',               tree: 'SOCL', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1103, name: 'Philosophy',          tree: 'SOCL', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1104, name: 'Religion',            tree: 'SOCL', level: 2, prerequisites: [1101, 1103], effects: {},                  baseCost: cost(2) },
  { id: 1105, name: 'Planetary Economics', tree: 'SOCL', level: 2, prerequisites: [1102, 1103], effects: { commerce: 1 },     baseCost: cost(2) },
  { id: 1106, name: 'Symbolic Logic',      tree: 'SOCL', level: 2, prerequisites: [1102, 1103], effects: { efficiency: 1 },   baseCost: cost(2) },
  { id: 1107, name: 'Psychology',          tree: 'SOCL', level: 2, prerequisites: [1101, 1103], effects: {},                  baseCost: cost(2) },
  { id: 1108, name: 'Cosmic Environmentalism', tree: 'SOCL', level: 3, prerequisites: [1104, 1105], effects: { diplomacy: 1 }, baseCost: cost(3) },
  { id: 1109, name: 'Classism Theory',     tree: 'SOCL', level: 3, prerequisites: [1106, 1107], effects: { diplomacy: 1 },   baseCost: cost(3) },
  { id: 1110, name: 'Totalism Theory',     tree: 'SOCL', level: 3, prerequisites: [1106, 1107], effects: { efficiency: 1 },  baseCost: cost(3) },
  { id: 1111, name: 'Personalism Theory',  tree: 'SOCL', level: 3, prerequisites: [1106, 1107], effects: { commerce: 1 },    baseCost: cost(3) },
  { id: 1112, name: 'Galactic Economics',  tree: 'SOCL', level: 3, prerequisites: [1105, 1107], effects: { commerce: 1 },    baseCost: cost(3) },
  { id: 1113, name: 'Alien Archaeology',   tree: 'SOCL', level: 4, prerequisites: [1108, 1109], effects: {},                  baseCost: cost(4) },
  { id: 1114, name: 'Green Economics',     tree: 'SOCL', level: 4, prerequisites: [1108, 1112], effects: {},                  baseCost: cost(4) },
  { id: 1115, name: 'Federation Theory',  tree: 'SOCL', level: 4, prerequisites: [1109, 1110], effects: {},                  baseCost: cost(4) },
  { id: 1116, name: 'Galactic Domination',tree: 'SOCL', level: 4, prerequisites: [1110, 1111], effects: { spy: 1 },          baseCost: cost(4) },
  { id: 1117, name: 'Cosmic Sociology',   tree: 'SOCL', level: 5, prerequisites: [1113, 1114], effects: {},                  baseCost: cost(5) },
  { id: 1118, name: 'Galactic Governance',tree: 'SOCL', level: 5, prerequisites: [1115, 1116], effects: { diplomacy: 1 },   baseCost: cost(5) },
  { id: 1119, name: 'Universal Ethics',   tree: 'SOCL', level: 5, prerequisites: [1113, 1117], effects: { efficiency: 1 },  baseCost: cost(5) },
  { id: 1120, name: 'Omni Economics',     tree: 'SOCL', level: 5, prerequisites: [1114, 1118], effects: { diplomacy: 1 },   baseCost: cost(5) },
  { id: 1121, name: 'Cosmic Psychology',  tree: 'SOCL', level: 6, prerequisites: [1119, 1120], effects: { commerce: 1 },    baseCost: cost(6) },
  { id: 1122, name: 'Galactic Culture',   tree: 'SOCL', level: 6, prerequisites: [1118, 1119], effects: { efficiency: 1 },  baseCost: cost(6) },
  { id: 1123, name: 'Cosmic Diplomacy',   tree: 'SOCL', level: 6, prerequisites: [1120, 1121], effects: { diplomacy: 1 },   baseCost: cost(6) },
  { id: 1124, name: 'Universal Law',      tree: 'SOCL', level: 7, prerequisites: [1122, 1123], effects: {},                  baseCost: cost(7) },
  { id: 1125, name: 'Omni Consciousness', tree: 'SOCL', level: 7, prerequisites: [1121, 1122], effects: {},                  baseCost: cost(7) },

  // ── INFO (12xx) ────────────────────────────────────────────────────────────
  { id: 1201, name: 'Electronics',         tree: 'INFO', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1202, name: 'Photonics',           tree: 'INFO', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1203, name: 'Quantum Mechanics',   tree: 'INFO', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1204, name: 'Computer Science',    tree: 'INFO', level: 2, prerequisites: [1201, 1203], effects: {},                  baseCost: cost(2) },
  { id: 1205, name: 'Artificial Intelligence', tree: 'INFO', level: 3, prerequisites: [1204],   effects: { efficiency: 1 },  baseCost: cost(3) },
  { id: 1206, name: 'Neural Networking',   tree: 'INFO', level: 4, prerequisites: [1205],       effects: { spy: 1 },         baseCost: cost(4) },
  { id: 1207, name: 'Quantum Computing',   tree: 'INFO', level: 4, prerequisites: [1203, 1205], effects: { efficiency: 2 },  baseCost: cost(4) },
  { id: 1208, name: 'Stealth Technology',  tree: 'INFO', level: 2, prerequisites: [1201, 1202], effects: { spy: 1 },         baseCost: cost(2) },
  { id: 1209, name: 'Sensor Systems',      tree: 'INFO', level: 3, prerequisites: [1202, 1204], effects: {},                  baseCost: cost(3) },
  { id: 1210, name: 'Electronic Warfare',  tree: 'INFO', level: 3, prerequisites: [1204, 1208], effects: { spy: 1 },         baseCost: cost(3) },
  { id: 1211, name: 'Signal Intelligence', tree: 'INFO', level: 4, prerequisites: [1209, 1210], effects: { spy: 2 },         baseCost: cost(4) },
  { id: 1212, name: 'Cybernetics',         tree: 'INFO', level: 5, prerequisites: [1206, 1207], effects: { efficiency: 1 },  baseCost: cost(5) },
  { id: 1213, name: 'Quantum Encryption',  tree: 'INFO', level: 5, prerequisites: [1207, 1211], effects: { spy: 1 },         baseCost: cost(5) },
  { id: 1214, name: 'Distributed Mind',    tree: 'INFO', level: 6, prerequisites: [1212, 1213], effects: { efficiency: 2 },  baseCost: cost(6) },
  { id: 1215, name: 'Omega Network',       tree: 'INFO', level: 7, prerequisites: [1214],       effects: { efficiency: 2, spy: 2 }, baseCost: cost(7) },

  // ── MATTER (13xx) ──────────────────────────────────────────────────────────
  { id: 1301, name: 'Basic Engineering',   tree: 'MATR', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1302, name: 'Metallurgy',          tree: 'MATR', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1303, name: 'Nuclear Physics',     tree: 'MATR', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1304, name: 'Structural Engineering', tree: 'MATR', level: 2, prerequisites: [1301, 1302], effects: { production: 1 }, baseCost: cost(2) },
  { id: 1305, name: 'Fusion Power',        tree: 'MATR', level: 2, prerequisites: [1303],       effects: {},                  baseCost: cost(2) },
  { id: 1306, name: 'Advanced Materials',  tree: 'MATR', level: 3, prerequisites: [1302, 1304], effects: { production: 1 },  baseCost: cost(3) },
  { id: 1307, name: 'Plasma Physics',      tree: 'MATR', level: 3, prerequisites: [1303, 1305], effects: { shipAttack: 1 },  baseCost: cost(3) },
  { id: 1308, name: 'Gravitics',           tree: 'MATR', level: 3, prerequisites: [1303, 1305], effects: { shipMobility: 1 }, baseCost: cost(3) },
  { id: 1309, name: 'Nanotechnology',      tree: 'MATR', level: 4, prerequisites: [1306, 1307], effects: { production: 2 },  baseCost: cost(4) },
  { id: 1310, name: 'Anti-Gravity',        tree: 'MATR', level: 4, prerequisites: [1308],       effects: { shipMobility: 2 }, baseCost: cost(4) },
  { id: 1311, name: 'Dark Matter Theory',  tree: 'MATR', level: 5, prerequisites: [1309],       effects: {},                  baseCost: cost(5) },
  { id: 1312, name: 'Wormhole Physics',    tree: 'MATR', level: 5, prerequisites: [1310, 1311], effects: { shipMobility: 2 }, baseCost: cost(5) },
  { id: 1313, name: 'Quantum Materials',   tree: 'MATR', level: 6, prerequisites: [1309, 1311], effects: { production: 2, shipDefense: 1 }, baseCost: cost(6) },
  { id: 1314, name: 'Omega Engineering',   tree: 'MATR', level: 7, prerequisites: [1312, 1313], effects: { production: 3 },  baseCost: cost(7) },

  // ── LIFE (14xx) ────────────────────────────────────────────────────────────
  { id: 1401, name: 'Biology',             tree: 'LIFE', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1402, name: 'Ecology',             tree: 'LIFE', level: 1, prerequisites: [],           effects: {},                  baseCost: cost(1) },
  { id: 1403, name: 'Medicine',            tree: 'LIFE', level: 1, prerequisites: [],           effects: { growth: 1 },      baseCost: cost(1) },
  { id: 1404, name: 'Genetic Engineering', tree: 'LIFE', level: 2, prerequisites: [1401, 1403], effects: { growth: 1 },      baseCost: cost(2) },
  { id: 1405, name: 'Terraforming',        tree: 'LIFE', level: 2, prerequisites: [1402, 1403], effects: {},                  baseCost: cost(2) },
  { id: 1406, name: 'Bio-Engineering',     tree: 'LIFE', level: 3, prerequisites: [1404, 1405], effects: { growth: 1 },      baseCost: cost(3) },
  { id: 1407, name: 'Xenobiology',         tree: 'LIFE', level: 3, prerequisites: [1402, 1404], effects: {},                  baseCost: cost(3) },
  { id: 1408, name: 'Psi Research',        tree: 'LIFE', level: 3, prerequisites: [1401, 1407], effects: {},                  baseCost: cost(3) },
  { id: 1409, name: 'Cloning',             tree: 'LIFE', level: 4, prerequisites: [1404, 1406], effects: { growth: 2 },      baseCost: cost(4) },
  { id: 1410, name: 'Planetary Ecology',   tree: 'LIFE', level: 4, prerequisites: [1405, 1407], effects: {},                  baseCost: cost(4) },
  { id: 1411, name: 'Enhanced Biology',    tree: 'LIFE', level: 5, prerequisites: [1409, 1410], effects: { growth: 2 },      baseCost: cost(5) },
  { id: 1412, name: 'Psi Power',           tree: 'LIFE', level: 5, prerequisites: [1408, 1409], effects: {},                  baseCost: cost(5) },
  { id: 1413, name: 'Evolutionary Genetics', tree: 'LIFE', level: 5, prerequisites: [1409, 1411], effects: { growth: 2 },   baseCost: cost(5) },
  { id: 1414, name: 'Bio-Weapons',         tree: 'LIFE', level: 6, prerequisites: [1411, 1412], effects: { military: 1 },    baseCost: cost(6) },
  { id: 1415, name: 'Omega Life',          tree: 'LIFE', level: 7, prerequisites: [1413, 1414], effects: { growth: 3 },      baseCost: cost(7) },
  { id: 1419, name: 'Psi Mastery',         tree: 'LIFE', level: 6, prerequisites: [1412],       effects: { military: 2 },    baseCost: cost(6) },
] as const;

export const TECH_BY_ID = new Map(TECH_DEFS.map((t) => [t.id, t]));

export function getTech(id: number): TechDefinition {
  const tech = TECH_BY_ID.get(id);
  if (!tech) throw new Error(`Unknown tech id: ${id}`);
  return tech;
}

export function getTreeTechs(tree: TechTree): TechDefinition[] {
  return TECH_DEFS.filter((t) => t.tree === tree);
}

export function canLearnTech(ownedTechIds: Set<number>, techId: number): boolean {
  const tech = TECH_BY_ID.get(techId);
  if (!tech) return false;
  if (ownedTechIds.has(techId)) return false;
  return tech.prerequisites.every((pid) => ownedTechIds.has(pid));
}

export function researchCost(techId: number, researchBonus: number = 0): number {
  const tech = TECH_BY_ID.get(techId);
  if (!tech) throw new Error(`Unknown tech id: ${techId}`);
  return Math.max(1, Math.floor(tech.baseCost * (1 - researchBonus / 100)));
}

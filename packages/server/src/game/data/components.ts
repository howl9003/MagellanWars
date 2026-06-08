// Ship component data derived from src/script/component.en
// IDs: 51xx=Armor, 52xx=Computer, 53xx=Shield, 54xx=Engine, 55xx=Device
//      61xx=Beam weapon, 62xx=Missile weapon, 63xx=Projectile weapon

export type ComponentCategory = 'ARMOR' | 'COMP' | 'SHLD' | 'ENGN' | 'DEV' | 'WPN';
export type WeaponType = 'BEAM' | 'MISSILE' | 'PROJ';
export type ArmorType = 'NORM' | 'BIO' | 'REACT';

export interface ComponentEffect {
  beamDefense?: number;
  projectileDefense?: number;
  missileDefense?: number;
  psiDefense?: number;
  repairSpeed?: number;
  shieldSolidity?: number;
  shieldStrength?: number;
  coolingTime?: number;
  mobility?: number;
  speed?: number;
  beamDamage?: number;
  missileDamage?: number;
  weaponAR?: number;
  nonRepairable?: boolean;
  impenetrableShield?: boolean;
}

export interface ArmorComponent {
  id: number;
  name: string;
  category: 'ARMOR';
  armorType: ArmorType;
  level: number;
  dr: number;         // defense rate
  hpMult: number;     // HP multiplier
  prereqs: number[];
  effects: ComponentEffect;
}

export interface ComputerComponent {
  id: number;
  name: string;
  category: 'COMP';
  level: number;
  ar: number;         // attack rate (accuracy)
  dr: number;         // defense rate (evasion assist)
  prereqs: number[];
}

export interface ShieldComponent {
  id: number;
  name: string;
  category: 'SHLD';
  level: number;
  solidity: number;   // solid shield points (absorb hits)
  strength: number;   // max HP of shield
  regenRate: number;  // regen per round
  prereqs: number[];
}

export interface EngineComponent {
  id: number;
  name: string;
  category: 'ENGN';
  level: number;
  // battleSpeed by ship class 1-10
  battleSpeed: [number, number, number, number, number, number, number, number, number, number];
  prereqs: number[];
}

export interface DeviceComponent {
  id: number;
  name: string;
  category: 'DEV';
  level: number;
  prereqs: number[];
  raceReq?: string;
  effects: ComponentEffect;
}

export interface WeaponComponent {
  id: number;
  name: string;
  category: 'WPN';
  weaponType: WeaponType;
  level: number;
  ar: number;          // attack rate (base accuracy)
  power: number;       // damage per hit
  range: number;       // effective range (0-10000)
  angleOfFire: number; // fire arc in degrees
  coolTime: number;    // rounds between shots
  prereqs: number[];
  effects: ComponentEffect;
}

export type ShipComponent =
  | ArmorComponent
  | ComputerComponent
  | ShieldComponent
  | EngineComponent
  | DeviceComponent
  | WeaponComponent;

// ─── Armor ────────────────────────────────────────────────────────────────────

export const ARMORS: ArmorComponent[] = [
  { id: 5101, name: 'Titanium',             category: 'ARMOR', armorType: 'NORM', level: 1, dr: 30,  hpMult: 1.00, prereqs: [],     effects: {} },
  { id: 5102, name: 'Mithril',              category: 'ARMOR', armorType: 'NORM', level: 2, dr: 34,  hpMult: 1.35, prereqs: [1311], effects: { psiDefense: 15 } },
  { id: 5103, name: 'Adamantium',           category: 'ARMOR', armorType: 'NORM', level: 3, dr: 40,  hpMult: 1.85, prereqs: [1325], effects: { psiDefense: 30 } },
  { id: 5104, name: 'Neutronium',           category: 'ARMOR', armorType: 'NORM', level: 4, dr: 53,  hpMult: 3.00, prereqs: [1329], effects: { beamDefense: 20, repairSpeed: -50 } },
  { id: 5105, name: 'Eternium',             category: 'ARMOR', armorType: 'NORM', level: 5, dr: 78,  hpMult: 3.85, prereqs: [1333], effects: { projectileDefense: 20, beamDefense: 20, nonRepairable: true } },
  { id: 5106, name: 'Self-Recovering Crystal', category: 'ARMOR', armorType: 'NORM', level: 2, dr: 36, hpMult: 1.20, prereqs: [1318], effects: { beamDefense: 10, projectileDefense: 20, repairSpeed: 100 } },
  { id: 5107, name: 'Amoeba Skin',          category: 'ARMOR', armorType: 'NORM', level: 4, dr: 40,  hpMult: 2.40, prereqs: [1406], effects: { beamDefense: 20, missileDefense: 20, repairSpeed: 200 } },
  { id: 5108, name: 'Living Armor',         category: 'ARMOR', armorType: 'BIO',  level: 2, dr: 30,  hpMult: 1.80, prereqs: [1404], effects: { repairSpeed: 80 } },
  { id: 5109, name: 'Organic Armor',        category: 'ARMOR', armorType: 'BIO',  level: 3, dr: 36,  hpMult: 2.40, prereqs: [1413], effects: { repairSpeed: 150 } },
  { id: 5110, name: 'Omni-Armor',           category: 'ARMOR', armorType: 'BIO',  level: 5, dr: 50,  hpMult: 4.10, prereqs: [1415], effects: { beamDefense: 20, projectileDefense: 20, missileDefense: 20, repairSpeed: 200 } },
  { id: 5111, name: 'Reactive Armor',       category: 'ARMOR', armorType: 'REACT', level: 3, dr: 30, hpMult: 1.55, prereqs: [1306], effects: { projectileDefense: 30 } },
  { id: 5112, name: 'Plasma Reactive Armor', category: 'ARMOR', armorType: 'REACT', level: 4, dr: 40, hpMult: 2.10, prereqs: [1313], effects: { beamDefense: 20 } },
  { id: 5113, name: 'Anti-Matter Reactive', category: 'ARMOR', armorType: 'REACT', level: 5, dr: 40,  hpMult: 2.20, prereqs: [1314], effects: { beamDefense: 30, projectileDefense: 20, missileDefense: 20 } },
];

// ─── Computers ────────────────────────────────────────────────────────────────

export const COMPUTERS: ComputerComponent[] = [
  { id: 5201, name: 'Targeting System I',  category: 'COMP', level: 1, ar: 100, dr: 233, prereqs: [] },
  { id: 5202, name: 'Targeting System II', category: 'COMP', level: 2, ar: 133, dr: 289, prereqs: [1204] },
  { id: 5203, name: 'Targeting System III', category: 'COMP', level: 3, ar: 172, dr: 354, prereqs: [1205] },
  { id: 5204, name: 'Targeting System IV', category: 'COMP', level: 4, ar: 218, dr: 429, prereqs: [1207] },
  { id: 5205, name: 'Targeting System V',  category: 'COMP', level: 5, ar: 271, dr: 518, prereqs: [1214] },
];

// ─── Shields ──────────────────────────────────────────────────────────────────

export const SHIELDS: ShieldComponent[] = [
  { id: 5301, name: 'Phase Shield I',   category: 'SHLD', level: 1, solidity: 1, strength: 120,  regenRate: 20,  prereqs: [] },
  { id: 5302, name: 'Phase Shield II',  category: 'SHLD', level: 2, solidity: 1, strength: 200,  regenRate: 35,  prereqs: [1305] },
  { id: 5303, name: 'Phase Shield III', category: 'SHLD', level: 3, solidity: 2, strength: 350,  regenRate: 55,  prereqs: [1307] },
  { id: 5304, name: 'Phase Shield IV',  category: 'SHLD', level: 4, solidity: 2, strength: 550,  regenRate: 80,  prereqs: [1311] },
  { id: 5305, name: 'Phase Shield V',   category: 'SHLD', level: 5, solidity: 3, strength: 900,  regenRate: 110, prereqs: [1313] },
];

// ─── Engines ──────────────────────────────────────────────────────────────────

export const ENGINES: EngineComponent[] = [
  { id: 5401, name: 'Impulse Drive',    category: 'ENGN', level: 1, prereqs: [],     battleSpeed: [16,15,14,14,13,13,12,11,10, 9] },
  { id: 5402, name: 'Warp Drive',       category: 'ENGN', level: 2, prereqs: [1310], battleSpeed: [22,21,20,19,18,17,16,15,14,13] },
  { id: 5403, name: 'Anti-Matter Drive',category: 'ENGN', level: 3, prereqs: [1322], battleSpeed: [31,30,29,27,25,24,23,21,19,17] },
  { id: 5404, name: 'Dark Energy Drive', category: 'ENGN', level: 4, prereqs: [1332], battleSpeed: [42,40,38,36,34,32,30,28,26,24] },
  { id: 5405, name: 'Dimension Drive',  category: 'ENGN', level: 5, prereqs: [1334], battleSpeed: [59,57,54,51,48,46,43,40,37,34] },
];

// ─── Devices ──────────────────────────────────────────────────────────────────

export const DEVICES: DeviceComponent[] = [
  { id: 5501, name: 'Inertial Nullifier',      category: 'DEV', level: 1, prereqs: [1312], effects: { projectileDefense: 5, beamDefense: 25, mobility: 25 } },
  { id: 5502, name: 'Crystal Chip',            category: 'DEV', level: 2, prereqs: [1318], effects: { shieldSolidity: 1, shieldStrength: 20, coolingTime: -20 } },
  { id: 5503, name: 'Psi Booster',             category: 'DEV', level: 5, prereqs: [1419], raceReq: 'PSI', effects: { mobility: 45, speed: 20 } },
  { id: 5504, name: 'Force Field Enhancer',    category: 'DEV', level: 1, prereqs: [1314], effects: { shieldSolidity: 2, shieldStrength: 30, impenetrableShield: true } },
  { id: 5505, name: 'Beam Lens',               category: 'DEV', level: 5, prereqs: [1332], effects: { beamDamage: 30 } },
  { id: 5506, name: 'Missile Launcher System', category: 'DEV', level: 5, prereqs: [1329], effects: { missileDamage: 30, weaponAR: 15 } },
  { id: 5507, name: 'Cloaking Device',         category: 'DEV', level: 4, prereqs: [1211], effects: {} },
  { id: 5508, name: 'Electronic Counter System', category: 'DEV', level: 4, prereqs: [1213], effects: { beamDefense: 20, projectileDefense: 20 } },
  { id: 5509, name: 'Repair Bot',              category: 'DEV', level: 3, prereqs: [1309], effects: { repairSpeed: 100 } },
  { id: 5510, name: 'Shield Booster',          category: 'DEV', level: 3, prereqs: [1307], effects: { shieldStrength: 50, shieldSolidity: 1 } },
  { id: 5511, name: 'Quantum Accelerator',     category: 'DEV', level: 5, prereqs: [1314], effects: { speed: 30, mobility: 20 } },
  { id: 5519, name: 'Space Mining Module',     category: 'DEV', level: 3, prereqs: [1117], effects: {} },
  { id: 5524, name: 'Psionic Barrier',         category: 'DEV', level: 4, prereqs: [1123], effects: { psiDefense: 50 } },
];

// ─── Weapons ──────────────────────────────────────────────────────────────────

export const WEAPONS: WeaponComponent[] = [
  // Beam weapons (61xx)
  { id: 6101, name: 'Laser',           category: 'WPN', weaponType: 'BEAM', level: 1, ar: 70,  power: 120,  range: 700,  angleOfFire: 60,  coolTime: 1, prereqs: [],     effects: {} },
  { id: 6102, name: 'Ion Cannon',      category: 'WPN', weaponType: 'BEAM', level: 2, ar: 85,  power: 200,  range: 850,  angleOfFire: 50,  coolTime: 1, prereqs: [1303], effects: {} },
  { id: 6103, name: 'Plasma Beam',     category: 'WPN', weaponType: 'BEAM', level: 3, ar: 95,  power: 340,  range: 1000, angleOfFire: 40,  coolTime: 1, prereqs: [1307], effects: {} },
  { id: 6104, name: 'Gauss Cannon',    category: 'WPN', weaponType: 'BEAM', level: 3, ar: 80,  power: 380,  range: 1200, angleOfFire: 30,  coolTime: 2, prereqs: [1308], effects: {} },
  { id: 6105, name: 'Anti-Matter Beam', category: 'WPN', weaponType: 'BEAM', level: 4, ar: 100, power: 580,  range: 1100, angleOfFire: 40,  coolTime: 1, prereqs: [1311], effects: {} },
  { id: 6106, name: 'Dark Energy Beam', category: 'WPN', weaponType: 'BEAM', level: 5, ar: 110, power: 900,  range: 1300, angleOfFire: 35,  coolTime: 1, prereqs: [1313], effects: {} },
  { id: 6107, name: 'Omega Ray',       category: 'WPN', weaponType: 'BEAM', level: 6, ar: 130, power: 1400, range: 1500, angleOfFire: 30,  coolTime: 1, prereqs: [1314], effects: {} },
  // PSI weapons
  { id: 6108, name: 'Psi Blast',       category: 'WPN', weaponType: 'BEAM', level: 4, ar: 90,  power: 500,  range: 900,  angleOfFire: 60,  coolTime: 1, prereqs: [1412], effects: {} },
  { id: 6109, name: 'Enhanced Psi Blast', category: 'WPN', weaponType: 'BEAM', level: 5, ar: 110, power: 800, range: 1100, angleOfFire: 60, coolTime: 1, prereqs: [1419], effects: {} },
  { id: 6110, name: 'Psi Annihilator', category: 'WPN', weaponType: 'BEAM', level: 6, ar: 130, power: 1200, range: 1200, angleOfFire: 60,  coolTime: 1, prereqs: [1419], effects: {} },

  // Missile weapons (62xx)
  { id: 6201, name: 'Missile',         category: 'WPN', weaponType: 'MISSILE', level: 1, ar: 60,  power: 150,  range: 1500, angleOfFire: 180, coolTime: 2, prereqs: [],     effects: {} },
  { id: 6202, name: 'Guided Missile',  category: 'WPN', weaponType: 'MISSILE', level: 2, ar: 75,  power: 260,  range: 1800, angleOfFire: 180, coolTime: 2, prereqs: [1204], effects: {} },
  { id: 6203, name: 'Smart Missile',   category: 'WPN', weaponType: 'MISSILE', level: 3, ar: 88,  power: 420,  range: 2100, angleOfFire: 180, coolTime: 2, prereqs: [1205], effects: {} },
  { id: 6204, name: 'Plasma Missile',  category: 'WPN', weaponType: 'MISSILE', level: 4, ar: 100, power: 660,  range: 2400, angleOfFire: 180, coolTime: 2, prereqs: [1307], effects: {} },
  { id: 6205, name: 'Quantum Torpedo', category: 'WPN', weaponType: 'MISSILE', level: 5, ar: 110, power: 1000, range: 2800, angleOfFire: 180, coolTime: 2, prereqs: [1311], effects: {} },
  { id: 6206, name: 'Omega Torpedo',   category: 'WPN', weaponType: 'MISSILE', level: 6, ar: 120, power: 1500, range: 3000, angleOfFire: 180, coolTime: 2, prereqs: [1314], effects: {} },
  { id: 6207, name: 'Cluster Bomb',    category: 'WPN', weaponType: 'MISSILE', level: 3, ar: 70,  power: 350,  range: 1600, angleOfFire: 180, coolTime: 3, prereqs: [1308], effects: {} },
  { id: 6208, name: 'EMP Torpedo',     category: 'WPN', weaponType: 'MISSILE', level: 4, ar: 95,  power: 500,  range: 2000, angleOfFire: 180, coolTime: 2, prereqs: [1210], effects: {} },
  { id: 6209, name: 'Bio-Warhead',     category: 'WPN', weaponType: 'MISSILE', level: 4, ar: 85,  power: 600,  range: 2000, angleOfFire: 180, coolTime: 3, prereqs: [1414], effects: {} },
  { id: 6210, name: 'Dark Torpedo',    category: 'WPN', weaponType: 'MISSILE', level: 5, ar: 105, power: 1100, range: 2600, angleOfFire: 180, coolTime: 2, prereqs: [1312], effects: {} },

  // Projectile weapons (63xx)
  { id: 6301, name: 'Mass Driver',     category: 'WPN', weaponType: 'PROJ', level: 1, ar: 65,  power: 130,  range: 600,  angleOfFire: 45,  coolTime: 1, prereqs: [],     effects: {} },
  { id: 6302, name: 'Rail Gun',        category: 'WPN', weaponType: 'PROJ', level: 2, ar: 80,  power: 220,  range: 750,  angleOfFire: 40,  coolTime: 1, prereqs: [1302], effects: {} },
  { id: 6303, name: 'Particle Cannon', category: 'WPN', weaponType: 'PROJ', level: 3, ar: 90,  power: 360,  range: 900,  angleOfFire: 35,  coolTime: 1, prereqs: [1306], effects: {} },
  { id: 6304, name: 'Positron Cannon', category: 'WPN', weaponType: 'PROJ', level: 4, ar: 100, power: 560,  range: 1100, angleOfFire: 30,  coolTime: 1, prereqs: [1309], effects: {} },
  { id: 6305, name: 'Graviton Cannon', category: 'WPN', weaponType: 'PROJ', level: 5, ar: 110, power: 860,  range: 1300, angleOfFire: 28,  coolTime: 1, prereqs: [1312], effects: {} },
  { id: 6306, name: 'Singularity Gun', category: 'WPN', weaponType: 'PROJ', level: 6, ar: 125, power: 1350, range: 1500, angleOfFire: 25,  coolTime: 1, prereqs: [1314], effects: {} },
  { id: 6307, name: 'Shatter Cannon',  category: 'WPN', weaponType: 'PROJ', level: 3, ar: 75,  power: 300,  range: 700,  angleOfFire: 50,  coolTime: 1, prereqs: [1304], effects: { projectileDefense: 10 } },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

const ALL_COMPONENTS: ShipComponent[] = [
  ...ARMORS, ...COMPUTERS, ...SHIELDS, ...ENGINES, ...DEVICES, ...WEAPONS
];
export const COMPONENT_BY_ID = new Map(ALL_COMPONENTS.map((c) => [c.id, c]));

export function getComponent(id: number): ShipComponent {
  const c = COMPONENT_BY_ID.get(id);
  if (!c) throw new Error(`Unknown component id: ${id}`);
  return c;
}

export function isWeapon(c: ShipComponent): c is WeaponComponent {
  return c.category === 'WPN';
}

// Ship class sizes: Class1 = smallest/fastest, Class10 = largest/most HP
export const SHIP_CLASS_BASE_HP = [80, 120, 180, 260, 360, 480, 620, 780, 960, 1200] as const;
export const SHIP_CLASS_NAMES = [
  'Fighter', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship',
  'Dreadnought', 'Titan', 'Colossus', 'Leviathan', 'Juggernaut'
] as const;

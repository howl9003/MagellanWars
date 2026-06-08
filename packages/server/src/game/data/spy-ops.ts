// Spy operation definitions derived from src/script/spy.en

export type SpyOpType = 'ACPT' | 'ORDN' | 'HOST' | 'ATRO';

export interface SpyOp {
  id: number;
  name: string;
  difficulty: number;  // base difficulty (0-500). Higher = harder to succeed
  cost: number;        // production point cost
  type: SpyOpType;
  prereqs: number[];   // required tech IDs
  description: string;
}

export const SPY_OPS: readonly SpyOp[] = [
  {
    id: 8001,
    name: 'General Information Gathering',
    difficulty: 0,
    cost: 100,
    type: 'ACPT',
    prereqs: [],
    description: 'Collect basic intelligence on the target empire. Reveals production, research, and fleet counts.',
  },
  {
    id: 8002,
    name: 'Detailed Information Gathering',
    difficulty: 0,
    cost: 5000,
    type: 'ACPT',
    prereqs: [1210],
    description: 'Deep analysis of collected intelligence. Reveals tech tree, fleet composition, and planet details.',
  },
  {
    id: 8003,
    name: 'Steal Secret Info',
    difficulty: 200,
    cost: 10000,
    type: 'ACPT',
    prereqs: [1116],
    description: 'Obtain classified enemy information. May cause diplomatic disturbances if detected.',
  },
  {
    id: 8004,
    name: 'Computer Virus Infiltration',
    difficulty: 50,
    cost: 5000,
    type: 'HOST',
    prereqs: [1212],
    description: 'Infiltrate hostile computer virus. Reduces target research output for several turns.',
  },
  {
    id: 8005,
    name: 'Devastating Network Worm',
    difficulty: 150,
    cost: 10000,
    type: 'HOST',
    prereqs: [1222],
    description: 'Release a network worm that chronically damages the target information infrastructure.',
  },
  {
    id: 8006,
    name: 'Sabotage',
    difficulty: 100,
    cost: 30000,
    type: 'HOST',
    prereqs: [1105],
    description: 'Incite industrial sabotage. Destroys factories and reduces production for several turns.',
  },
  {
    id: 8007,
    name: 'Incite Riot',
    difficulty: 140,
    cost: 7000,
    type: 'HOST',
    prereqs: [1414],
    description: 'Psi attack on the population causing massive civil unrest. Greater damage than sabotage.',
  },
  {
    id: 8008,
    name: 'Steal Common Technology',
    difficulty: 100,
    cost: 6500,
    type: 'ACPT',
    prereqs: [1206],
    description: 'Steal a low-level technology that you do not currently possess.',
  },
  {
    id: 8009,
    name: 'Steal Advanced Technology',
    difficulty: 250,
    cost: 15000,
    type: 'ORDN',
    prereqs: [1213],
    description: 'Steal an advanced technology from the target empire.',
  },
  {
    id: 8010,
    name: 'Assassinate Admiral',
    difficulty: 300,
    cost: 20000,
    type: 'ATRO',
    prereqs: [1211],
    description: 'Eliminate a target admiral. Severe diplomatic penalty if detected.',
  },
  {
    id: 8011,
    name: 'Incite Rebellion',
    difficulty: 350,
    cost: 25000,
    type: 'ATRO',
    prereqs: [1123],
    description: 'Foment rebellion in the target empire, drastically reducing their empire relation.',
  },
  {
    id: 8012,
    name: 'Destroy Military Base',
    difficulty: 200,
    cost: 18000,
    type: 'HOST',
    prereqs: [1116],
    description: 'Destroy a military base on a target planet.',
  },
] as const;

export const SPY_OP_BY_ID = new Map(SPY_OPS.map((s) => [s.id, s]));

// Spy success chance formula:
// baseChance = attacker.alertness * 100 / (attacker.alertness + op.difficulty + defender.securityLevel * 50)
// clamped to [5, 95]
export function spySuccessChance(
  attackerAlertnessLevel: number,
  opDifficulty: number,
  defenderSecurityLevel: number,
): number {
  const effective = opDifficulty + defenderSecurityLevel * 50;
  if (effective <= 0) return 95;
  const chance = Math.floor((attackerAlertnessLevel * 100) / (attackerAlertnessLevel + effective));
  return Math.max(5, Math.min(95, chance));
}

// Detection chance: whether the defending player notices the attempt
export function spyDetectionChance(
  defenderSecurityLevel: number,
  opType: SpyOpType,
): number {
  const base = { ACPT: 5, ORDN: 15, HOST: 30, ATRO: 45 }[opType];
  return Math.min(80, base + defenderSecurityLevel * 5);
}

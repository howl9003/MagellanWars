// Battle simulation types

export interface BattleShip {
  designId: number;
  shipClass: number;   // 0-9
  count: number;
  hp: number;          // current aggregate HP (count * maxHpPerShip)
  maxHpPerShip: number;
  ar: number;          // attack rating from computer
  dr: number;          // defense rating from armor
  attack: number;      // total damage per salvo
  speed: number;
  armorId: number;
  computerId: number;
  weaponIds: number[];
}

export interface BattleFleet {
  fleetId: number;
  playerId: number;
  playerName: string;
  ships: BattleShip[];
  admiralOffense: number;   // bonus %
  admiralDefense: number;   // bonus %
  admiralManeuver: number;  // bonus %
}

export interface RoundResult {
  round: number;
  attackerDamage: number;   // damage dealt to defender
  defenderDamage: number;   // damage dealt to attacker
  attackerLost: number;     // ships lost this round
  defenderLost: number;
}

export interface BattleResult {
  attackerWon: boolean;
  isDraw: boolean;
  rounds: RoundResult[];
  attackerFleet: BattleFleet;
  defenderFleet: BattleFleet;
  attackerShipsLost: number;
  defenderShipsLost: number;
  attackerExpGained: number;
  defenderExpGained: number;
  log: string[];
}

// Core battle simulation engine
// Hit formula from battle.cc: hitChance = AR*100/(AR+DR), clamped [5,95]
// Rounds cap at 30; attacker wins if defender fleet is destroyed, else defender wins

import type { BattleFleet, BattleResult, RoundResult } from './types.js';

const MAX_ROUNDS = 30;
const MIN_HIT = 5;
const MAX_HIT = 95;

function hitChance(ar: number, dr: number): number {
  if (ar + dr <= 0) return MIN_HIT;
  const raw = Math.floor((ar * 100) / (ar + dr));
  return Math.max(MIN_HIT, Math.min(MAX_HIT, raw));
}

function totalShips(fleet: BattleFleet): number {
  return fleet.ships.reduce((s, sh) => s + sh.count, 0);
}

function fleetAr(fleet: BattleFleet): number {
  const base = fleet.ships.reduce((sum, sh) => sum + sh.ar * sh.count, 0) /
    Math.max(1, totalShips(fleet));
  return Math.floor(base * (1 + fleet.admiralOffense / 100));
}

function fleetDr(fleet: BattleFleet): number {
  const base = fleet.ships.reduce((sum, sh) => sum + sh.dr * sh.count, 0) /
    Math.max(1, totalShips(fleet));
  return Math.floor(base * (1 + fleet.admiralDefense / 100));
}

function fleetDamage(fleet: BattleFleet, hitPct: number): number {
  const totalAttack = fleet.ships.reduce((sum, sh) => sum + sh.attack * sh.count, 0);
  return Math.floor((totalAttack * hitPct) / 100);
}

function applyDamage(fleet: BattleFleet, damage: number): number {
  let remaining = damage;
  let shipsLost = 0;
  for (const ship of fleet.ships) {
    if (remaining <= 0) break;
    if (ship.count === 0) continue;
    const hpPool = ship.count * ship.maxHpPerShip;
    if (remaining >= hpPool) {
      shipsLost += ship.count;
      remaining -= hpPool;
      ship.hp = 0;
      ship.count = 0;
    } else {
      const killed = Math.floor(remaining / ship.maxHpPerShip);
      shipsLost += killed;
      ship.count -= killed;
      ship.hp = ship.count * ship.maxHpPerShip - (remaining % ship.maxHpPerShip);
      remaining = 0;
    }
  }
  return shipsLost;
}

export function simulateBattle(
  attacker: BattleFleet,
  defender: BattleFleet,
): BattleResult {
  const log: string[] = [];
  const rounds: RoundResult[] = [];

  const atk = deepClone(attacker);
  const def = deepClone(defender);

  const initialAttackerShips = totalShips(atk);
  const initialDefenderShips = totalShips(def);

  log.push(`Battle begins: ${atk.playerName} (${initialAttackerShips} ships) vs ${def.playerName} (${initialDefenderShips} ships)`);

  let r = 0;
  while (r < MAX_ROUNDS && totalShips(atk) > 0 && totalShips(def) > 0) {
    r++;
    const atkAr = fleetAr(atk);
    const defDr = fleetDr(def);
    const defAr = fleetAr(def);
    const atkDr = fleetDr(atk);

    const atkHit = hitChance(atkAr, defDr);
    const defHit = hitChance(defAr, atkDr);

    const atkDmg = fleetDamage(atk, atkHit);
    const defDmg = fleetDamage(def, defHit);

    const defLost = applyDamage(def, atkDmg);
    const atkLost = applyDamage(atk, defDmg);

    const round: RoundResult = {
      round: r,
      attackerDamage: atkDmg,
      defenderDamage: defDmg,
      attackerLost: atkLost,
      defenderLost: defLost,
    };
    rounds.push(round);

    log.push(`Round ${r}: ATK deals ${atkDmg} dmg (${atkHit}% hit, -${defLost} ships), DEF deals ${defDmg} dmg (${defHit}% hit, -${atkLost} ships)`);
  }

  const atkRemaining = totalShips(atk);
  const defRemaining = totalShips(def);
  const atkLostTotal = initialAttackerShips - atkRemaining;
  const defLostTotal = initialDefenderShips - defRemaining;

  const attackerWon = defRemaining === 0 && atkRemaining > 0;
  const isDraw = defRemaining === 0 && atkRemaining === 0;

  if (attackerWon) log.push(`${atk.playerName} wins! Defender destroyed.`);
  else if (isDraw) log.push('Draw! Both fleets destroyed.');
  else log.push(`${def.playerName} defends successfully. ${atkRemaining} attacker ships retreat.`);

  const atkExp = Math.floor(defLostTotal * 10 + (attackerWon ? 500 : 0));
  const defExp = Math.floor(atkLostTotal * 10 + (!attackerWon && !isDraw ? 300 : 0));

  return {
    attackerWon,
    isDraw,
    rounds,
    attackerFleet: atk,
    defenderFleet: def,
    attackerShipsLost: atkLostTotal,
    defenderShipsLost: defLostTotal,
    attackerExpGained: atkExp,
    defenderExpGained: defExp,
    log,
  };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

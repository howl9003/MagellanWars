// Battle report generation — produces the BattleRecord DB payload

import type { BattleResult } from './types.js';

export interface BattleRecordPayload {
  attackerId: number;
  defenderId: number;
  attackerName: string;
  defenderName: string;
  attackerRace: number;
  defenderRace: number;
  attackerCouncil: number;
  defenderCouncil: number;
  warType: number;
  isDraw: boolean;
  winner: number;
  planetId: number;
  battleFieldName: string;
  attackerGain: string;
  attackerLoseFleet: string;
  defenderLoseFleet: string;
  thereWasBattle: boolean;
}

export function buildBattleRecord(
  result: BattleResult,
  opts: {
    attackerId: number;
    defenderId: number;
    attackerRace: number;
    defenderRace: number;
    attackerCouncil?: number;
    defenderCouncil?: number;
    warType?: number;
    planetId?: number;
    battleFieldName?: string;
  },
): BattleRecordPayload {
  const winner = result.isDraw ? 0
    : result.attackerWon ? opts.attackerId
    : opts.defenderId;

  return {
    attackerId: opts.attackerId,
    defenderId: opts.defenderId,
    attackerName: result.attackerFleet.playerName,
    defenderName: result.defenderFleet.playerName,
    attackerRace: opts.attackerRace,
    defenderRace: opts.defenderRace,
    attackerCouncil: opts.attackerCouncil ?? 0,
    defenderCouncil: opts.defenderCouncil ?? 0,
    warType: opts.warType ?? 0,
    isDraw: result.isDraw,
    winner,
    planetId: opts.planetId ?? 0,
    battleFieldName: opts.battleFieldName ?? 'Deep Space',
    attackerGain: JSON.stringify({ expGained: result.attackerExpGained }),
    attackerLoseFleet: JSON.stringify({ shipsLost: result.attackerShipsLost }),
    defenderLoseFleet: JSON.stringify({ shipsLost: result.defenderShipsLost }),
    thereWasBattle: result.rounds.length > 0,
  };
}

export function formatBattleLog(result: BattleResult): string {
  return result.log.join('\n');
}

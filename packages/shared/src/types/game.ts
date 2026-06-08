// Core domain types shared between client and server.
// These mirror the game entities from the legacy MySQL schema.

export type Race =
  | 'human'
  | 'noxian'
  | 'cephean'
  | 'torean'
  | 'agerus'
  | 'targoid'
  | 'krill'
  | 'xerusian';

export type PlayerMode = 'normal' | 'newbie' | 'vacation' | 'banned';

export type RelationStatus =
  | 'war'
  | 'hostile'
  | 'neutral'
  | 'friendly'
  | 'alliance'
  | 'pact'
  | 'truce';

export type FleetMission =
  | 'standby'
  | 'training'
  | 'patrol'
  | 'expedition'
  | 'attack'
  | 'defense'
  | 'alliance_dispatch';

export interface Player {
  id: number;
  portalId: number;
  name: string;
  race: Race;
  mode: PlayerMode;
  honor: number;
  rating: number;
  councilId: number | null;
  homeClusterId: number;
  lastLogin: Date;
  production: number;
  research: number;
  tick: number;
  turn: number;
}

export interface Planet {
  id: number;
  clusterId: number;
  ownerId: number;
  name: string;
  population: number;
  size: number;
  resource: number;
  gravity: number;
  temperature: number;
  atmosphere: string;
  buildingFactory: number;
  buildingMilitaryBase: number;
  buildingResearchLab: number;
  ratioFactory: number;
  ratioMilitaryBase: number;
  ratioResearchLab: number;
}

export interface Fleet {
  ownerId: number;
  id: number;
  name: string;
  admiralId: bigint | null;
  status: number;
  maxShips: number;
  currentShips: number;
  mission: FleetMission;
  missionTarget: number;
  missionTerminateTime: Date | null;
  killedShips: number;
  killedFleets: number;
}

export interface Admiral {
  id: bigint;
  ownerId: number;
  race: Race;
  name: string;
  level: number;
  exp: number;
  offense: number;
  defense: number;
  maneuver: number;
  detection: number;
  efficiency: number;
  fleetCommandLevel: number;
}

export interface Council {
  id: number;
  speakerId: number;
  name: string;
  slogan: string;
  production: number;
  honor: number;
  homeClusterId: number;
}

export interface ShipDesign {
  ownerId: number;
  designId: number;
  name: string;
  body: number;
  armor: number;
  engine: number;
  computer: number;
  shield: number;
  weapons: number[];
  weaponCounts: number[];
  devices: number[];
  cost: number;
}

export interface BattleRecord {
  id: number;
  attackerId: number;
  defenderId: number;
  attackerName: string;
  defenderName: string;
  attackerRace: Race;
  defenderRace: Race;
  time: Date;
  winner: number;
  planetId: number;
  battleFieldName: string;
  thereWasBattle: boolean;
}

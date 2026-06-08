// API contract types — request/response shapes used by both client and server.

import type { Player, Planet, Fleet, Admiral, Council, BattleRecord } from './game.js';

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: string;
  statusCode: number;
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  player: Player;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  playerName: string;
  race: Player['race'];
}

// Game state
export interface DashboardResponse {
  player: Player;
  planets: Planet[];
  fleets: Fleet[];
  admirals: Admiral[];
  council: Council | null;
}

export interface BattleListResponse {
  battles: BattleRecord[];
  total: number;
  page: number;
  pageSize: number;
}

// WebSocket event types
export type ServerToClientEvents = {
  'game:tick': (data: { turn: number; tick: number }) => void;
  'fleet:updated': (fleet: Fleet) => void;
  'battle:result': (battle: BattleRecord) => void;
  'news:update': (news: { message: string; time: Date }) => void;
};

export type ClientToServerEvents = {
  'fleet:setMission': (data: { fleetId: number; mission: Fleet['mission']; target?: number }) => void;
};

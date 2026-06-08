// Game-wide constants

// How many turns a negative relation record persists before auto-expiry
export const RELATION_TIMEOUT_TURNS = 2880; // ~48h at 60s/turn

// Honour boundaries
export const HONOR_MIN = 0;
export const HONOR_MAX = 100;

// Protected mode duration (seconds)
export const PROTECTED_MODE_DURATION_S = 7 * 24 * 3600; // 7 days

// Admiral cooldown turns before a new admiral may arrive
export const ADMIRAL_COOLDOWN_TURNS = 720; // ~12h at 60s/turn

// Max planets per cluster
export const MAX_PLANETS_PER_CLUSTER = 20;

// Max fleet size (ships)
export const MAX_FLEET_SHIPS = 200;

// Production cost per ship by ship class (class 0 cheapest → class 9 most expensive)
export const SHIP_BUILD_COST: readonly number[] = [200, 400, 700, 1000, 1500, 2000, 2600, 3200, 4000, 5000];

// Cap on investedShipProduction (investment pool).
// In the C++ source this is MAX_INVESTED_SHIP_PP. Using a large fixed value.
export const MAX_INVESTED_SHIP_PP = 100_000_000;

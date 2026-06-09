# MagellanWars — Modern Stack Rewrite

Space-themed browser MMO (turn-based empire management) being rewritten from legacy C++ to a TypeScript monorepo.

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Package manager | pnpm 9 (workspaces) |
| Backend | Fastify 5 + TypeScript |
| Frontend | React 19 + Vite 6 |
| Database | PostgreSQL 16 + Prisma 6 |
| Real-time | Socket.IO 4 (via `@fastify/websocket`) |
| State (client) | Zustand + TanStack Query 5 |
| Routing (client) | React Router 7 |
| Validation | Zod |
| Testing | Vitest 3 (no test files yet; CI uses `--passWithNoTests`) |

### Monorepo layout

```
packages/
  shared/   — TypeScript types only, no runtime deps (@magellanwars/shared)
  server/   — Fastify API + game engine + Prisma (@magellanwars/server)
  client/   — React SPA (@magellanwars/client)
src/        — Legacy C++ source (reference only, do not modify)
encyclopedia_data/  — Static HTML component reference data
```

### Request flow

```
Browser
  └─ React SPA (Vite, port 5173 dev / nginx in prod)
       ├─ REST  → /api/* → Fastify (port 3000)
       └─ WS    → /socket.io → Socket.IO (port 3000)
                     └─ PostgreSQL (port 5432)
```

---

## Server package (`packages/server/`)

### Entry points

| File | Purpose |
|------|---------|
| `src/index.ts` | Server entry — starts Fastify, seeds scheduler |
| `src/app.ts` | `buildApp()` — registers all plugins and routes |
| `src/db/index.ts` | Singleton Prisma client |
| `src/ws/index.ts` | Socket.IO setup |

### API routes (`src/routes/` → registered under `/api/<prefix>`)

| File | Prefix | Systems covered |
|------|--------|----------------|
| `auth.ts` | `/api/auth` | login, register, change-password |
| `player.ts` | `/api/player` | empire snapshot, planet list, fleet list, news |
| `fleet.ts` | `/api/fleet` | create, rename, assign admiral, set mission, disband |
| `battle.ts` | `/api/battle` | history, pagination, per-player filter |
| `diplomacy.ts` | `/api/diplomacy` | player/council relations, messages, cooldowns |
| `tech.ts` | `/api/tech` | queue, research, instant-grant (55-tech tree) |
| `council.ts` | `/api/council` | create, join, admit, donate, disband, speakers |
| `empire.ts` | `/api/empire` | planet ratios, building queue, investment, events |
| `blackmarket.ts` | `/api/blackmarket` | list, bid, close-expired with tech grant |
| `bounty.ts` | `/api/bounty` | place, cancel (80% refund), list |
| `admin.ts` | `/api/admin` | player CRUD, ban/unban, grant-tech, force-turn |
| `ship.ts` | `/api/ship` | ship designer — designs, build queue, components |
| `spy.ts` | `/api/spy` | spy operations list, launch, results |
| `war.ts` | `/api/war` | declare war, attacks, defense assignments |
| `project.ts` | `/api/project` | empire projects — list, start, cancel |
| `info.ts` | `/api/info` | player stats, rankings, encyclopedia |

### Auth middleware (`src/middleware/auth.ts`)

All protected routes call `requireAuth` or `requireAdmin` as a `preHandler`:
- **`requireAuth`** — verifies JWT; rejects with 401
- **`requireAdmin`** — verifies JWT; also checks `userLevel === 'ADMIN' | 'DEV'`
- **`getPayload(request)`** — returns `{ userId, playerId }` from the JWT

JWT payload shape: `{ userId: number; playerId: number; userLevel?: string }`.

### Game engine (`src/game/`)

| File | Responsibility |
|------|---------------|
| `turn.ts` | `processTurn()` — orchestrates one full game tick |
| `scheduler.ts` | `node-cron` ticker; interval set by `TURN_INTERVAL_SECONDS` env var |
| `production.ts` | Resource and ship-production formulas |
| `research.ts` | Tech-point accumulation and queue advancement |
| `fleet-missions.ts` | Mission timers, expedition/attack resolution |
| `constants.ts` | Numeric game constants (see below) |
| `battle/combat.ts` | Fleet vs fleet combat math |
| `battle/report.ts` | Battle report generation |
| `battle/types.ts` | TypeScript types for combat internals |

**Key constants (`src/game/constants.ts`):**

| Constant | Value | Meaning |
|----------|-------|---------|
| `RELATION_TIMEOUT_TURNS` | 2880 | ~48 h before relation record auto-expires |
| `HONOR_MIN / MAX` | 0 / 100 | Honour boundaries |
| `PROTECTED_MODE_DURATION_S` | 604 800 | 7-day new-player protection |
| `ADMIRAL_COOLDOWN_TURNS` | 720 | ~12 h between admiral arrivals |
| `MAX_PLANETS_PER_CLUSTER` | 20 | |
| `MAX_FLEET_SHIPS` | 200 | |
| `SHIP_BUILD_COST` | `[200…5000]` | Cost per ship class 0–9 |
| `MAX_INVESTED_SHIP_PP` | 100 000 000 | Investment pool cap |

### Static game data (`src/game/data/`)

| File | Contents |
|------|---------|
| `tech.ts` | 55-technology tree, four branches: SOCL / INFO / MATR / LIFE |
| `races.ts` | 8 playable races with attribute bonuses |
| `projects.ts` | Empire project catalogue |
| `components.ts` | Ship component catalogue (weapons, engines, shields, …) |
| `spy-ops.ts` | Spy operation definitions and costs |

### Database

Schema: `packages/server/prisma/schema.prisma` (PostgreSQL, ~536 lines).
Mirrors the legacy MySQL schema from `src/apps/archspace/DB/all.sql`.

**Key models:**

| Model | Table | Notes |
|-------|-------|-------|
| `User` | `users` | Auth credentials, `userLevel` (PLAYER/ADMIN/DEV) |
| `Session` | `sessions` | Token store, cascades on User delete |
| `Cluster` | `cluster` | Star clusters (world map nodes) |
| `Player` | *(auto)* | Empire state, resources, ratings |
| `Planet` | *(auto)* | Building ratios, population, resource |
| `Fleet` | *(auto)* | Ships, admiral, mission, `missionTerminateTime` |
| `Admiral` | *(auto)* | Stats, experience, level |
| `Council` | *(auto)* | Alliance/council grouping |
| `ShipDesign` | *(auto)* | Saved ship configurations |
| `BattleRecord` | *(auto)* | Battle history per fight |

---

## Client package (`packages/client/`)

### Entry points

| File | Purpose |
|------|---------|
| `src/main.tsx` | React entry |
| `src/App.tsx` | Root component — router setup, auth guard |
| `src/lib/api.ts` | Typed `fetch` wrapper for `/api/*` |
| `src/lib/auth.ts` | JWT storage and session helpers |
| `src/components/ui.tsx` | Shared UI primitives |

### Pages (`src/pages/`)

| Page | Route | Feature |
|------|-------|---------|
| `LoginPage.tsx` | `/login` | Auth form |
| `DashboardPage.tsx` | `/` | Empire overview |
| `ShipDesignerPage.tsx` | `/ships` | Design and build ships |
| `TechPage.tsx` | `/tech` | Technology tree UI |
| `ProjectsPage.tsx` | `/projects` | Empire projects |
| `CouncilPage.tsx` | `/council` | Alliance/council management |
| `DiplomacyPage.tsx` | `/diplomacy` | Diplomatic relations |
| `WarfarePage.tsx` | `/warfare` | War declarations and attacks |
| `BattlesPage.tsx` | `/battles` | Battle history |
| `SpyPage.tsx` | `/spy` | Espionage operations |
| `BlackmarketPage.tsx` | `/blackmarket` | Black market bids |
| `InfoPage.tsx` | `/info` | Encyclopedia / player stats |
| `RankingsPage.tsx` | `/rankings` | Leaderboards |
| `PreferencesPage.tsx` | `/preferences` | Account settings |

### Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useHotkeys.ts` | Keyboard shortcut registration |
| `useToast.ts` | Toast notification trigger |
| `useToastContext.ts` | Toast context provider hook |

---

## Shared package (`packages/shared/`)

Pure TypeScript types — zero runtime dependencies; compiled to `dist/`.

**`src/types/game.ts`** — domain types:
- `Race` — 8 values: human, noxian, cephean, torean, agerus, targoid, krill, xerusian
- `PlayerMode` — normal / newbie / vacation / banned
- `RelationStatus` — war / hostile / neutral / friendly / alliance / pact / truce
- `FleetMission` — standby / training / patrol / expedition / attack / defense / alliance_dispatch
- Interfaces: `Player`, `Planet`, `Fleet`, `Admiral`, `Council`, `ShipDesign`, `BattleRecord`

**`src/types/api.ts`** — API contract shapes (request/response DTOs).

---

## Development

```bash
# Install all workspace dependencies
pnpm install

# Run everything in dev mode (server + client hot-reload)
pnpm dev

# Type-check all packages
pnpm typecheck

# Lint
pnpm lint

# Run tests (passes with no test files present)
pnpm test

# Database commands (run from packages/server/ or root)
pnpm db:generate   # regenerate Prisma client after schema changes
pnpm db:migrate    # create & apply a migration
pnpm db:push       # push schema directly (dev only, no migration file)
pnpm db:studio     # open Prisma Studio
```

Copy `packages/server/.env.example` → `packages/server/.env`:

```
DATABASE_URL="postgresql://magellan:magellan@localhost:5432/magellanwars"
JWT_SECRET="change-me-to-a-long-random-string-in-production"
CLIENT_ORIGIN="http://localhost:5173"
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development
```

---

## Migration status (C++ → TypeScript)

### Completed

1. ✅ **Auth** — login/register/change-password (`routes/auth.ts`)
2. ✅ **Player dashboard** — empire snapshot, planet list, fleet list, news (`routes/player.ts`)
3. ✅ **Fleet management** — create/rename/assign admiral/mission/disband (`routes/fleet.ts`)
4. ✅ **Battle records** — history, pagination, per-player filter (`routes/battle.ts`)
5. ✅ **Turn engine** — production, research, population, buildings, honour, admiral timer (`game/turn.ts` + `production.ts` + `research.ts` + `fleet-missions.ts`)
6. ✅ **Turn scheduler** — `node-cron` ticker, configurable via `TURN_INTERVAL_SECONDS` (`game/scheduler.ts`)
7. ✅ **Diplomacy** — player/council relations, messages, cooldowns (`routes/diplomacy.ts`)
8. ✅ **Tech tree** — 55-tech tree across SOCL/INFO/MATR/LIFE, queue/research/instant (`routes/tech.ts`, `game/data/tech.ts`)
9. ✅ **Council/Alliance** — create, join, admit, donate, disband, speakers (`routes/council.ts`)
10. ✅ **Empire management** — planet ratios, building queue, investment, events (`routes/empire.ts`)
11. ✅ **Black market** — list, bid, close-expired with tech grant (`routes/blackmarket.ts`)
12. ✅ **Bounty system** — place, cancel (80% refund), list (`routes/bounty.ts`)
13. ✅ **Admin** — player CRUD, ban/unban, grant-tech, force-turn, council/market/bounty management (`routes/admin.ts`)
14. ✅ **Ship designer** — designs, build queue, component catalogue (`routes/ship.ts`, `game/data/components.ts`)
15. ✅ **Spy operations** — op catalogue, launch, results (`routes/spy.ts`, `game/data/spy-ops.ts`)
16. ✅ **Warfare** — war declarations, attacks, defense assignments (`routes/war.ts`)
17. ✅ **Projects** — empire project start/cancel (`routes/project.ts`, `game/data/projects.ts`)
18. ✅ **Info / encyclopedia** — rankings, player stats, component docs (`routes/info.ts`)

### In progress / pending

19. ⏸ **Battle engine** — partial stub in `game/battle/` (combat.ts, report.ts, types.ts); full port from `battle.cc` (~5 K LOC) still needed
20. ⏸ **Test suite** — Vitest configured; zero test files exist; CI uses `--passWithNoTests`

### Key C++ files for reference

| File | LOC | Status |
|------|-----|--------|
| `battle.cc` | ~5,000 | Partially stubbed |
| `trigger.cc` | ~3,000 | ✅ ported as turn engine |
| `page/fleet.cc` | ~2,000 | ✅ ported |
| `page/empire.cc` | ~2,000 | ✅ ported |
| `page/diplomacy.cc` | ~1,500 | ✅ ported |
| `page/tech.cc` | ~1,000 | ✅ ported |
| `page/black_market.cc` | ~800 | ✅ ported |

---

## Game invariants to preserve

- Turn duration: 60 seconds (`SecondPerTurn` in `archspace.config`; overridable via `TURN_INTERVAL_SECONDS`)
- Diplomatic cooldown: 4.8 hours (major actions), 1.6 hours (council votes)
- Rating system: default 2000, ELO-style adjustment on battle outcomes
- Planet building ratios must sum to 100
- Fleet `missionTerminateTime` is stored as a Unix timestamp in seconds
- Honour is clamped to `[0, 100]`
- New players enter 7-day protected mode (`PROTECTED_MODE_DURATION_S`)
- Ship class costs range from 200 (class 0) to 5 000 (class 9)

### C++ → TypeScript entity mapping

| C++ concept | TypeScript location |
|-------------|---------------------|
| `archspace` binary + CGI pages | Fastify route handlers in `packages/server/src/routes/` |
| MySQL `player` table | `Player` Prisma model |
| Turn trigger loop (`trigger.cc`) | `packages/server/src/game/turn.ts` — `processTurn()` |
| Binary CGI protocol | REST JSON over HTTP + Socket.IO for push events |
| `proxy.py` HTTP bridge | Eliminated — Fastify serves HTTP directly |
| jQuery/Yahoo UI frontend | React components in `packages/client/src/` |
| Script files (`tech.en`, `race.en`, etc.) | `packages/server/src/game/data/*.ts` |

---

## Docker

Legacy stack (C++ + MySQL 5.7):
```bash
docker compose up                              # uses docker-compose.yml
# or
docker compose -f docker-compose.legacy.yml up
```

New stack (Node.js + PostgreSQL 16):
```bash
docker compose -f docker-compose.new.yml up
```

Docker images are published to `ghcr.io/howl9003/vibespace-server:latest` and `ghcr.io/howl9003/vibespace-client:latest` by the `docker.yml` CI workflow on every push to `main`.

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) — triggers on push to `main` or `claude/**` branches, and on PRs to `main`:

| Job | Command | Runs after |
|-----|---------|-----------|
| `typecheck` | `pnpm typecheck` | — |
| `lint` | `pnpm lint` | — |
| `test` | `pnpm test` (Vitest + real PostgreSQL 16 service) | — |
| `build` | full production build | typecheck, lint, test |

The `docker.yml` workflow builds and pushes Docker images on push to `main`.

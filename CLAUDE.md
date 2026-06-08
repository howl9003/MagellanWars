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
| Real-time | Socket.IO 4 |
| State (client) | Zustand + TanStack Query |
| Routing (client) | React Router 7 |
| Validation | Zod |
| Testing | Vitest |

### Monorepo layout

```
packages/
  shared/   — TypeScript types shared by client and server (@magellanwars/shared)
  server/   — Fastify API + game engine + Prisma (@magellanwars/server)
  client/   — React SPA (@magellanwars/client)
src/        — Legacy C++ source (reference only, do not modify)
```

### Database

Schema lives in `packages/server/prisma/schema.prisma`. It mirrors the legacy MySQL schema (`src/apps/archspace/DB/all.sql`) translated to PostgreSQL idioms.

Key models: `User`, `Player`, `Planet`, `Fleet`, `Admiral`, `Council`, `ShipDesign`, `BattleRecord`.

### Request flow (new stack)

```
Browser
  └─ React SPA (Vite, port 5173 dev / nginx in prod)
       ├─ REST  → /api/* → Fastify (port 3000)
       └─ WS    → /socket.io → Socket.IO (port 3000)
                     └─ PostgreSQL (port 5432)
```

## Development

```bash
# Install all workspace dependencies
pnpm install

# Run everything in dev mode (server + client hot-reload)
pnpm dev

# Type-check all packages
pnpm typecheck

# Run tests
pnpm test

# Database commands (from packages/server/)
pnpm db:generate   # regenerate Prisma client after schema changes
pnpm db:migrate    # create & apply a migration
pnpm db:push       # push schema directly (dev only, no migration file)
pnpm db:studio     # open Prisma Studio
```

Copy `packages/server/.env.example` → `packages/server/.env` and fill in values before running locally.

## Migration guide (C++ → TypeScript)

### Game entity mapping

| C++ concept | TypeScript equivalent |
|-------------|----------------------|
| `archspace` binary + CGI pages | Fastify route handlers in `packages/server/src/routes/` |
| MySQL `player` table | `Player` Prisma model |
| Turn trigger loop (`trigger.cc`) | `packages/server/src/game/turn.ts` — `processTurn()` |
| Binary CGI protocol | REST JSON over HTTP + Socket.IO for push |
| `proxy.py` HTTP bridge | Eliminated — Fastify serves HTTP directly |
| jQuery/Yahoo UI frontend | React components in `packages/client/src/` |
| Script files (`tech.en`, `race.en`, etc.) | Seed data via Prisma migrations or JSON config |

### Migration priority order

1. ✅ **Auth** — bcrypt login/register/change-password (`src/routes/auth.ts`)
2. ✅ **Player dashboard** — empire snapshot, planet list, fleet list, news (`src/routes/player.ts`)
3. ✅ **Fleet management** — create/rename/assign admiral/mission/disband (`src/routes/fleet.ts`)
4. ✅ **Battle records** — history, pagination, per-player filter (`src/routes/battle.ts`)
5. ✅ **Turn engine** — production, research, population, buildings, honour, admiral timer (`src/game/turn.ts` + `production.ts` + `research.ts` + `fleet-missions.ts`)
6. ✅ **Turn scheduler** — `node-cron` based ticker, configurable via `TURN_INTERVAL_SECONDS` (`src/game/scheduler.ts`)
7. ✅ **Diplomacy** — player relations, council relations, messages, cooldowns (`src/routes/diplomacy.ts`)
8. ✅ **Tech tree** — 55-tech tree across SOCL/INFO/MATR/LIFE, queue/research/instant (`src/routes/tech.ts`, `src/game/data/tech.ts`)
9. ✅ **Council/Alliance** — create, join, admit, donate, disband, speakers (`src/routes/council.ts`)
10. ✅ **Empire management** — planet ratios, building queue, investment, events (`src/routes/empire.ts`)
11. ✅ **Black market** — list, bid, close-expired with tech grant (`src/routes/blackmarket.ts`)
12. ✅ **Bounty system** — place, cancel (with 80% refund), list (`src/routes/bounty.ts`)
13. ✅ **Admin** — player CRUD, ban/unban, grant-tech, force-turn, council/market/bounty management (`src/routes/admin.ts`)
14. ⏸  **Battle engine** — to be overhauled separately (legacy: `battle.cc` ~5K LOC)
15. ⏸  **Ship designer** — to be overhauled separately (legacy: `class` table + `page/design.cc`)

### Key C++ files to port

| File | LOC | Priority |
|------|-----|----------|
| `battle.cc` | ~5,000 | High (core gameplay) |
| `trigger.cc` | ~3,000 | High (turn engine) |
| `page/fleet.cc` | ~2,000 | High |
| `page/empire.cc` | ~2,000 | High |
| `page/diplomacy.cc` | ~1,500 | Medium |
| `page/tech.cc` | ~1,000 | Medium |
| `page/black_market.cc` | ~800 | Low |

### Invariants to preserve

- Turn duration: 60 seconds (`SecondPerTurn` in `archspace.config`)
- Diplomatic cooldown: 4.8 hours (major), 1.6 hours (council votes)
- Rating system: default 2000, ELO-style adjustment on battle outcomes
- Planet building ratios must sum to 100
- Fleet `missionTerminateTime` is a Unix timestamp in seconds

## Docker

Old stack (C++ + MySQL 5.7):
```bash
docker compose up          # uses docker-compose.yml
```

New stack (Node.js + PostgreSQL 16):
```bash
docker compose -f docker-compose.new.yml up
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` or `claude/**` branches:
- **typecheck** — `pnpm typecheck`
- **lint** — `pnpm lint`
- **test** — Vitest against a real PostgreSQL service container
- **build** — full production build (runs after the above three pass)

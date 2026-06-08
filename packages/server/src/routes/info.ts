// Public information routes: rankings, cluster map, encyclopedia
import type { FastifyPluginAsync } from 'fastify';
import { prisma as db } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { TECH_DEFS } from '../game/data/tech.js';
import { RACES } from '../game/data/races.js';
import { PROJECTS } from '../game/data/projects.js';
import { SPY_OPS } from '../game/data/spy-ops.js';
import { SHIP_CLASS_NAMES, SHIP_CLASS_BASE_HP } from '../game/data/components.js';

export const infoRoutes: FastifyPluginAsync = async (app) => {
  // ── Rankings ────────────────────────────────────────────────────────────────

  app.get('/rankings/players', async (req) => {
    const qs = req.query as { by?: string; limit?: string };
    const limit = Math.min(100, parseInt(qs.limit ?? '50', 10));
    const by = qs.by ?? 'rating';

    const orderBy =
      by === 'honor'      ? { honor: 'desc' as const } :
      by === 'production' ? { production: 'desc' as const } :
                            { rating: 'desc' as const };
    const players = await db.player.findMany({
      where: { isAi: false },
      take: limit,
      orderBy,
      select: { id: true, name: true, race: true, rating: true, honor: true, production: true, councilId: true },
    });
    return { data: players };
  });

  app.get('/rankings/fleets', async () => {
    const fleets = await db.fleet.findMany({
      take: 50,
      orderBy: { killedShips: 'desc' },
      include: { owner: { select: { name: true, race: true } } },
    });
    return { data: fleets };
  });

  app.get('/rankings/councils', async () => {
    const councils = await db.council.findMany({
      take: 50,
      orderBy: { production: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    return { data: councils };
  });

  // ── Cluster map ─────────────────────────────────────────────────────────────

  app.get('/clusters', async () => {
    const clusters = await db.cluster.findMany({
      include: {
        _count: { select: { planets: true, players: true } },
      },
      orderBy: { id: 'asc' },
    });
    return { data: clusters };
  });

  app.get('/clusters/:id', async (req) => {
    const { id } = req.params as { id: string };
    const cluster = await db.cluster.findUnique({
      where: { id: Number(id) },
      include: {
        planets: { include: { owner: { select: { name: true, race: true } } } },
        players: { select: { id: true, name: true, race: true, rating: true } },
      },
    });
    if (!cluster) throw app.httpErrors.notFound('Cluster not found');
    return { data: cluster };
  });

  // My cluster
  app.get('/clusters/mine', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, select: { homeClusterId: true } });
    const cluster = await db.cluster.findUnique({
      where: { id: player.homeClusterId },
      include: {
        planets: { include: { owner: { select: { name: true, race: true } } } },
        players: { select: { id: true, name: true, race: true, rating: true } },
      },
    });
    return { data: cluster };
  });

  // ── Encyclopedia ────────────────────────────────────────────────────────────

  app.get('/encyclopedia/techs', async () => {
    return { data: TECH_DEFS };
  });

  app.get('/encyclopedia/races', async () => {
    return { data: RACES };
  });

  app.get('/encyclopedia/projects', async () => {
    return { data: PROJECTS };
  });

  app.get('/encyclopedia/spy-ops', async () => {
    return { data: SPY_OPS };
  });

  app.get('/encyclopedia/ship-classes', async () => {
    return {
      data: SHIP_CLASS_NAMES.map((name, i) => ({
        index: i,
        name,
        baseHp: SHIP_CLASS_BASE_HP[i] ?? 80,
      })),
    };
  });

  // ── Player profile (public) ─────────────────────────────────────────────────

  app.get('/player/:id', async (req) => {
    const { id } = req.params as { id: string };
    const player = await db.player.findUnique({
      where: { id: Number(id) },
      select: { id: true, name: true, race: true, rating: true, honor: true, councilId: true, createdAt: true },
    });
    if (!player) throw app.httpErrors.notFound('Player not found');
    return { data: player };
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  app.get('/search', async (req) => {
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) return { data: { players: [], councils: [] } };

    const [players, councils] = await Promise.all([
      db.player.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: 10,
        select: { id: true, name: true, race: true, rating: true },
      }),
      db.council.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: 10,
        select: { id: true, name: true, production: true },
      }),
    ]);

    return { data: { players, councils } };
  });
};

// Planetary and council projects
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma as db } from '../db/index.js';
import { requireAuth, getPayload } from '../middleware/auth.js';
import { PROJECTS, PROJECT_BY_ID } from '../game/data/projects.js';

const BuildBody = z.object({ projectId: z.number().int() });

export const projectRoutes: FastifyPluginAsync = async (app) => {
  // List all projects with player's unlock/build state
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);

    const [learned, built, player] = await Promise.all([
      db.playerTech.findMany({ where: { playerId } }),
      db.playerProject.findMany({ where: { playerId } }),
      db.player.findUniqueOrThrow({ where: { id: playerId }, select: { production: true, councilId: true } }),
    ]);

    const techIds = new Set(learned.map((t) => t.techId));
    const builtIds = new Set(built.map((p) => p.projectId));

    const projects = PROJECTS.map((p) => ({
      ...p,
      built: builtIds.has(p.id),
      available: !builtIds.has(p.id) &&
        p.prereqs.every((t) => techIds.has(t)) &&
        (p.type !== 'Council' || !!player.councilId) &&
        player.production >= p.cost,
    }));

    return { data: projects };
  });

  // Get a single project definition
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const p = PROJECT_BY_ID.get(Number(id));
    if (!p) throw app.httpErrors.notFound('Project not found');
    return { data: p };
  });

  // Build / invest in a project
  app.post('/build', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const body = BuildBody.parse(req.body);

    const project = PROJECT_BY_ID.get(body.projectId);
    if (!project) throw app.httpErrors.badRequest('Unknown project');

    const [learned, built, player] = await Promise.all([
      db.playerTech.findMany({ where: { playerId } }),
      db.playerProject.findFirst({ where: { playerId, projectId: body.projectId } }),
      db.player.findUniqueOrThrow({ where: { id: playerId } }),
    ]);

    if (built) throw app.httpErrors.conflict('Project already built');

    const techIds = new Set(learned.map((t) => t.techId));
    if (project.prereqs.some((t) => !techIds.has(t))) {
      throw app.httpErrors.forbidden('Missing prerequisite technology');
    }
    if (project.type === 'Council' && !player.councilId) {
      throw app.httpErrors.forbidden('Must be in a council for council projects');
    }
    if (player.production < project.cost) {
      throw app.httpErrors.badRequest(`Insufficient production: need ${project.cost}, have ${player.production}`);
    }

    await db.$transaction([
      db.player.update({ where: { id: playerId }, data: { production: { decrement: project.cost } } }),
      db.playerProject.create({ data: { playerId, projectId: body.projectId, type: project.type === 'Planet' ? 1 : project.type === 'Fixed' ? 2 : 3 } }),
    ]);

    return { data: { projectId: body.projectId, built: true, effects: project.effects } };
  });

  // List player's completed projects
  app.get('/built', { preHandler: requireAuth }, async (req) => {
    const { playerId } = getPayload(req);
    const built = await db.playerProject.findMany({ where: { playerId } });
    const builtWithDefs = built.map((b) => ({
      ...b,
      definition: PROJECT_BY_ID.get(b.projectId),
    }));
    return { data: builtWithDefs };
  });
};

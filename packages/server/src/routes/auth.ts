import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db/index.js';

const BCRYPT_ROUNDS = 12;

const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(6).max(100),
  email: z.string().email(),
  playerName: z.string().min(1).max(30),
  race: z.number().int().min(1).max(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(100),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
    }

    const user = await prisma.user.findUnique({
      where: { username: body.data.username },
      include: { player: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
    }

    const valid = await bcrypt.compare(body.data.password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
    }

    if (!user.player) {
      return reply.status(500).send({ error: 'Player record missing', code: 'INTERNAL' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastIp: request.ip ?? '0.0.0.0' },
    });

    const token = await reply.jwtSign({
      userId: user.id,
      playerId: user.player.id,
      userLevel: user.userLevel,
    });
    return reply.send({ data: { token, player: user.player } });
  });

  app.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
    }

    const existing = await prisma.user.findUnique({ where: { username: body.data.username } });
    if (existing) {
      return reply.status(409).send({ error: 'Username taken', code: 'CONFLICT' });
    }

    const hash = await bcrypt.hash(body.data.password, BCRYPT_ROUNDS);

    // Assign home cluster (pick cluster with fewest players)
    const cluster = await prisma.cluster.findFirst({
      orderBy: { players: { _count: 'asc' } },
    });

    const user = await prisma.user.create({
      data: {
        username: body.data.username,
        password: hash,
        email: body.data.email,
        firstLogin: new Date(),
        lastIp: request.ip ?? '0.0.0.0',
        player: {
          create: {
            name: body.data.playerName,
            race: body.data.race,
            homeClusterId: cluster?.id ?? 1,
            protectedMode: true,
            protectedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7-day newbie protection
          },
        },
      },
      include: { player: true },
    });

    const token = await reply.jwtSign({
      userId: user.id,
      playerId: user.player!.id,
      userLevel: user.userLevel,
    });
    return reply.status(201).send({ data: { token, player: user.player } });
  });

  app.post('/change-password', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const body = changePasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
    }

    const { userId } = request.user as { userId: number };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });

    const valid = await bcrypt.compare(body.data.currentPassword, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Wrong current password', code: 'UNAUTHORIZED' });
    }

    const hash = await bcrypt.hash(body.data.newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { password: hash } });

    return reply.send({ data: { message: 'Password changed' } });
  });
};

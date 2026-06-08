import type { FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  userId: number;
  playerId: number;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload & { userLevel?: string };
    if (payload.userLevel !== 'ADMIN' && payload.userLevel !== 'DEV') {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
}

export function getPayload(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload;
}

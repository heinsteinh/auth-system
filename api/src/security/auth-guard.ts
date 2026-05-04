import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums.js';
import { env } from '../config/env.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ message: 'Missing access token' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      email: string;
      role: Role;
    };

    request.user = payload;
  } catch {
    return reply.code(401).send({ message: 'Invalid access token' });
  }
}

export function requireRole(...roles: Role[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    await requireAuth(request, reply);

    if (reply.sent) return;

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ message: 'Forbidden' });
    }
  };
}

import '@fastify/jwt';
import { PrismaClient, Role } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      email: string;
      role: Role;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      role: Role;
    };
    user: {
      sub: string;
      email: string;
      role: Role;
    };
  }
}

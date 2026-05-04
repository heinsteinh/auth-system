import { FastifyInstance } from 'fastify';
import { Role } from '../../generated/prisma/enums.js';
import { requireAuth, requireRole } from '../../security/auth-guard.js';
import { UserService } from './user.service.js';

export async function userRoutes(app: FastifyInstance) {
  const userService = new UserService(app);

  app.get('/me', { preHandler: requireAuth }, async (request) => {
    return userService.getMe(request.user.sub);
  });

  app.get('/admin/users', { preHandler: requireRole(Role.ADMIN) }, async () => {
    return userService.listUsers();
  });

  app.delete(
    '/admin/users/:id',
    { preHandler: requireRole(Role.ADMIN) },
    async (request, reply) => {
      const params = request.params as { id: string };

      await userService.deleteUser(params.id);

      return reply.code(204).send();
    },
  );
}

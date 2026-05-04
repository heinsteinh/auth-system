import { FastifyInstance } from 'fastify';
import { Role } from '../../generated/prisma/enums.js';
import { requireAuth, requireRole } from '../../security/auth-guard.js';
import { UserService } from './user.service.js';
import { updateRoleSchema } from './user.schemas.js';

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

      if (params.id === request.user.sub) {
        return reply.code(400).send({ message: 'You cannot delete your own account' });
      }

      await userService.deleteUser(params.id);

      return reply.code(204).send();
    },
  );

  app.patch(
    '/admin/users/:id',
    { preHandler: requireRole(Role.ADMIN) },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = updateRoleSchema.parse(request.body);

      if (params.id === request.user.sub) {
        return reply.code(400).send({ message: 'You cannot change your own role' });
      }

      const user = await userService.setRole(params.id, body.role);
      return reply.send(user);
    },
  );
}

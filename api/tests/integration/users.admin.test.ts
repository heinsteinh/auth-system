import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, getPrisma, truncateAll } from '../helpers/db.js';
import { createAdmin, createUser } from '../helpers/factories.js';
import { mailerStub } from '../helpers/mailer.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});

beforeEach(async () => {
  await truncateAll();
  mailerStub.reset();
});

async function tokenFor(email: string, password: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return response.json().accessToken as string;
}

describe('admin user management', () => {
  describe('GET /api/users/admin/users', () => {
    it('returns 403 for a USER token', async () => {
      const { user, password } = await createUser({
        email: 'plain@example.com',
        isEmailVerified: true,
      });
      const token = await tokenFor(user.email, password);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 200 with the user list for an ADMIN token', async () => {
      const { user: admin, password } = await createAdmin({
        email: 'admin@example.com',
        isEmailVerified: true,
      });
      await createUser({ email: 'one@example.com', isEmailVerified: true });
      await createUser({ email: 'two@example.com', isEmailVerified: true });

      const token = await tokenFor(admin.email, password);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const users = response.json() as Array<{ email: string }>;
      expect(users.map((u) => u.email).sort()).toEqual([
        'admin@example.com',
        'one@example.com',
        'two@example.com',
      ]);
    });
  });

  describe('DELETE /api/users/admin/users/:id', () => {
    it('returns 204 and removes the user when called as ADMIN', async () => {
      const { user: admin, password } = await createAdmin({
        email: 'admin2@example.com',
        isEmailVerified: true,
      });
      const { user: target } = await createUser({
        email: 'target@example.com',
        isEmailVerified: true,
      });

      const token = await tokenFor(admin.email, password);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/admin/users/${target.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);

      const stillThere = await getPrisma().user.findUnique({ where: { id: target.id } });
      expect(stillThere).toBeNull();
    });

    it('returns 403 for a USER token', async () => {
      const { user, password } = await createUser({
        email: 'normie@example.com',
        isEmailVerified: true,
      });
      const { user: target } = await createUser({
        email: 'victim@example.com',
        isEmailVerified: true,
      });
      const token = await tokenFor(user.email, password);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/admin/users/${target.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

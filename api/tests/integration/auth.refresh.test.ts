import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, getPrisma, truncateAll } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
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

async function loginUser(email: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return response.json() as { accessToken: string; refreshToken: string };
}

describe('POST /api/auth/refresh', () => {
  const url = '/api/auth/refresh';

  it('issues new access + refresh tokens and revokes the old refresh token', async () => {
    const { user, password } = await createUser({
      email: 'refresh@example.com',
      isEmailVerified: true,
    });

    const initial = await loginUser(user.email, password);

    const response = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: initial.refreshToken },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.refreshToken).not.toBe(initial.refreshToken);

    const tokens = await getPrisma().refreshToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(2);
    const revoked = tokens.filter((t) => t.revokedAt !== null);
    expect(revoked).toHaveLength(1);
  });

  it('rejects re-use of an already-rotated refresh token with 401', async () => {
    const { user, password } = await createUser({
      email: 'reuse@example.com',
      isEmailVerified: true,
    });

    const initial = await loginUser(user.email, password);

    const first = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: initial.refreshToken },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: initial.refreshToken },
    });
    expect(second.statusCode).toBe(401);
  });

  it('rejects an unknown refresh token with 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: 'definitely-not-a-real-token' },
    });

    expect(response.statusCode).toBe(401);
  });
});

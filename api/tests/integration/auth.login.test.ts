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

describe('POST /api/auth/login', () => {
  const url = '/api/auth/login';

  it('returns access token + sets HttpOnly refresh cookie for a verified user', async () => {
    const { user, password } = await createUser({
      email: 'login@example.com',
      isEmailVerified: true,
    });

    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: user.email, password },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toBeUndefined();
    expect(body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: 'USER',
    });

    const cookie = response.cookies.find((c) => c.name === 'refreshToken');
    expect(cookie).toBeDefined();
    expect(cookie!.value).toEqual(expect.any(String));
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
    expect(cookie!.path).toBe('/api/auth');

    const stored = await getPrisma().refreshToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(cookie!.value); // stored hashed, not raw
  });

  it('rejects an unverified user with 401', async () => {
    const { user, password } = await createUser({
      email: 'unverified@example.com',
      isEmailVerified: false,
    });

    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: user.email, password },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a wrong password with 401', async () => {
    const { user } = await createUser({ email: 'pw@example.com', isEmailVerified: true });

    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: user.email, password: 'totally-wrong' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an unknown email with 401 (no user enumeration)', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: 'nobody@example.com', password: 'whatever12345' },
    });

    expect(response.statusCode).toBe(401);
  });
});

import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, truncateAll } from '../helpers/db.js';
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

describe('GET /api/users/me', () => {
  const url = '/api/users/me';

  it('returns 401 when no Authorization header is present', async () => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when the token is malformed', async () => {
    const response = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when the token is signed with the wrong secret', async () => {
    const badToken = jwt.sign(
      { sub: 'whatever', email: 'x@y.z', role: 'USER' },
      'a-different-secret-that-is-long-enough',
    );
    const response = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${badToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns the current user when the access token is valid', async () => {
    const { user, password } = await createUser({
      email: 'me@example.com',
      isEmailVerified: true,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password },
    });
    const { accessToken } = login.json();

    const response = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: user.id,
      email: user.email,
      role: 'USER',
      isEmailVerified: true,
    });
  });
});

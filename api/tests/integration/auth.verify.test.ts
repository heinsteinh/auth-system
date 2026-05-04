import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, getPrisma, truncateAll } from '../helpers/db.js';
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

describe('GET /api/auth/verify-email', () => {
  it('marks the user as verified when given a valid token', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'v@example.com', password: 'StrongPassword123!' },
    });

    const sent = mailerStub.lastFor('v@example.com', 'verify');
    expect(sent).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/auth/verify-email?token=${sent!.token}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true });

    const user = await getPrisma().user.findUnique({ where: { email: 'v@example.com' } });
    expect(user?.isEmailVerified).toBe(true);
  });

  it('returns 400 when the token is missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/verify-email' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'Missing token' });
  });

  it('returns 400 when the token is unknown', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/verify-email?token=not-a-real-token',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'Invalid or expired token' });
  });

  it('returns 400 when the token has already been used', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'used@example.com', password: 'StrongPassword123!' },
    });

    const sent = mailerStub.lastFor('used@example.com', 'verify')!;

    const first = await app.inject({
      method: 'GET',
      url: `/api/auth/verify-email?token=${sent.token}`,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'GET',
      url: `/api/auth/verify-email?token=${sent.token}`,
    });
    expect(second.statusCode).toBe(400);
  });
});

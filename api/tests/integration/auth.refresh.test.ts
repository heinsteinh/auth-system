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

async function loginAndGetCookie(email: string, password: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  const cookie = response.cookies.find((c) => c.name === 'refreshToken');
  if (!cookie) throw new Error('login did not return a refreshToken cookie');
  return cookie.value;
}

describe('POST /api/auth/refresh', () => {
  const url = '/api/auth/refresh';

  it('issues a new access token + rotated cookie and revokes the old one', async () => {
    const { user, password } = await createUser({
      email: 'refresh@example.com',
      isEmailVerified: true,
    });

    const initialCookie = await loginAndGetCookie(user.email, password);

    const response = await app.inject({
      method: 'POST',
      url,
      cookies: { refreshToken: initialCookie },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toBeUndefined();

    const newCookie = response.cookies.find((c) => c.name === 'refreshToken');
    expect(newCookie).toBeDefined();
    expect(newCookie!.value).not.toBe(initialCookie);
    expect(newCookie!.httpOnly).toBe(true);

    const tokens = await getPrisma().refreshToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(2);
    const revoked = tokens.filter((t) => t.revokedAt !== null);
    expect(revoked).toHaveLength(1);
  });

  it('rejects re-use of an already-rotated refresh cookie with 401', async () => {
    const { user, password } = await createUser({
      email: 'reuse@example.com',
      isEmailVerified: true,
    });

    const initialCookie = await loginAndGetCookie(user.email, password);

    const first = await app.inject({
      method: 'POST',
      url,
      cookies: { refreshToken: initialCookie },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url,
      cookies: { refreshToken: initialCookie },
    });
    expect(second.statusCode).toBe(401);
  });

  it('returns 401 when no refresh cookie is sent', async () => {
    const response = await app.inject({ method: 'POST', url });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: 'Missing refresh token' });
  });

  it('rejects an unknown refresh cookie with 401 and clears the cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      cookies: { refreshToken: 'definitely-not-a-real-token' },
    });

    expect(response.statusCode).toBe(401);

    const cleared = response.cookies.find((c) => c.name === 'refreshToken');
    expect(cleared).toBeDefined();
    expect(cleared!.value).toBe('');
  });
});

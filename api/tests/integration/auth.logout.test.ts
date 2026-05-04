import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, getPrisma, truncateAll } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { mailerStub } from '../helpers/mailer.js';
import { hashToken } from '../../src/security/token.js';

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
  return response.cookies.find((c) => c.name === 'refreshToken')!.value;
}

describe('POST /api/auth/logout', () => {
  const url = '/api/auth/logout';

  it('returns 204, clears the cookie, and revokes the server-side refresh token', async () => {
    const { user, password } = await createUser({
      email: 'logout@example.com',
      isEmailVerified: true,
    });

    const cookie = await loginAndGetCookie(user.email, password);

    const response = await app.inject({
      method: 'POST',
      url,
      cookies: { refreshToken: cookie },
    });

    expect(response.statusCode).toBe(204);

    const cleared = response.cookies.find((c) => c.name === 'refreshToken');
    expect(cleared).toBeDefined();
    expect(cleared!.value).toBe('');

    const stored = await getPrisma().refreshToken.findFirst({
      where: { tokenHash: hashToken(cookie) },
    });
    expect(stored?.revokedAt).not.toBeNull();
  });

  it('is idempotent — returns 204 even without a cookie', async () => {
    const response = await app.inject({ method: 'POST', url });
    expect(response.statusCode).toBe(204);
  });

  it('refresh fails after logout', async () => {
    const { user, password } = await createUser({
      email: 'after-logout@example.com',
      isEmailVerified: true,
    });

    const cookie = await loginAndGetCookie(user.email, password);

    await app.inject({ method: 'POST', url, cookies: { refreshToken: cookie } });

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refreshToken: cookie },
    });
    expect(refresh.statusCode).toBe(401);
  });
});

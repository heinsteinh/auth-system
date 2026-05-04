import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { disconnectPrisma, truncateAll } from '../helpers/db.js';
import { mailerStub } from '../helpers/mailer.js';

let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  app = await buildTestApp();
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = address; // e.g. http://127.0.0.1:54321
});

afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});

beforeEach(async () => {
  await truncateAll();
  mailerStub.reset();
});

async function api(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

describe('e2e: full auth journey over real HTTP', () => {
  it('walks register → verify → login → /me → refresh → /me', async () => {
    const email = 'journey@example.com';
    const password = 'JourneyPassword123!';

    // 1. Health
    const health = await api('/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok', db: 'up' });

    // 2. Register
    const register = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: 'Journey User' }),
    });
    expect(register.status).toBe(201);

    // 3. Verify email (token captured by the in-memory mailer stub)
    const verifyMail = mailerStub.lastFor(email, 'verify');
    expect(verifyMail).toBeDefined();

    const verify = await api(`/api/auth/verify-email?token=${verifyMail!.token}`);
    expect(verify.status).toBe(200);
    expect(await verify.json()).toEqual({ verified: true });

    // 4. Login
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = (await login.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(accessToken).toEqual(expect.any(String));
    expect(refreshToken).toEqual(expect.any(String));

    // 5. Protected /me with the access token
    const me = await api('/api/users/me', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email, role: 'USER', isEmailVerified: true });

    // 6. Refresh — should hand out a new pair and revoke the old refresh token
    const refresh = await api('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    expect(refresh.status).toBe(200);
    const rotated = (await refresh.json()) as { accessToken: string; refreshToken: string };
    expect(rotated.refreshToken).not.toBe(refreshToken);

    // 7. /me with the rotated access token still works
    const meAgain = await api('/api/users/me', {
      headers: { authorization: `Bearer ${rotated.accessToken}` },
    });
    expect(meAgain.status).toBe(200);

    // 8. Re-using the original (now-rotated) refresh token must fail
    const reuse = await api('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    expect(reuse.status).toBe(401);
  });
});

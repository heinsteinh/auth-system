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
  baseUrl = address;
});

afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});

beforeEach(async () => {
  await truncateAll();
  mailerStub.reset();
});

/**
 * Walks the full auth flow over a real HTTP server using cookies.
 * `fetch` doesn't have a built-in cookie jar, so we maintain one manually
 * by reading `set-cookie` and forwarding the `refreshToken` value.
 */
class CookieJar {
  private value: string | null = null;

  capture(response: Response): void {
    const header = response.headers.get('set-cookie');
    if (!header) return;
    // node fetch joins multiple Set-Cookie headers with comma; pull the refreshToken pair.
    const match = header.match(/refreshToken=([^;,\s]*)/);
    if (match) this.value = match[1];
  }

  cookieHeader(): Record<string, string> {
    return this.value ? { cookie: `refreshToken=${this.value}` } : {};
  }

  current(): string | null {
    return this.value;
  }
}

describe('e2e: full auth journey over real HTTP with HttpOnly cookies', () => {
  it('walks register → verify → login → /me → refresh → /me → logout', async () => {
    const email = 'journey@example.com';
    const password = 'JourneyPassword123!';
    const jar = new CookieJar();

    async function api(path: string, init?: RequestInit) {
      const headers: Record<string, string> = {
        ...jar.cookieHeader(),
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      };
      if (init?.body) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
      jar.capture(res);
      return res;
    }

    // 1. Health
    const health = await api('/health');
    expect(health.status).toBe(200);

    // 2. Register
    const register = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: 'Journey User' }),
    });
    expect(register.status).toBe(201);

    // 3. Verify
    const verifyMail = mailerStub.lastFor(email, 'verify');
    const verify = await api(`/api/auth/verify-email?token=${verifyMail!.token}`);
    expect(verify.status).toBe(200);

    // 4. Login — accessToken in body, refreshToken set as HttpOnly cookie
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const loginBody = (await login.json()) as { accessToken: string; refreshToken?: string };
    expect(loginBody.accessToken).toEqual(expect.any(String));
    expect(loginBody.refreshToken).toBeUndefined();
    const initialCookie = jar.current();
    expect(initialCookie).toBeTruthy();

    // 5. /me with Bearer access token
    const me = await api('/api/users/me', {
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    expect(me.status).toBe(200);

    // 6. Refresh — cookie sent automatically by the jar; new cookie rotated in
    const refresh = await api('/api/auth/refresh', { method: 'POST' });
    expect(refresh.status).toBe(200);
    const refreshBody = (await refresh.json()) as { accessToken: string };
    expect(refreshBody.accessToken).toEqual(expect.any(String));
    expect(jar.current()).not.toBe(initialCookie);

    // 7. /me with the rotated access token
    const meAgain = await api('/api/users/me', {
      headers: { authorization: `Bearer ${refreshBody.accessToken}` },
    });
    expect(meAgain.status).toBe(200);

    // 8. Logout — clears cookie + revokes server-side token
    const logout = await api('/api/auth/logout', { method: 'POST' });
    expect(logout.status).toBe(204);

    // 9. Trying to refresh again fails — even with the (now revoked) cookie value if we replay it
    const replayed = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `refreshToken=${initialCookie}` },
    });
    expect(replayed.status).toBe(401);
  });
});

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

describe('forgot-password / reset-password', () => {
  it('emits a reset token and lets the user reset the password with it', async () => {
    const { user, password } = await createUser({
      email: 'reset@example.com',
      isEmailVerified: true,
    });

    // Establish an active session so we can verify it gets revoked on reset.
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password },
    });
    expect(loginA.statusCode).toBe(200);

    const forgot = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: user.email },
    });
    expect(forgot.statusCode).toBe(200);

    const sent = mailerStub.lastFor(user.email, 'reset');
    expect(sent).toBeDefined();

    const newPassword = 'BrandNewPassword123!';
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: sent!.token, newPassword },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ message: 'Password reset successful' });

    // Old refresh tokens revoked
    const refreshTokens = await getPrisma().refreshToken.findMany({ where: { userId: user.id } });
    expect(refreshTokens.every((t) => t.revokedAt !== null)).toBe(true);

    // Old password no longer works
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password },
    });
    expect(oldLogin.statusCode).toBe(401);

    // New password works
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: newPassword },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('returns 200 for forgot-password even when the email is unknown (no enumeration)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(mailerStub.all()).toHaveLength(0);
  });

  it('rejects reset-password with an unknown token (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'not-a-real-reset-token', newPassword: 'AnyStrongPassword123!' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('does not allow re-use of a reset token (400 on second use)', async () => {
    const { user } = await createUser({ email: 'twice@example.com', isEmailVerified: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: user.email },
    });

    const sent = mailerStub.lastFor(user.email, 'reset')!;

    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: sent.token, newPassword: 'FirstNewPassword123!' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: sent.token, newPassword: 'SecondNewPassword123!' },
    });
    expect(second.statusCode).toBe(400);
  });
});

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

describe('POST /api/auth/register', () => {
  const url = '/api/auth/register';

  it('creates an unverified user, persists a verification token, and sends an email', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: {
        email: 'new@example.com',
        password: 'StrongPassword123!',
        name: 'Newbie',
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.user).toMatchObject({
      email: 'new@example.com',
      role: 'USER',
      isEmailVerified: false,
    });
    expect(body.user.id).toEqual(expect.any(String));

    const dbUser = await getPrisma().user.findUnique({ where: { email: 'new@example.com' } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isEmailVerified).toBe(false);

    const tokens = await getPrisma().emailVerificationToken.findMany({
      where: { userId: dbUser!.id },
    });
    expect(tokens).toHaveLength(1);

    const sent = mailerStub.lastFor('new@example.com', 'verify');
    expect(sent).toBeDefined();
    expect(sent!.token).toEqual(expect.any(String));
  });

  it('returns 409 when the email is already registered', async () => {
    await app.inject({
      method: 'POST',
      url,
      payload: {
        email: 'dup@example.com',
        password: 'StrongPassword123!',
      },
    });

    const second = await app.inject({
      method: 'POST',
      url,
      payload: {
        email: 'dup@example.com',
        password: 'AnotherStrongPassword123!',
      },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ message: 'Email already registered' });
  });

  it('returns 400 with structured issues when the password is too short', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: 'short@example.com', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toBe('Validation failed');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['password'], code: 'too_small' }),
      ]),
    );
  });

  it('returns 400 when the email is malformed', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { email: 'not-an-email', password: 'StrongPassword123!' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['email'] })]),
    );
  });
});

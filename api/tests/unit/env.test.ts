import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * The exported `env` is parsed at import-time, so we re-declare the schema
 * here to test the validation rules without mutating module state.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),
});

const valid = {
  DATABASE_URL: 'postgresql://localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  APP_URL: 'http://localhost:4000',
  FRONTEND_URL: 'http://localhost:5173',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'noreply@example.com',
};

describe('env schema', () => {
  it('parses a fully valid configuration', () => {
    const result = envSchema.parse(valid);
    expect(result.PORT).toBe(4000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.ACCESS_TOKEN_TTL).toBe('15m');
    expect(result.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('coerces PORT and SMTP_PORT from strings', () => {
    const result = envSchema.parse({ ...valid, PORT: '8080', SMTP_PORT: '587' });
    expect(result.PORT).toBe(8080);
    expect(result.SMTP_PORT).toBe(587);
  });

  it('rejects JWT secrets shorter than 32 chars', () => {
    expect(() =>
      envSchema.parse({ ...valid, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL, ...withoutDb } = valid;
    void DATABASE_URL;
    expect(() => envSchema.parse(withoutDb)).toThrow();
  });

  it('rejects a non-URL APP_URL', () => {
    expect(() => envSchema.parse({ ...valid, APP_URL: 'not-a-url' })).toThrow();
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => envSchema.parse({ ...valid, NODE_ENV: 'staging' })).toThrow();
  });
});

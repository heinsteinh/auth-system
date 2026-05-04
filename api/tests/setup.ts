import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { vi } from 'vitest';
import { mailerStub } from './helpers/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
  override: true,
});

vi.mock('../src/mail/mailer.js', () => ({
  sendVerificationEmail: vi.fn(async (email: string, token: string) => {
    mailerStub.push({ to: email, type: 'verify', token });
  }),
  sendPasswordResetEmail: vi.fn(async (email: string, token: string) => {
    mailerStub.push({ to: email, type: 'reset', token });
  }),
}));

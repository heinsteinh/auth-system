import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.test');

export async function setup() {
  const result = dotenv.config({ path: envPath, override: true });

  if (result.error) {
    throw new Error(
      `Could not load ${envPath}. Create it from the README's "Testing" section before running the suite.`,
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing from .env.test');
  }

  // eslint-disable-next-line no-console
  console.log('[tests] applying migrations to', maskDb(process.env.DATABASE_URL));

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });
}

function maskDb(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return '<unparseable url>';
  }
}

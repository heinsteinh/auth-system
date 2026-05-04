import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.test');

export async function setup() {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  } else if (!process.env.DATABASE_URL) {
    throw new Error(
      `No .env.test found at ${envPath} and DATABASE_URL is not set externally. ` +
        'Create one for local dev, or pass env vars from your CI workflow.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
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

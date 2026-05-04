import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/security/password.js';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.warn(
      '[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin bootstrap.',
    );
    return;
  }

  if (password.length < 12) {
    throw new Error('[seed] ADMIN_PASSWORD must be at least 12 characters');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: Role.ADMIN,
        isEmailVerified: true,
      },
      create: {
        email,
        passwordHash,
        name,
        role: Role.ADMIN,
        isEmailVerified: true,
      },
      select: { id: true, email: true, role: true, isEmailVerified: true },
    });

    console.log(`[seed] admin ready: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});

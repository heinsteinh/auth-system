import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export async function truncateAll(): Promise<void> {
  const p = getPrisma();
  await p.$executeRawUnsafe(
    'TRUNCATE TABLE "RefreshToken", "EmailVerificationToken", "PasswordResetToken", "User" RESTART IDENTITY CASCADE;',
  );
}

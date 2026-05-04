import { hashPassword } from '../../src/security/password.js';
import { Role } from '../../src/generated/prisma/enums.js';
import { getPrisma } from './db.js';

type CreateUserInput = {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  isEmailVerified?: boolean;
};

export async function createUser(input: CreateUserInput = {}) {
  const password = input.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  const user = await getPrisma().user.create({
    data: {
      email: input.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
      passwordHash,
      name: input.name ?? 'Test User',
      role: input.role ?? Role.USER,
      isEmailVerified: input.isEmailVerified ?? true,
    },
  });

  return { user, password };
}

export async function createAdmin(input: CreateUserInput = {}) {
  return createUser({ ...input, role: Role.ADMIN });
}

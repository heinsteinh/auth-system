import { FastifyInstance } from 'fastify';
import { Role } from '../../generated/prisma/enums.js';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isEmailVerified: true,
  createdAt: true,
} as const;

export class UserService {
  constructor(private readonly app: FastifyInstance) {}

  async getMe(userId: string) {
    return this.app.prisma.user.findUnique({
      where: { id: userId },
      select: publicSelect,
    });
  }

  async listUsers() {
    return this.app.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
  }

  async deleteUser(userId: string) {
    return this.app.prisma.user.delete({
      where: { id: userId },
    });
  }

  async setRole(userId: string, role: Role) {
    return this.app.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: publicSelect,
    });
  }
}

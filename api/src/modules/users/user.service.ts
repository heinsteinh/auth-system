import { FastifyInstance } from 'fastify';

export class UserService {
  constructor(private readonly app: FastifyInstance) {}

  async getMe(userId: string) {
    return this.app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });
  }

  async listUsers() {
    return this.app.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    return this.app.prisma.user.delete({
      where: { id: userId },
    });
  }
}

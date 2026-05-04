import { FastifyInstance } from 'fastify';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { addDays, addMinutes, generateSecureToken, hashToken } from '../../security/token.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../mail/mailer.js';

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async register(input: { email: string; password: string; name?: string }) {
    const existingUser = await this.app.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('EMAIL_ALREADY_REGISTERED');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.app.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });

    const rawToken = generateSecureToken();

    await this.app.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: addMinutes(30),
      },
    });

    await sendVerificationEmail(user.email, rawToken);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.app.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);

    if (!validPassword) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.isEmailVerified) {
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateSecureToken();

    await this.app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: addDays(env.REFRESH_TOKEN_TTL_DAYS),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const storedToken = await this.app.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    await this.app.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const newRefreshToken = generateSecureToken();

    await this.app.prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: addDays(env.REFRESH_TOKEN_TTL_DAYS),
      },
    });

    const accessToken = this.signAccessToken({
      sub: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(rawRefreshToken: string | null | undefined) {
    if (!rawRefreshToken) return;

    const tokenHash = hashToken(rawRefreshToken);

    await this.app.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const token = await this.app.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new Error('INVALID_VERIFICATION_TOKEN');
    }

    await this.app.prisma.$transaction([
      this.app.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.app.prisma.user.update({
        where: { id: token.userId },
        data: { isEmailVerified: true },
      }),
    ]);

    return { verified: true };
  }

  async forgotPassword(email: string) {
    const user = await this.app.prisma.user.findUnique({
      where: { email },
    });

    /**
     * Important:
     * Always return the same response even if the user does not exist.
     * This reduces account enumeration risk.
     */
    if (!user) {
      return;
    }

    const rawToken = generateSecureToken();

    await this.app.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: addMinutes(15),
      },
    });

    await sendPasswordResetEmail(user.email, rawToken);
  }

  async resetPassword(input: { token: string; newPassword: string }) {
    const tokenHash = hashToken(input.token);

    const token = await this.app.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new Error('INVALID_RESET_TOKEN');
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.app.prisma.$transaction([
      this.app.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.app.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      this.app.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }

  private signAccessToken(payload: { sub: string; email: string; role: 'USER' | 'ADMIN' }) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    });
  }
}

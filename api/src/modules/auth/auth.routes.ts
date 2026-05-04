import { FastifyInstance, type FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

const loginRouteOptions =
  env.NODE_ENV === 'test'
    ? {}
    : { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

const REFRESH_COOKIE = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
};

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, {
    path: refreshCookieOptions.path,
    sameSite: refreshCookieOptions.sameSite,
    secure: refreshCookieOptions.secure,
  });
}

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    try {
      const user = await authService.register(body);
      return reply.code(201).send({
        message: 'User registered. Please verify your email.',
        user,
      });
    } catch (error) {
      if ((error as Error).message === 'EMAIL_ALREADY_REGISTERED') {
        return reply.code(409).send({ message: 'Email already registered' });
      }

      throw error;
    }
  });

  app.post('/login', loginRouteOptions, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    try {
      const { accessToken, refreshToken, user } = await authService.login(body);
      setRefreshCookie(reply, refreshToken);
      return reply.send({ accessToken, user });
    } catch {
      return reply.code(401).send({
        message: 'Invalid credentials or email not verified',
      });
    }
  });

  app.post('/refresh', async (request, reply) => {
    const cookieToken = request.cookies[REFRESH_COOKIE];

    if (!cookieToken) {
      return reply.code(401).send({ message: 'Missing refresh token' });
    }

    try {
      const { accessToken, refreshToken } = await authService.refresh(cookieToken);
      setRefreshCookie(reply, refreshToken);
      return reply.send({ accessToken });
    } catch {
      clearRefreshCookie(reply);
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }
  });

  app.post('/logout', async (request, reply) => {
    await authService.logout(request.cookies[REFRESH_COOKIE]);
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  app.get('/verify-email', async (request, reply) => {
    const query = request.query as { token?: string };

    if (!query.token) {
      return reply.code(400).send({ message: 'Missing token' });
    }

    try {
      const result = await authService.verifyEmail(query.token);
      return reply.send(result);
    } catch {
      return reply.code(400).send({ message: 'Invalid or expired token' });
    }
  });

  app.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);

    await authService.forgotPassword(body.email);

    return reply.send({
      message: 'If this email exists, a reset link has been sent.',
    });
  });

  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    try {
      await authService.resetPassword(body);
      return reply.send({ message: 'Password reset successful' });
    } catch {
      return reply.code(400).send({ message: 'Invalid or expired reset token' });
    }
  });
}

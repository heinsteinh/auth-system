import { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

const loginRouteOptions =
  env.NODE_ENV === 'test'
    ? {}
    : { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

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

  app.post(
    '/login',
    loginRouteOptions,
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      try {
        const result = await authService.login(body);
        return reply.send(result);
      } catch {
        return reply.code(401).send({
          message: 'Invalid credentials or email not verified',
        });
      }
    },
  );

  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    try {
      const result = await authService.refresh(body.refreshToken);
      return reply.send(result);
    } catch {
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }
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

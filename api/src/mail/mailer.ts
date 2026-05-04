import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
});

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${env.APP_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Verify your email',
    text: `Verify your email using this link: ${url}`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Reset your password',
    text: `Reset your password using this link: ${url}`,
  });
}

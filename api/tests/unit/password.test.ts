import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/security/password.js';

describe('password', () => {
  it('hashPassword produces a non-empty bcrypt hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('hashes the same input to different values (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('verifyPassword returns true for the matching password', async () => {
    const hash = await hashPassword('hunter2-hunter2');
    await expect(verifyPassword('hunter2-hunter2', hash)).resolves.toBe(true);
  });

  it('verifyPassword returns false for the wrong password', async () => {
    const hash = await hashPassword('hunter2-hunter2');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('verifyPassword returns false for an empty input', async () => {
    const hash = await hashPassword('hunter2-hunter2');
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });
});

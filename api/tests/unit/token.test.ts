import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMinutes,
  generateSecureToken,
  hashToken,
} from '../../src/security/token.js';

describe('token utilities', () => {
  describe('generateSecureToken', () => {
    it('returns a 64-character hex string (32 random bytes)', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different value each call', () => {
      const a = generateSecureToken();
      const b = generateSecureToken();
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('returns a 64-character hex SHA-256 digest', () => {
      expect(hashToken('hello')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(hashToken('hello')).toBe(hashToken('hello'));
    });

    it('produces different digests for different inputs', () => {
      expect(hashToken('hello')).not.toBe(hashToken('hello!'));
    });
  });

  describe('addDays / addMinutes', () => {
    it('addDays returns a date n days in the future', () => {
      const before = Date.now();
      const result = addDays(7).getTime();
      const after = Date.now();

      const minExpected = before + 7 * 24 * 60 * 60 * 1000 - 1000;
      const maxExpected = after + 7 * 24 * 60 * 60 * 1000 + 1000;

      expect(result).toBeGreaterThanOrEqual(minExpected);
      expect(result).toBeLessThanOrEqual(maxExpected);
    });

    it('addMinutes returns a date n minutes in the future', () => {
      const before = Date.now();
      const result = addMinutes(15).getTime();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 1000);
      expect(result).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 1000);
    });
  });
});

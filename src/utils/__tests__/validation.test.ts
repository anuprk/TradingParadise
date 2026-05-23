import { describe, it, expect } from 'vitest';
import { validatePassword } from '../validation';

describe('validatePassword', () => {
  it('rejects an empty string', () => {
    expect(validatePassword('')).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(validatePassword('abc1234')).toBe(false);
  });

  it('rejects a 7-character password (boundary)', () => {
    expect(validatePassword('1234567')).toBe(false);
  });

  it('accepts an 8-character password (boundary)', () => {
    expect(validatePassword('12345678')).toBe(true);
  });

  it('accepts a password longer than 8 characters', () => {
    expect(validatePassword('mysecurepassword123')).toBe(true);
  });
});

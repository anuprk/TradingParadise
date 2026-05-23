// Feature: dark-mode-and-cloud-auth, Property 1: Password validation boundary

/**
 * Property-based test for password validation boundary.
 * Uses fast-check to verify the validation result matches length >= 8
 * for random strings of 0–100 characters.
 *
 * **Validates: Requirements 3.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePassword } from '../validation';

describe('Property 1: Password validation boundary', () => {
  it('rejects any string shorter than 8 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 7 }),
        (password) => {
          expect(validatePassword(password)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('accepts any string of 8 or more characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 100 }),
        (password) => {
          expect(validatePassword(password)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('validation result matches length >= 8 for arbitrary strings (0–100 chars)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (password) => {
          const expected = password.length >= 8;
          expect(validatePassword(password)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});

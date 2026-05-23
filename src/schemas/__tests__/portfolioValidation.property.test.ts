// Feature: portfolio-management, Property 1: Portfolio validation accepts valid inputs and rejects invalid inputs

/**
 * Property-based tests for portfolio validation schemas.
 *
 * **Validates: Requirements 1.1, 1.6**
 *
 * Property 1: Portfolio validation accepts valid inputs and rejects invalid inputs
 *
 * - For any string with length between 1 and 100 (inclusive) that is not purely whitespace,
 *   the portfolio name validation SHALL accept it.
 * - For any string that is empty, longer than 100 characters, or composed entirely of whitespace,
 *   the validation SHALL reject it.
 * - For any number between 0.00 and 999,999,999.99 (inclusive), the initial balance validation SHALL accept it.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  portfolioNameSchema,
  portfolioDescriptionSchema,
  portfolioInitialBalanceSchema,
} from '../../schemas/portfolioSchema';

describe('Property 1: Portfolio validation accepts valid inputs and rejects invalid inputs', () => {
  describe('Portfolio name validation', () => {
    it('accepts valid names (1-100 chars, not whitespace-only)', () => {
      fc.assert(
        fc.property(
          fc
            .integer({ min: 1, max: 100 })
            .chain((len) => {
              // Generate a string of the target length that has at least one non-whitespace char
              return fc
                .string({ minLength: len, maxLength: len })
                .filter((s) => s.trim().length > 0);
            }),
          (validName) => {
            const result = portfolioNameSchema.safeParse(validName);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects empty strings', () => {
      const result = portfolioNameSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects strings longer than 100 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 300 }),
          (longName) => {
            const result = portfolioNameSchema.safeParse(longName);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc
            .integer({ min: 1, max: 100 })
            .map((len) => ' '.repeat(len)),
          (whitespaceName) => {
            const result = portfolioNameSchema.safeParse(whitespaceName);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Portfolio initial balance validation', () => {
    it('accepts valid balances (0.00 to 999,999,999.99)', () => {
      fc.assert(
        fc.property(
          fc.double({
            min: 0,
            max: 999_999_999.99,
            noNaN: true,
            noDefaultInfinity: true,
          }).map((n) => Math.round(n * 100) / 100), // Round to 2 decimal places
          (validBalance) => {
            const result = portfolioInitialBalanceSchema.safeParse(validBalance);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects negative balances', () => {
      fc.assert(
        fc.property(
          fc.double({
            min: -999_999_999.99,
            max: -0.01,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          (negativeBalance) => {
            const result = portfolioInitialBalanceSchema.safeParse(negativeBalance);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects balances exceeding maximum', () => {
      fc.assert(
        fc.property(
          fc.double({
            min: 1_000_000_000,
            max: 9_999_999_999,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          (excessiveBalance) => {
            const result = portfolioInitialBalanceSchema.safeParse(excessiveBalance);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Portfolio description validation', () => {
    it('accepts valid descriptions (0-500 chars)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (validDescription) => {
            const result = portfolioDescriptionSchema.safeParse(validDescription);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects descriptions longer than 500 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 501, maxLength: 1000 }),
          (longDescription) => {
            const result = portfolioDescriptionSchema.safeParse(longDescription);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Property-based tests for trade calculation utilities.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Validates: Requirements 13.4, 13.6, 13.7, 13.10
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateDTE,
  calculateBreakEvenPrice,
  calculateAnnualizedROR,
  calculateWinLoss,
} from '../calculations';

// --- Generators ---

/**
 * Generate a pair of Dates where expirationDate >= openDate.
 * Dates are constrained to a reasonable range (2000–2099).
 */
const arbValidDatePair = fc
  .tuple(
    fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true }),
    fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true }),
  )
  .map(([a, b]) => {
    // Normalize to midnight to avoid time-of-day effects on calendar day diff
    const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return d1 <= d2
      ? { openDate: d1, expirationDate: d2 }
      : { openDate: d2, expirationDate: d1 };
  });

/** Positive finite double for monetary values. */
const arbPositiveFinite = fc.double({
  min: 0.01,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Positive integer for days held (1–3650). */
const arbPositiveDays = fc.integer({ min: 1, max: 3650 });

// --- Property 1: DTE Calculation Consistency ---

describe('Property 1: DTE Calculation Consistency', () => {
  /**
   * Validates: Requirements 13.4
   * For random valid date pairs where expirationDate >= openDate,
   * DTE is non-negative and equals the calendar day difference.
   */
  it('DTE is non-negative for expirationDate >= openDate', () => {
    fc.assert(
      fc.property(arbValidDatePair, ({ openDate, expirationDate }) => {
        const dte = calculateDTE(openDate, expirationDate);
        expect(dte).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('DTE equals calendar day difference', () => {
    fc.assert(
      fc.property(arbValidDatePair, ({ openDate, expirationDate }) => {
        const dte = calculateDTE(openDate, expirationDate);
        const expectedDays = Math.round(
          (expirationDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        expect(dte).toBe(expectedDays);
      }),
      { numRuns: 200 },
    );
  });
});


// --- Property 2: Break-Even Price Calculation ---

describe('Property 2: Break-Even Price Calculation', () => {
  /**
   * Validates: Requirements 13.6
   * For random strikePrice > 0 and premium > 0,
   * Put break-even = strike - premium, Call break-even = strike + premium.
   */
  it('Put break-even equals strike minus premium', () => {
    fc.assert(
      fc.property(arbPositiveFinite, arbPositiveFinite, (strikePrice, premium) => {
        const result = calculateBreakEvenPrice(strikePrice, premium, 'Put');
        expect(result).toBeCloseTo(strikePrice - premium, 8);
      }),
      { numRuns: 200 },
    );
  });

  it('Call break-even equals strike plus premium', () => {
    fc.assert(
      fc.property(arbPositiveFinite, arbPositiveFinite, (strikePrice, premium) => {
        const result = calculateBreakEvenPrice(strikePrice, premium, 'Call');
        expect(result).toBeCloseTo(strikePrice + premium, 8);
      }),
      { numRuns: 200 },
    );
  });
});

// --- Property 3: Annualized ROR Formula ---

describe('Property 3: Annualized ROR Formula', () => {
  /**
   * Validates: Requirements 13.7
   * For random premium > 0, cashReserve > 0, daysHeld > 0,
   * verify formula: (premium / cashReserve) * (365 / daysHeld) * 100
   */
  it('matches the annualized ROR formula', () => {
    fc.assert(
      fc.property(
        arbPositiveFinite,
        arbPositiveFinite,
        arbPositiveDays,
        (premium, cashReserve, daysHeld) => {
          const result = calculateAnnualizedROR(premium, cashReserve, daysHeld);
          const expected = (premium / cashReserve) * (365 / daysHeld) * 100;
          expect(result).toBeCloseTo(expected, 8);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// --- Property 4: Win/Loss Determination ---

describe('Property 4: Win/Loss Determination', () => {
  /**
   * Validates: Requirements 13.10
   * For random profitLoss values, Win when > 0, Loss when <= 0.
   */
  it('returns Win for positive profitLoss', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (profitLoss) => {
          expect(calculateWinLoss(profitLoss)).toBe('Win');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns Loss for zero profitLoss', () => {
    expect(calculateWinLoss(0)).toBe('Loss');
  });

  it('returns Loss for negative profitLoss', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: -0.0001, noNaN: true, noDefaultInfinity: true }),
        (profitLoss) => {
          expect(calculateWinLoss(profitLoss)).toBe('Loss');
        },
      ),
      { numRuns: 200 },
    );
  });
});

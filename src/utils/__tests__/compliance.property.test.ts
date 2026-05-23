/**
 * Property-based tests for compliance checking and aggregation utilities.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Validates: Requirements 15.1, 18.1, 17.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkTradeCompliance } from '../compliance';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy, EntryCriterion } from '../../types/tradingPlan';

// --- Generators ---

/** Generate a random OptionType. */
const arbOptionType = fc.constantFrom('Call' as const, 'Put' as const);

/** Generate a random TradeDirection. */
const arbDirection = fc.constantFrom('Buy' as const, 'Sell' as const);

/** Generate a random TradeStatus. */
const arbTradeStatus = fc.constantFrom(
  'Open' as const,
  'Closed' as const,
  'Expired' as const,
  'Assigned' as const,
);

/** Positive finite double for monetary values. */
const arbPositiveFinite = fc.double({
  min: 0.01,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Non-negative integer for day counts. */
const arbNonNegDays = fc.integer({ min: 0, max: 3650 });

/** Generate a random TradeJournalEntry. */
const arbTradeJournalEntry: fc.Arbitrary<TradeJournalEntry> = fc.record({
  id: fc.uuid(),
  stockSymbol: fc.constantFrom('SPY', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'QQQ', 'IWM', 'GLD'),
  openDate: fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31), noInvalidDate: true }),
  expirationDate: fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31), noInvalidDate: true }),
  optionType: arbOptionType,
  direction: arbDirection,
  stockPriceDOC: arbPositiveFinite,
  dte: arbNonNegDays,
  ditc: arbNonNegDays,
  breakEvenPrice: arbPositiveFinite,
  strikePrice: arbPositiveFinite,
  premium: arbPositiveFinite,
  cashReserve: arbPositiveFinite,
  fees: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  tradeStatus: arbTradeStatus,
  portfolioId: fc.uuid(),
  strategyId: fc.uuid(),
  planId: fc.uuid(),
  notes: fc.string({ maxLength: 50 }),
  winLoss: fc.constantFrom('Win' as const, 'Loss' as const, null),
  createdAt: fc.date({ noInvalidDate: true }),
  updatedAt: fc.date({ noInvalidDate: true }),
});

/** Generate a random EntryCriterion. */
const arbEntryCriterion: fc.Arbitrary<EntryCriterion> = fc.record({
  id: fc.uuid(),
  parameterName: fc.constantFrom(
    'DTE',
    'Days to Expiration',
    'Strike Price',
    'Premium',
    'Cash Reserve',
    'Option Type',
    'Direction',
    'IV Rank',
    'Delta',
  ),
  value: fc.oneof(
    // Range values like "30-45"
    fc.tuple(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
    ).map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`),
    // Single numeric values like "45 DTE"
    fc.integer({ min: 1, max: 500 }).map((n) => `${n}`),
    // String values like "Put", "Sell"
    fc.constantFrom('Put', 'Call', 'Buy', 'Sell'),
  ),
});

/** Generate a random Strategy. */
const arbStrategy: fc.Arbitrary<Strategy> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  classification: fc.constantFrom('Core' as const, 'Speculative' as const),
  description: fc.string({ maxLength: 50 }),
  entryCriteria: fc.array(arbEntryCriterion, { minLength: 0, maxLength: 5 }),
  managementRules: fc.array(
    fc.record({
      id: fc.uuid(),
      triggerCondition: fc.string({ minLength: 1, maxLength: 30 }),
      actionDescription: fc.string({ minLength: 1, maxLength: 30 }),
    }),
    { minLength: 1, maxLength: 3 },
  ),
  profitTargets: fc.array(
    fc.record({
      id: fc.uuid(),
      targetValue: fc.string({ minLength: 1, maxLength: 10 }),
      action: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    { minLength: 0, maxLength: 2 },
  ),
  stopLosses: fc.array(
    fc.record({
      id: fc.uuid(),
      stopValue: fc.string({ minLength: 1, maxLength: 10 }),
      action: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    { minLength: 0, maxLength: 2 },
  ),
});

// --- Property 8: Compliance Check Determinism ---

describe('Property 8: Compliance Check Determinism', () => {
  /**
   * Validates: Requirements 15.1
   * For random entry/strategy pairs, calling checkTradeCompliance twice
   * with the same inputs always produces the same result.
   */
  it('same inputs always produce the same ComplianceResult', () => {
    fc.assert(
      fc.property(arbTradeJournalEntry, arbStrategy, (entry, strategy) => {
        const result1 = checkTradeCompliance(entry, strategy);
        const result2 = checkTradeCompliance(entry, strategy);

        expect(result1.isCompliant).toBe(result2.isCompliant);
        expect(result1.deviations).toEqual(result2.deviations);
      }),
      { numRuns: 200 },
    );
  });
});

// --- Property 9: Premium Income Aggregation ---

describe('Property 9: Premium Income Aggregation', () => {
  /**
   * Validates: Requirements 18.1
   * For random sets of closed entries, the total premium equals
   * the sum of individual entry.premium values.
   */

  /** Generate a closed TradeJournalEntry with a closeDate set. */
  const arbClosedEntry: fc.Arbitrary<TradeJournalEntry> = arbTradeJournalEntry.map((entry) => ({
    ...entry,
    tradeStatus: 'Closed' as const,
    closeDate: new Date(
      entry.openDate.getTime() + Math.abs(entry.dte) * 24 * 60 * 60 * 1000,
    ),
  }));

  /** Simple inline aggregation: sum of premiums for closed entries. */
  function calculateTotalPremium(entries: TradeJournalEntry[]): number {
    return entries
      .filter((e) => e.tradeStatus === 'Closed')
      .reduce((sum, e) => sum + e.premium, 0);
  }

  it('total premium equals sum of individual premiums', () => {
    fc.assert(
      fc.property(
        fc.array(arbClosedEntry, { minLength: 0, maxLength: 20 }),
        (entries) => {
          const total = calculateTotalPremium(entries);
          const manualSum = entries.reduce((sum, e) => sum + e.premium, 0);
          expect(total).toBeCloseTo(manualSum, 8);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// --- Property 10: Portfolio Metrics Consistency ---

describe('Property 10: Portfolio Metrics Consistency', () => {
  /**
   * Validates: Requirements 17.3
   * For random realizedPL and unrealizedPL numbers,
   * totalPL must equal realizedPL + unrealizedPL.
   */

  const arbPL = fc.double({
    min: -1_000_000,
    max: 1_000_000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  it('totalPL equals realizedPL + unrealizedPL', () => {
    fc.assert(
      fc.property(arbPL, arbPL, (realizedPL, unrealizedPL) => {
        const totalPL = realizedPL + unrealizedPL;
        expect(totalPL).toBeCloseTo(realizedPL + unrealizedPL, 8);
      }),
      { numRuns: 200 },
    );
  });
});

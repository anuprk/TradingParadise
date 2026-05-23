/**
 * Property-based tests for performance metrics computation utility.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 10: Performance metrics computation correctness
 *
 * Validates: Requirements 8.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computePerformanceSummary } from '../../utils/metrics';
import type {
  PortfolioTransaction,
  TransactionType,
  AssetType,
  TransactionSource,
} from '../../types/transaction';
import type { OptionType } from '../../types/journal';

// --- Generators ---

const arbTransactionType: fc.Arbitrary<TransactionType> = fc.constantFrom(
  'Buy',
  'Sell',
  'Dividend',
  'Fee',
);

const arbAssetType: fc.Arbitrary<AssetType> = fc.constantFrom('Stock', 'ETF', 'Option', 'Cash');

const arbTransactionSource: fc.Arbitrary<TransactionSource> = fc.constantFrom(
  'tastytrade_pdf',
  'fidelity_pdf',
  'csv',
  'manual',
);

const arbOptionType: fc.Arbitrary<OptionType | undefined> = fc.constantFrom(
  'Call' as const,
  'Put' as const,
  undefined,
);

const arbSymbol: fc.Arbitrary<string> = fc.constantFrom(
  'AAPL',
  'MSFT',
  'GOOG',
  'TSLA',
  'AMZN',
  'SPY',
  'QQQ',
  'NVDA',
);

const arbPrice: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 10_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbQuantity: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 1_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbFees: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 50,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbAmount: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbDate: fc.Arbitrary<Date> = fc.date({
  min: new Date(2020, 0, 1),
  max: new Date(2025, 11, 31),
  noInvalidDate: true,
});

/**
 * Generate a valid PortfolioTransaction with arbitrary field values.
 * Includes a mix of Buy, Sell, Dividend, and Fee transaction types.
 */
const arbPortfolioTransaction: fc.Arbitrary<PortfolioTransaction> = fc.record({
  id: fc.uuid(),
  portfolioId: fc.constant('portfolio-1'),
  planId: fc.constant('plan-1'),
  transactionDate: arbDate,
  settlementDate: fc.option(arbDate, { nil: undefined }),
  symbol: arbSymbol,
  description: fc.string({ minLength: 0, maxLength: 30 }),
  transactionType: arbTransactionType,
  assetType: arbAssetType,
  optionType: arbOptionType,
  strikePrice: fc.option(
    fc.double({ min: 1, max: 5_000, noNaN: true, noDefaultInfinity: true }),
    { nil: undefined },
  ),
  expirationDate: fc.option(arbDate, { nil: undefined }),
  quantity: arbQuantity,
  price: arbPrice,
  amount: arbAmount,
  fees: arbFees,
  source: arbTransactionSource,
  rawDescription: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

const arbTransactionArray: fc.Arbitrary<PortfolioTransaction[]> = fc.array(
  arbPortfolioTransaction,
  { minLength: 0, maxLength: 20 },
);

const arbPositiveInitialBalance: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 999_999_999.99,
  noNaN: true,
  noDefaultInfinity: true,
});

// --- Property 10: Performance metrics computation correctness ---

describe('Property 10: Performance metrics computation correctness', () => {
  /**
   * Validates: Requirements 8.2
   * totalPortfolioValue = initialBalance + totalRealizedPL + totalUnrealizedPL + sum(dividends) - sum(fees)
   */
  it('totalPortfolioValue equals initialBalance + totalRealizedPL + totalUnrealizedPL + dividends - fees', () => {
    fc.assert(
      fc.property(arbTransactionArray, arbPositiveInitialBalance, (transactions, initialBalance) => {
        const result = computePerformanceSummary(transactions, initialBalance);

        const totalDividends = transactions
          .filter((t) => t.transactionType === 'Dividend')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalFees = transactions.reduce((sum, t) => sum + t.fees, 0);

        const expectedValue =
          initialBalance + result.totalRealizedPL + result.totalUnrealizedPL + totalDividends - totalFees;

        expect(result.totalPortfolioValue).toBeCloseTo(expectedValue, 5);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 8.2
   * overallReturnPercentage = (totalPortfolioValue - initialBalance) / initialBalance × 100
   * when initialBalance > 0
   */
  it('overallReturnPercentage equals (totalPortfolioValue - initialBalance) / initialBalance * 100', () => {
    fc.assert(
      fc.property(arbTransactionArray, arbPositiveInitialBalance, (transactions, initialBalance) => {
        const result = computePerformanceSummary(transactions, initialBalance);

        const expectedReturnPct =
          ((result.totalPortfolioValue - initialBalance) / initialBalance) * 100;

        expect(result.overallReturnPercentage).toBeCloseTo(expectedReturnPct, 5);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 8.2
   * winRate is between 0 and 100 inclusive
   */
  it('winRate is between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(arbTransactionArray, arbPositiveInitialBalance, (transactions, initialBalance) => {
        const result = computePerformanceSummary(transactions, initialBalance);

        expect(result.winRate).toBeGreaterThanOrEqual(0);
        expect(result.winRate).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 8.2
   * totalTransactions equals the input array length
   */
  it('totalTransactions equals the input array length', () => {
    fc.assert(
      fc.property(arbTransactionArray, arbPositiveInitialBalance, (transactions, initialBalance) => {
        const result = computePerformanceSummary(transactions, initialBalance);

        expect(result.totalTransactions).toBe(transactions.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 8.2
   * When initialBalance is 0, overallReturnPercentage is 0
   */
  it('when initialBalance is 0, overallReturnPercentage is 0', () => {
    fc.assert(
      fc.property(arbTransactionArray, (transactions) => {
        const result = computePerformanceSummary(transactions, 0);

        expect(result.overallReturnPercentage).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

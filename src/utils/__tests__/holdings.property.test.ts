/**
 * Property-based tests for holdings computation utility.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 7: Holdings computation produces correct aggregation
 *
 * Validates: Requirements 6.2, 6.3, 6.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeHoldings } from '../../utils/holdings';
import type { PortfolioTransaction, AssetType, TransactionSource } from '../../types/transaction';
import type { OptionType } from '../../types/journal';

// --- Generators ---

const arbAssetType: fc.Arbitrary<AssetType> = fc.constantFrom('Stock', 'ETF', 'Option', 'Cash');

const _arbTransactionSource: fc.Arbitrary<TransactionSource> = fc.constantFrom(
  'tastytrade_pdf', 'fidelity_pdf', 'csv', 'manual',
);

const arbOptionType: fc.Arbitrary<OptionType | undefined> = fc.constantFrom(
  'Call' as const, 'Put' as const, undefined,
);

const arbSymbol: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z]{1,5}$/);

const arbPositivePrice: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 10_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbPositiveQuantity: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 10_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbStrikePrice: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.double({ min: 1, max: 10_000, noNaN: true, noDefaultInfinity: true }),
);

const arbDate: fc.Arbitrary<Date> = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
  noInvalidDate: true,
});

/**
 * Represents a grouping key for transactions that should be aggregated together.
 */
interface GroupKey {
  symbol: string;
  assetType: AssetType;
  optionType: OptionType | undefined;
  strikePrice: number | undefined;
  expirationDate: Date | undefined;
}

const arbGroupKey: fc.Arbitrary<GroupKey> = fc.record({
  symbol: arbSymbol,
  assetType: arbAssetType,
  optionType: arbOptionType,
  strikePrice: arbStrikePrice,
  expirationDate: fc.option(arbDate, { nil: undefined }),
});

/**
 * Generate a Buy transaction for a given group key.
 */
function makeBuyTransaction(
  groupKey: GroupKey,
  quantity: number,
  price: number,
  date: Date,
): PortfolioTransaction {
  return {
    id: crypto.randomUUID(),
    portfolioId: 'portfolio-1',
    planId: 'plan-1',
    transactionDate: date,
    symbol: groupKey.symbol,
    description: `Buy ${groupKey.symbol}`,
    transactionType: 'Buy',
    assetType: groupKey.assetType,
    optionType: groupKey.optionType,
    strikePrice: groupKey.strikePrice,
    expirationDate: groupKey.expirationDate,
    quantity,
    price,
    amount: quantity * price,
    fees: 0,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate a Sell transaction for a given group key.
 */
function makeSellTransaction(
  groupKey: GroupKey,
  quantity: number,
  price: number,
  date: Date,
): PortfolioTransaction {
  return {
    id: crypto.randomUUID(),
    portfolioId: 'portfolio-1',
    planId: 'plan-1',
    transactionDate: date,
    symbol: groupKey.symbol,
    description: `Sell ${groupKey.symbol}`,
    transactionType: 'Sell',
    assetType: groupKey.assetType,
    optionType: groupKey.optionType,
    strikePrice: groupKey.strikePrice,
    expirationDate: groupKey.expirationDate,
    quantity,
    price,
    amount: quantity * price,
    fees: 0,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate a set of Buy/Sell transactions for a single group.
 */
const arbGroupTransactions: fc.Arbitrary<{
  groupKey: GroupKey;
  buys: { quantity: number; price: number; date: Date }[];
  sells: { quantity: number; price: number; date: Date }[];
}> = fc.record({
  groupKey: arbGroupKey,
  buys: fc.array(
    fc.record({
      quantity: arbPositiveQuantity,
      price: arbPositivePrice,
      date: arbDate,
    }),
    { minLength: 1, maxLength: 5 },
  ),
  sells: fc.array(
    fc.record({
      quantity: arbPositiveQuantity,
      price: arbPositivePrice,
      date: arbDate,
    }),
    { minLength: 0, maxLength: 3 },
  ),
});

// --- Property 7: Holdings computation produces correct aggregation ---

describe('Property 7: Holdings computation produces correct aggregation', () => {
  /**
   * Validates: Requirements 6.2, 6.3
   * For any set of Buy/Sell transactions in a group, netQuantity = sum(Buy quantities) - sum(Sell quantities).
   */
  it('netQuantity equals sum of Buy quantities minus sum of Sell quantities for each group', () => {
    fc.assert(
      fc.property(arbGroupTransactions, ({ groupKey, buys, sells }) => {
        const totalBuyQty = buys.reduce((sum, b) => sum + b.quantity, 0);
        const totalSellQty = sells.reduce((sum, s) => sum + s.quantity, 0);
        const expectedNetQty = totalBuyQty - totalSellQty;

        // Skip if net quantity is zero (those are excluded)
        fc.pre(Math.abs(expectedNetQty) > 1e-10);

        const transactions: PortfolioTransaction[] = [
          ...buys.map((b) => makeBuyTransaction(groupKey, b.quantity, b.price, b.date)),
          ...sells.map((s) => makeSellTransaction(groupKey, s.quantity, s.price, s.date)),
        ];

        const holdings = computeHoldings(transactions);
        expect(holdings.length).toBe(1);

        const holding = holdings[0];
        expect(holding.netQuantity).toBeCloseTo(expectedNetQty, 8);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.3
   * averageCostBasis = totalBuyCost / totalBuyQuantity (weighted average).
   */
  it('averageCostBasis equals total buy cost divided by total buy quantity (weighted average)', () => {
    fc.assert(
      fc.property(arbGroupTransactions, ({ groupKey, buys, sells }) => {
        const totalBuyQty = buys.reduce((sum, b) => sum + b.quantity, 0);
        const totalBuyCost = buys.reduce((sum, b) => sum + b.quantity * b.price, 0);
        const totalSellQty = sells.reduce((sum, s) => sum + s.quantity, 0);
        const expectedNetQty = totalBuyQty - totalSellQty;

        // Skip if net quantity is zero (those are excluded)
        fc.pre(Math.abs(expectedNetQty) > 1e-10);
        // Ensure we have buy quantity to compute average
        fc.pre(totalBuyQty > 0);

        const expectedAvgCostBasis = totalBuyCost / totalBuyQty;

        const transactions: PortfolioTransaction[] = [
          ...buys.map((b) => makeBuyTransaction(groupKey, b.quantity, b.price, b.date)),
          ...sells.map((s) => makeSellTransaction(groupKey, s.quantity, s.price, s.date)),
        ];

        const holdings = computeHoldings(transactions);
        expect(holdings.length).toBe(1);

        const holding = holdings[0];
        expect(holding.averageCostBasis).toBeCloseTo(expectedAvgCostBasis, 6);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.4
   * Groups with netQuantity === 0 are excluded from results.
   */
  it('groups with netQuantity equal to zero are excluded from results', () => {
    fc.assert(
      fc.property(
        arbGroupKey,
        fc.array(
          fc.record({ quantity: arbPositiveQuantity, price: arbPositivePrice, date: arbDate }),
          { minLength: 1, maxLength: 5 },
        ),
        (groupKey, buys) => {
          // Create sells that exactly match total buy quantity to produce net zero
          const totalBuyQty = buys.reduce((sum, b) => sum + b.quantity, 0);

          const transactions: PortfolioTransaction[] = [
            ...buys.map((b) => makeBuyTransaction(groupKey, b.quantity, b.price, b.date)),
            // Single sell that matches total buy quantity exactly
            makeSellTransaction(groupKey, totalBuyQty, 50, new Date(2024, 5, 15)),
          ];

          const holdings = computeHoldings(transactions);
          // The group should be excluded since netQuantity === 0
          expect(holdings.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.2
   * Results are sorted by symbol ascending.
   */
  it('results are sorted by symbol in ascending order', () => {
    fc.assert(
      fc.property(
        fc.array(arbGroupTransactions, { minLength: 2, maxLength: 5 }),
        (groups) => {
          // Ensure unique group keys by using distinct symbols
          const usedSymbols = new Set<string>();
          const uniqueGroups = groups.filter((g) => {
            const sym = g.groupKey.symbol.trim().toUpperCase();
            if (usedSymbols.has(sym)) return false;
            usedSymbols.add(sym);
            return true;
          });

          fc.pre(uniqueGroups.length >= 2);

          // Ensure all groups have non-zero net quantity
          const validGroups = uniqueGroups.filter((g) => {
            const totalBuyQty = g.buys.reduce((sum, b) => sum + b.quantity, 0);
            const totalSellQty = g.sells.reduce((sum, s) => sum + s.quantity, 0);
            return Math.abs(totalBuyQty - totalSellQty) > 1e-10;
          });

          fc.pre(validGroups.length >= 2);

          const transactions: PortfolioTransaction[] = validGroups.flatMap((g) => [
            ...g.buys.map((b) => makeBuyTransaction(g.groupKey, b.quantity, b.price, b.date)),
            ...g.sells.map((s) => makeSellTransaction(g.groupKey, s.quantity, s.price, s.date)),
          ]);

          const holdings = computeHoldings(transactions);

          // Verify sorted by symbol ascending
          for (let i = 1; i < holdings.length; i++) {
            expect(holdings[i - 1].symbol.localeCompare(holdings[i].symbol)).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
